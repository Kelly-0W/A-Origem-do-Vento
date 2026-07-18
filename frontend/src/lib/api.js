const BASE = '/api'

async function post(caminho, corpo) {
  const res = await fetch(`${BASE}/${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const dados = await res.json()
  return { ok: res.ok, status: res.status, dados }
}

async function get(caminho) {
  const res = await fetch(`${BASE}/${caminho}`)
  const dados = await res.json()
  return { ok: res.ok, status: res.status, dados }
}

export const api = {
  // GET /api/biblioteca?colecao=racas  (ver api/biblioteca.py)
  buscarBiblioteca: (colecao) => get(`biblioteca?colecao=${colecao}`),

  // POST /api/validar_e_calcular_ficha  (ver api/validar_e_calcular_ficha.py)
  // Quando sucesso, o backend ja salva automaticamente no Firestore --
  // passar donoUid vincula o documento ao usuario logado; passar
  // personagemId atualiza um personagem existente em vez de criar um novo;
  // passar campanhaId (so' usado na CRIACAO) vincula o personagem recem
  // criado aquela campanha desde o inicio (campanhas_ids).
  calcularFicha: (escolhas, { grauAscensao = 0, donoUid = null, personagemId = null, campanhaId = null } = {}) =>
    post('validar_e_calcular_ficha', {
      escolhas,
      grau_ascensao: grauAscensao,
      dono_uid: donoUid,
      personagem_id: personagemId,
      campanha_id: campanhaId,
    }),

  // GET /api/mestre_campanha_personagens?campanha_id=...&mestre_uid=...
  // (ver api/mestre_campanha_personagens.py) -- lista todos os personagens
  // da mesa pro Painel do Mestre, checagem de mestre feita no servidor.
  buscarPersonagensDaCampanhaComoMestre: (campanhaId, mestreUid) =>
    get(`mestre_campanha_personagens?campanha_id=${campanhaId}&mestre_uid=${mestreUid}`),

  // POST /api/responder_ascensao  (ver api/responder_ascensao.py)
  // aprovar=true recalcula a ficha no grau-alvo e grava; aprovar=false so
  // marca o pedido como recusado.
  responderAscensao: ({ mestreUid, campanhaId, personagemId, aprovar }) =>
    post('responder_ascensao', {
      mestre_uid: mestreUid,
      campanha_id: campanhaId,
      personagem_id: personagemId,
      aprovar,
    }),
}
