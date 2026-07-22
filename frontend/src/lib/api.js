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

  // GET /api/campanha_participantes?campanha_id=...&uid=...
  // (ver api/campanha_participantes.py) -- roster LEVE da mesa (nome,
  // retrato, raça/classe, dono), sem calculado/escolhas completos. Pra
  // qualquer MEMBRO da campanha (mestre ou jogador comum) ver quem está
  // participando, sem abrir a ficha inteira de ninguém além da própria.
  buscarParticipantesCampanha: (campanhaId, uid) =>
    get(`campanha_participantes?campanha_id=${campanhaId}&uid=${uid}`),

  // GET /api/mestre_campanha_personagens?campanha_id=...&mestre_uid=...
  // (ver api/mestre_campanha_personagens.py) -- lista todos os personagens
  // da mesa pro Painel do Mestre, checagem de mestre feita no servidor.
  buscarPersonagensDaCampanhaComoMestre: (campanhaId, mestreUid) =>
    get(`mestre_campanha_personagens?campanha_id=${campanhaId}&mestre_uid=${mestreUid}`),

  // POST /api/responder_ascensao  (ver api/responder_ascensao.py)
  // aprovar=true so' libera a fase de escolha de recompensas
  // (ascensao_em_progresso.status vira "aguardando_recompensas"); quem
  // efetiva o grau de fato e' aplicarRecompensasAscensao, chamado pelo
  // DONO do personagem depois. aprovar=false so marca como recusado.
  responderAscensao: ({ mestreUid, campanhaId, personagemId, aprovar }) =>
    post('responder_ascensao', {
      mestre_uid: mestreUid,
      campanha_id: campanhaId,
      personagem_id: personagemId,
      aprovar,
    }),

  // POST /api/aplicar_recompensas_ascensao  (ver api/aplicar_recompensas_ascensao.py)
  // So' funciona quando ascensao_em_progresso.status === "aguardando_recompensas".
  // escolhasRecompensa: { habilidades: [{origem, id}] }
  aplicarRecompensasAscensao: ({ personagemId, donoUid, escolhasRecompensa }) =>
    post('aplicar_recompensas_ascensao', {
      personagem_id: personagemId,
      dono_uid: donoUid,
      escolhas_recompensa: escolhasRecompensa,
    }),

  // POST /api/excluir_conta  (ver api/excluir_conta.py)
  // Cascata completa: campanhas mestradas + jogadores expulsos delas,
  // saída de campanhas onde só é jogador, personagens próprios, perfil,
  // e a conta do Firebase Auth. Chamar só DEPOIS de reautenticar
  // (useAuth().reautenticarComSenha/reautenticarComGoogle).
  excluirConta: (uid) => post('excluir_conta', { uid }),

  // POST /api/excluir_campanha  (ver api/excluir_campanha.py)
  // So o mestre_id de fato dessa campanha consegue -- checado no servidor.
  excluirCampanha: ({ mestreUid, campanhaId }) =>
    post('excluir_campanha', { mestre_uid: mestreUid, campanha_id: campanhaId }),
}
