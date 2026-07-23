export function gerarIdParticipante() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `p-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// bonus(grau) = bonus do maior marco <= grau atual; grau 0 = +0.
// Espelha a regra descrita em constantes_ascensao.json > bonus_treinamento_pericia.
export function bonusTreinamento(grau, marcos) {
  if (!marcos) return 0
  const niveis = Object.keys(marcos).map(Number).sort((a, b) => a - b)
  let bonus = 0
  for (const nivel of niveis) {
    if (grau >= nivel) bonus = marcos[nivel]
  }
  return bonus
}

export function participanteDePersonagem(item) {
  const status = item.calculado?.status || {}
  const pericias = item.calculado?.pericias || {}
  return {
    id: gerarIdParticipante(),
    tipo: 'personagem',
    ref_id: item.id,
    grau: item.grau_ascensao ?? 0,
    dono_uid: item.dono_uid || null,
    dono_nome: item.dono_nome || null,
    nome: item.nome_personagem || 'Personagem sem nome',
    imagem_base64: item.imagem_base64 || null,
    vida_maxima: status.vida ?? 0,
    vida_atual: item.vida_atual ?? status.vida ?? 0,
    sanidade_maxima: status.sanidade ?? 0,
    sanidade_atual: item.sanidade_atual ?? status.sanidade ?? 0,
    arche_maximo: status.arche ?? 0,
    arche_atual: item.arche_atual ?? status.arche ?? 0,
    defesa: status.defesa ?? 0,
    bonus_defesa: item.bonus_defesa ?? 0,
    deslocamento_m: status.deslocamento_m ?? 0,
    bonus_deslocamento: item.bonus_deslocamento ?? 0,
    iniciativa_bonus: pericias.iniciativa?.bonus_total ?? 0,
    velocidade_treinada: !!pericias.velocidade?.treinada,
    iniciativa_extra: null,
    iniciativa_final: null,
    efeitos: [],
  }
}

export function efeitoAplicado(efeitoId, catalogoEfeito) {
  return {
    id: gerarIdParticipante(),
    efeito_id: efeitoId,
    nome: catalogoEfeito.nome,
    tipo: catalogoEfeito.tipo,
    duracao_tipo: catalogoEfeito.duracao_tipo,
    rodadas_restantes: catalogoEfeito.duracao_tipo === 'rodadas' ? catalogoEfeito.duracao_rodadas_padrao : null,
    acumulos: catalogoEfeito.acumulo ? 0 : null,
  }
}

// Efeitos que causam dano/cura no início do turno de quem os carrega. O
// valor exato continua sendo digitado pelo Mestre (ver nota em
// SecaoIniciativa/SecaoTurno sobre o site ainda não rolar dados sozinho);
// isso aqui só existe pra saber QUAIS efeitos ativos precisam de um valor
// e mostrar a fórmula como lembrete.
export const EFEITOS_COM_TICK = {
  sangramento: { tipo: 'dano', formula: '1d8+2 (+2 a cada reaplicação)' },
  queimadura: { tipo: 'dano', formula: '1d4+2' },
  conducao: { tipo: 'dano', formula: '1d4+2 (ou variante por interação com Fogo/Água)' },
  deterioracao: { tipo: 'dano', formula: '1d10+2' },
  envenenamento: { tipo: 'dano', formula: '1d12+2' },
  hemorragia: { tipo: 'dano', formula: '1d12+4' },
  regeneracao: { tipo: 'cura', formula: '1d8+2' },
}

// Passo 2 do Turno ("Resolver Efeitos"): decrementa a duração de todo
// efeito com contagem em rodadas, remove o que expirou (e avisa em log),
// e devolve quais efeitos ainda ativos precisam de um valor de dano/cura
// digitado pelo Mestre. NÃO mexe em acúmulo nem aplica dano -- isso só
// acontece quando o Mestre confirma o valor (ver aplicarTickEfeito),
// porque é aí que a regra ("sempre que sofrer o dano, recebe 1 Acúmulo")
// realmente se aplica.
export function resolverInicioDeTurno(participante) {
  const logs = []
  const efeitosAtualizados = []

  for (const efeito of participante.efeitos || []) {
    if (efeito.duracao_tipo === 'rodadas' && efeito.rodadas_restantes != null) {
      const restantes = efeito.rodadas_restantes - 1
      if (restantes <= 0) {
        logs.push(`${efeito.nome} expirou em ${participante.nome}.`)
        continue
      }
      efeitosAtualizados.push({ ...efeito, rodadas_restantes: restantes })
    } else {
      efeitosAtualizados.push(efeito)
    }
  }

  const pendencias = efeitosAtualizados
    .filter((e) => EFEITOS_COM_TICK[e.efeito_id])
    .map((e) => ({ efeitoInstanciaId: e.id, efeitoId: e.efeito_id, nome: e.nome, ...EFEITOS_COM_TICK[e.efeito_id] }))

  return {
    participanteAtualizado: { ...participante, efeitos: efeitosAtualizados },
    logs,
    pendencias,
  }
}

// Aplica o valor de dano/cura que o Mestre digitou pra uma pendência de
// tick. Se o efeito tiver Acúmulo (Deterioração, Queimadura), incrementa
// aqui -- é literalmente "sempre que sofrer o dano, recebe 1 Acúmulo" -- e
// avisa em log quando bater o limite, resetando o contador (a regra diz
// que os acúmulos somem depois do estouro).
export function aplicarTickEfeito(participante, pendencia, valorDigitado, catalogoEfeitos) {
  const delta = pendencia.tipo === 'cura' ? Math.abs(valorDigitado) : -Math.abs(valorDigitado)
  const vidaAtual = Math.max(0, Math.min(participante.vida_maxima, participante.vida_atual + delta))
  const logs = [
    `${participante.nome} ${delta < 0 ? 'sofreu' : 'recuperou'} ${Math.abs(delta)} (${pendencia.nome}).`,
  ]

  const efeitos = (participante.efeitos || []).map((e) => {
    if (e.id !== pendencia.efeitoInstanciaId || e.acumulos == null) return e
    const catalogoEfeito = catalogoEfeitos[pendencia.efeitoId]
    const novoAcumulo = e.acumulos + 1
    if (catalogoEfeito?.acumulo && novoAcumulo >= catalogoEfeito.acumulo.limite) {
      logs.push(
        `${participante.nome} atingiu o limite de ${catalogoEfeito.acumulo.nome} por ${pendencia.nome} -- ${catalogoEfeito.acumulo.efeito_ao_atingir_limite}`
      )
      return { ...e, acumulos: 0 }
    }
    return { ...e, acumulos: novoAcumulo }
  })

  return { participanteAtualizado: { ...participante, vida_atual: vidaAtual, efeitos }, logs }
}

export function participanteDeMonstro(monstro, monstroId, numero, totalNoGrupo, grau, marcosTreinamento) {
  const status = monstro.status || {}
  const vida = (status.vida?.base ?? 0) + (status.vida?.mult_ascensao ?? 0) * grau
  const sanidade = (status.sanidade?.base ?? 0) + (status.sanidade?.mult_ascensao ?? 0) * grau
  const arche = (status.arche?.base ?? 0) + (status.arche?.mult_ascensao ?? 0) * grau
  const defesa = status.defesa?.total ?? 0
  const nome = totalNoGrupo > 1 ? `${monstro.nome} ${numero}` : monstro.nome
  const treinadas = monstro.pericias_treinadas || []
  const bonusTreino = bonusTreinamento(grau, marcosTreinamento)
  const iniciativaBonus = (monstro.atributos?.con ?? 0) + (treinadas.includes('iniciativa') ? bonusTreino : 0)

  return {
    id: gerarIdParticipante(),
    tipo: 'monstro',
    ref_id: monstroId,
    grau,
    dono_uid: null,
    dono_nome: null,
    nome,
    imagem_base64: null,
    vida_maxima: vida,
    vida_atual: vida,
    sanidade_maxima: sanidade,
    sanidade_atual: sanidade,
    arche_maximo: arche,
    arche_atual: arche,
    defesa,
    bonus_defesa: 0,
    deslocamento_m: status.deslocamento_m ?? 0,
    bonus_deslocamento: 0,
    iniciativa_bonus: iniciativaBonus,
    velocidade_treinada: treinadas.includes('velocidade'),
    iniciativa_extra: null,
    iniciativa_final: null,
    efeitos: [],
  }
}
