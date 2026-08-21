import { useState } from 'react'
import { api } from '../lib/api.js'

// Monta a lista de habilidades elegiveis pra UM slot de recompensa, dado
// de onde ele pode vir ("classe", "raca" ou "classe_ou_raca"). Cada
// candidato ja sai marcado com a `origem` exata que o backend espera
// (classe / raca_global / raca_linhagem), pra nao ter que redescobrir isso
// na hora de montar o payload.
function candidatosParaSlot(origemExigida, { raca, linhagem, classe, idsExcluidos }) {
  const candidatos = []

  if (origemExigida === 'classe' || origemExigida === 'classe_ou_raca') {
    for (const h of classe?.habilidades || []) {
      if (!idsExcluidos.has(h.id)) candidatos.push({ origem: 'classe', id: h.id, nome: h.nome, descricao: h.descricao })
    }
  }
  if (origemExigida === 'raca' || origemExigida === 'classe_ou_raca') {
    for (const h of raca?.habilidades_globais || []) {
      // Habilidades "inatas" (ex.: Asas de Amion da Fada) já são concedidas
      // automaticamente a toda a raça -- não podem ser "escolhidas" de novo
      // como recompensa de Ascensão.
      if (h.inata) continue
      if (!idsExcluidos.has(h.id)) candidatos.push({ origem: 'raca_global', id: h.id, nome: h.nome, descricao: h.descricao })
    }
    if (linhagem) {
      for (const h of raca?.habilidades_especificas || []) {
        if (h.linhagem_id === linhagem.id && !idsExcluidos.has(h.id)) {
          candidatos.push({ origem: 'raca_linhagem', id: h.id, nome: h.nome, descricao: h.descricao })
        }
      }
    }
  }
  return candidatos
}

const RÓTULO_ORIGEM = { classe: 'de Classe', raca: 'de Raça', classe_ou_raca: 'de Classe ou Raça' }
const NOMES_STATUS_DISTRIBUIVEIS = { vida: 'Vida', sanidade: 'Sanidade', arche: 'Arché', defesa: 'Defesa' }

