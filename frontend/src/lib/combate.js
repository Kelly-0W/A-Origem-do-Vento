export function gerarIdParticipante() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `p-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function participanteDePersonagem(item) {
  const status = item.calculado?.status || {}
  return {
    id: gerarIdParticipante(),
    tipo: 'personagem',
    ref_id: item.id,
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
    iniciativa: null,
    efeitos: [],
  }
}

export function participanteDeMonstro(monstro, monstroId, numero, totalNoGrupo) {
  const status = monstro.status || {}
  const vida = status.vida?.base ?? 0
  const sanidade = status.sanidade?.base ?? 0
  const arche = status.arche?.base ?? 0
  const defesa = status.defesa?.total ?? 0
  const nome = totalNoGrupo > 1 ? `${monstro.nome} ${numero}` : monstro.nome
  return {
    id: gerarIdParticipante(),
    tipo: 'monstro',
    ref_id: monstroId,
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
    iniciativa: null,
    efeitos: [],
  }
}
