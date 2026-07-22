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