// `recompensas` e' a lista COMPLETA do grau (habilidade + pericia_treinada
// juntas), mas so' os slots de tipo "habilidade" exigem escolha aqui --
// "Treinamento de Pericia" so' aparece como aviso informativo, porque o
// jogador ja pode treinar/destreinar pericias livremente direto na ficha
// (ver o toggle interativo em FichaVisual.jsx). Já os "Pontos Para
// Distribuir entre Status" (`pontosStatus`, ex.: 3) SÃO uma escolha
// obrigatória aqui -- ao contrário de perícia, não tem outro lugar na
// ficha onde o jogador possa aplicar esses pontos manualmente.
export default function RecompensasAscensao({
  personagemId,
  donoUid,
  grauAlvo,
  recompensas,
  pontosStatus = 0,
  raca,
  linhagem,
  classe,
  escolhas,
  onFinalizado,
}) {
  const slotsHabilidade = (recompensas || []).filter((r) => r.tipo === 'habilidade')
  const temPericiaInformativa = (recompensas || []).some((r) => r.tipo === 'pericia_treinada')

  const [picks, setPicks] = useState(() => slotsHabilidade.map(() => null))
  const [pontosDistribuidos, setPontosDistribuidos] = useState({ vida: 0, sanidade: 0, arche: 0, defesa: 0 })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)

  const habEscolhidasAtual = escolhas?.habilidades_escolhidas || {}
  const idsJaEscolhidos = new Set([
    ...(habEscolhidasAtual.raca_globais || []),
    ...(habEscolhidasAtual.raca_linhagem || []),
    ...(habEscolhidasAtual.classe || []),
  ])

  function definirPick(indice, candidato) {
    setPicks((prev) => {
      const novo = [...prev]
      novo[indice] = candidato
      return novo
    })
  }

  function ajustarPonto(statusNome, delta) {
    setPontosDistribuidos((prev) => {
      const novo = Math.max(0, prev[statusNome] + delta)
      return { ...prev, [statusNome]: novo }
    })
  }

  const totalDistribuido = Object.values(pontosDistribuidos).reduce((soma, n) => soma + n, 0)
  const pontosRestantes = pontosStatus - totalDistribuido
  const tudoPreenchido = picks.every(Boolean) && pontosRestantes === 0

  async function confirmar() {
    setEnviando(true)
    setErro(null)
    try {
      const { ok, dados } = await api.aplicarRecompensasAscensao({
        personagemId,
        donoUid,
        escolhasRecompensa: {
          habilidades: picks.map((p) => ({ origem: p.origem, id: p.id })),
          pontos_status: pontosDistribuidos,
        },
      })
      if (!ok || !dados?.sucesso) {
        setErro(dados?.erros?.[0] || 'Não foi possível aplicar as recompensas agora.')
        return
      }
      onFinalizado(dados)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="card-fantasy p-5">
      <p className="text-forest text-sm mb-1">Ascensão liberada para o Grau {grauAlvo}.</p>
      <p className="text-mist text-xs mb-5">
        {slotsHabilidade.length > 0
          ? 'Escolha a(s) habilidade(s) abaixo para efetivar a Ascensão.'
          : 'Nenhuma habilidade nova nesse grau — confirme para efetivar a Ascensão.'}
      </p>

      {temPericiaInformativa && (
        <p className="text-xs text-mist mb-5 border border-panel-border rounded px-3 py-2">
          Este grau também concede 1 Treinamento de Perícia. Não precisa escolher aqui — depois de
          efetivar, é só clicar na perícia desejada na sua ficha pra marcá-la como treinada.
        </p>
      )}

      {erro && <p className="text-blood-bright text-xs mb-4">{erro}</p>}

      <div className="flex flex-col gap-5">
        {pontosStatus > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-widest text-mist">
                Pontos para Distribuir entre Status
              </span>
              <span className={`text-xs font-display ${pontosRestantes === 0 ? 'text-forest' : 'text-gold'}`}>
                {pontosRestantes} restante{pontosRestantes === 1 ? '' : 's'} de {pontosStatus}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(NOMES_STATUS_DISTRIBUIVEIS).map(([chave, rotulo]) => (
                <div key={chave} className="stat-tile">
                  <span className="text-xs uppercase tracking-widest text-mist">{rotulo}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => ajustarPonto(chave, -1)}
                      disabled={enviando || pontosDistribuidos[chave] <= 0}
                      className="w-6 h-6 rounded border border-panel-border text-mist hover:border-white/30 disabled:opacity-30 text-sm leading-none"
                    >
                      −
                    </button>
                    <div className="font-display text-lg w-6 text-center">+{pontosDistribuidos[chave]}</div>
                    <button
                      type="button"
                      onClick={() => ajustarPonto(chave, 1)}
                      disabled={enviando || pontosRestantes <= 0}
                      className="w-6 h-6 rounded border border-panel-border text-mist hover:border-white/30 disabled:opacity-30 text-sm leading-none"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {slotsHabilidade.map((slot, indice) => {
          const idsPickadosEmOutrosSlots = new Set(
            picks.filter((p, i) => p && i !== indice).map((p) => p.id)
          )
          const candidatos = candidatosParaSlot(slot.origem, {
            raca, linhagem, classe,
            idsExcluidos: new Set([...idsJaEscolhidos, ...idsPickadosEmOutrosSlots]),
          })

          return (
            <div key={indice}>
              <div className="text-[11px] uppercase tracking-widest text-mist mb-2">
                Habilidade {RÓTULO_ORIGEM[slot.origem] || ''}
              </div>
              {candidatos.length === 0 ? (
                <p className="text-xs text-blood-bright">Nenhuma habilidade elegível restante nesse pool.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {candidatos.map((c) => {
                    const selecionado = picks[indice]?.id === c.id
                    return (
                      <button
                        key={`${c.origem}-${c.id}`}
                        onClick={() => definirPick(indice, c)}
                        disabled={enviando}
                        className={`text-left px-3 py-2 rounded border text-xs disabled:opacity-50
                          ${selecionado ? 'border-gold text-gold' : 'border-panel-border text-mist hover:border-white/30'}`}
                      >
                        <div className="font-display text-white text-sm mb-0.5">{c.nome}</div>
                        <p className="line-clamp-2">{c.descricao}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        <button
          className="btn-primary w-fit disabled:opacity-50"
          onClick={confirmar}
          disabled={enviando || !tudoPreenchido}
        >
          {enviando ? 'Efetivando Ascensão...' : 'Confirmar e Efetivar Ascensão'}
        </button>
      </div>
    </div>
  )
}
