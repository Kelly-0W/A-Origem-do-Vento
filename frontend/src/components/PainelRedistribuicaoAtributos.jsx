import { useState } from 'react'
import { ATRIBUTOS, NOMES_ATRIBUTOS } from '../lib/constantes.js'
import { api } from '../lib/api.js'

const TOTAL_PONTOS = 10
const ATRIBUTO_MINIMO = -1
const ATRIBUTO_MAXIMO = 3

// Pedido de redistribuição de atributos-base -- espelha exatamente a regra
// de criação (10 pontos somados entre os 6, cada um de -1 a 3), só que
// depois de já ter personagem pronto. O jogador propõe, mas só vira ficha
// de verdade quando o Mestre aprova (ver PainelMestre.jsx) -- este painel
// nunca escreve direto em `escolhas`/`calculado`, só no pedido pendente.
export default function PainelRedistribuicaoAtributos({ personagemId, donoUid, atributosAtuais, pedido, onAtualizado }) {
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState(() => ({ ...atributosAtuais }))
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)

  const status = pedido?.status || 'nenhuma'

  function iniciarEdicao() {
    setRascunho({ ...atributosAtuais })
    setMotivo('')
    setErro(null)
    setEditando(true)
  }

  function ajustar(atributo, delta) {
    setRascunho((prev) => {
      const novo = Math.max(ATRIBUTO_MINIMO, Math.min(ATRIBUTO_MAXIMO, prev[atributo] + delta))
      return { ...prev, [atributo]: novo }
    })
  }

  const totalDistribuido = Object.values(rascunho).reduce((soma, n) => soma + n, 0)
  const pontosRestantes = TOTAL_PONTOS - totalDistribuido

  async function enviarPedido() {
    if (pontosRestantes !== 0) return
    setEnviando(true)
    setErro(null)
    try {
      const { ok, dados } = await api.solicitarRedistribuicaoAtributos({
        personagemId,
        donoUid,
        atributosPropostos: rascunho,
        motivo,
      })
      if (!ok || !dados?.sucesso) {
        setErro(dados?.erros?.[0] || 'Não foi possível enviar o pedido agora.')
        return
      }
      onAtualizado?.({
        status: 'aguardando_mestre',
        atributos_propostos: rascunho,
        motivo,
      })
      setEditando(false)
    } catch (err) {
      console.error(err)
      setErro('Não foi possível enviar o pedido agora.')
    } finally {
      setEnviando(false)
    }
  }

  if (status === 'aguardando_mestre') {
    return (
      <div className="card-fantasy p-5 mt-6">
        <p className="text-gold text-sm mb-2">Pedido de redistribuição de atributos aguardando o Mestre.</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-2">
          {ATRIBUTOS.map((a) => (
            <div key={a} className="stat-tile text-center">
              <span className="text-[10px] uppercase tracking-widest text-mist">{NOMES_ATRIBUTOS[a]}</span>
              <div className="font-display text-lg">
                {atributosAtuais[a]} <span className="text-mist text-sm">→</span> {pedido.atributos_propostos[a]}
              </div>
            </div>
          ))}
        </div>
        {pedido.motivo && <p className="text-xs text-mist italic">&ldquo;{pedido.motivo}&rdquo;</p>}
      </div>
    )
  }

  return (
    <div className="card-fantasy p-5 mt-6">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="font-display text-white">Redistribuir Atributos</h3>
        {!editando && (
          <button className="btn-secondary text-xs" onClick={iniciarEdicao}>
            Solicitar
          </button>
        )}
      </div>

      {status === 'recusada' && !editando && (
        <p className="text-blood-bright text-xs mb-2">
          Seu último pedido foi recusado pelo Mestre. Você pode ajustar e enviar de novo.
        </p>
      )}

      {!editando && (
        <p className="text-xs text-mist">
          Reorganiza os mesmos 10 pontos entre os 6 atributos-base, sem mudar o total gasto. Só vale depois
          que o Mestre aprovar.
        </p>
      )}

      {editando && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-widest text-mist">Distribuição proposta</span>
            <span className={`text-xs font-display ${pontosRestantes === 0 ? 'text-forest' : 'text-gold'}`}>
              {pontosRestantes} restante{pontosRestantes === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            {ATRIBUTOS.map((a) => (
              <div key={a} className="stat-tile">
                <span className="text-xs uppercase tracking-widest text-mist">{NOMES_ATRIBUTOS[a]}</span>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => ajustar(a, -1)}
                    disabled={enviando || rascunho[a] <= ATRIBUTO_MINIMO}
                    className="w-6 h-6 rounded border border-panel-border text-mist hover:border-white/30 disabled:opacity-30 text-sm leading-none"
                  >
                    −
                  </button>
                  <div className="font-display text-lg w-6 text-center">{rascunho[a]}</div>
                  <button
                    type="button"
                    onClick={() => ajustar(a, 1)}
                    disabled={enviando || rascunho[a] >= ATRIBUTO_MAXIMO}
                    className="w-6 h-6 rounded border border-panel-border text-mist hover:border-white/30 disabled:opacity-30 text-sm leading-none"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <label className="flex flex-col gap-1.5 mb-3">
            <span className="text-[11px] uppercase tracking-widest text-mist">Motivo (opcional)</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por que quer mudar? (ajuda o Mestre a decidir)"
              rows={2}
              className="campo-input w-full resize-y"
            />
          </label>

          {erro && <p className="text-blood-bright text-xs mb-2">{erro}</p>}

          <div className="flex items-center gap-3">
            <button
              className="btn-primary disabled:opacity-50"
              onClick={enviarPedido}
              disabled={enviando || pontosRestantes !== 0}
            >
              {enviando ? 'Enviando...' : 'Enviar Pedido'}
            </button>
            <button className="text-xs text-mist hover:text-white" onClick={() => setEditando(false)} disabled={enviando}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
