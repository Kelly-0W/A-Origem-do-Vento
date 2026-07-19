import { useState } from 'react'
import { ATRIBUTOS, NOMES_ATRIBUTOS, ABREV_ATRIBUTOS } from '../lib/constantes.js'
import { nomePericia } from '../lib/formato.js'
import { api } from '../lib/api.js'
import ModalBase from './ModalBase.jsx'
import PoderDetalhe from './PoderDetalhe.jsx'

const NOMES_STATUS = { vida: 'Vida', sanidade: 'Sanidade', arche: 'Arché', defesa: 'Defesa' }

// Ficha visual pós-cálculo -- troca o JSON cru de `resultado` por blocos no
// mesmo design system já usado no passo de Atributos (`stat-tile`). Usada
// tanto logo após calcular no Wizard quanto na tela de detalhe do
// personagem (a partir do `calculado` já salvo no Firestore), e também no
// Painel do Mestre (lá, sempre como leitura -- ver prop `interativo`).
// Cada poder é clicável e abre o mesmo card de detalhe mecânico usado na
// Biblioteca.
//
// `interativo`/`personagemId`/`donoUid`/`onAtualizado` só fazem sentido na
// tela do PRÓPRIO personagem: quando `interativo` é true, cada perícia vira
// clicável pra marcar/desmarcar treinamento manualmente (cobre casos como
// uma habilidade de raça que "dá treinamento" mas que o motor não aplica
// sozinho), uma perícia já treinada ganha um botão extra "+2" pra marcar
// que foi RETREINADA (bônus fixo, não escala com o grau), e cada perícia
// tem um seletor de atributo-base pra cobrir habilidades que TROCAM qual
// atributo uma perícia usa (ex.: uma habilidade de Orc que muda Guerra de
// Inteligência pra Força -- o catálogo não tem como saber disso sozinho).
// Cada mudança chama de novo o mesmo endpoint de cálculo (mandando
// `pericias_manuais` dentro de `escolhas`), que já salva a ficha
// atualizada sozinho -- por isso não precisa de nenhum updateDoc extra aqui.
export default function FichaVisual({
  resultado,
  catalogo,
  elemento,
  escolhas,
  isCaca,
  interativo = false,
  personagemId = null,
  donoUid = null,
  onAtualizado = null,
}) {
  const [poderAberto, setPoderAberto] = useState(null)
  const [periciaProcessando, setPericiaProcessando] = useState(null)
  const [erroPericia, setErroPericia] = useState(null)

  const { status, atributos_finais, pericias, grau_ascensao } = resultado
  const ataqueDesarmado = status?.ataque_desarmado
  const bonusAtaqueDesarmado = ataqueDesarmado ? (atributos_finais?.[ataqueDesarmado.atributo] ?? 0) : 0

  const periciasOrdenadas = Object.entries(pericias || {}).sort(([, a], [, b]) => b.bonus_total - a.bonus_total)

  const poderesResolvidos = (escolhas.poderes_escolhidos || []).map((id) => elemento?.poderes?.[id]).filter(Boolean)
  const espiritual = escolhas.espiritual_escolhido ? elemento?.espirituais?.[escolhas.espiritual_escolhido] : null

  async function ajustarPericia(periciaId, ajuste) {
    if (!interativo || periciaProcessando) return
    setPericiaProcessando(periciaId)
    setErroPericia(null)
    try {
      const novasEscolhas = {
        ...escolhas,
        pericias_manuais: { ...(escolhas.pericias_manuais || {}), [periciaId]: ajuste },
      }
      const { ok, dados } = await api.calcularFicha(novasEscolhas, {
        grauAscensao: grau_ascensao,
        donoUid,
        personagemId,
      })
      if (!ok || !dados?.sucesso) {
        setErroPericia(dados?.erros?.[0] || 'Não foi possível atualizar essa perícia agora.')
        return
      }
      onAtualizado?.(dados.calculado, novasEscolhas)
    } catch (err) {
      console.error(err)
      setErroPericia('Não foi possível atualizar essa perícia agora.')
    } finally {
      setPericiaProcessando(null)
    }
  }

  function aoClicarPericia(periciaId, p) {
    // Alterna treinada; ao desmarcar, zera junto os retreinos (não existe
    // "retreinado, mas não treinado"). Preserva o override de atributo,
    // se houver -- destreinar não deveria resetar isso silenciosamente.
    ajustarPericia(periciaId, {
      treinada: !p.treinada,
      retreinos: p.treinada ? 0 : p.retreinos,
      atributo: p.atributo !== p.atributo_padrao ? p.atributo : null,
    })
  }

  function aoMudarRetreino(e, periciaId, p, delta) {
    e.stopPropagation() // não deixa o clique "vazar" pro toggle de treinada por trás
    if (!p.treinada) return
    ajustarPericia(periciaId, { treinada: true, retreinos: Math.max(0, p.retreinos + delta), atributo: p.atributo !== p.atributo_padrao ? p.atributo : null })
  }

  function aoMudarAtributo(e, periciaId, p, novoAtributo) {
    e.stopPropagation() // não deixa o clique "vazar" pro toggle de treinada por trás
    // novoAtributo === '' significa "voltar pro padrão do catálogo" (manda
    // null pro backend, que ignora override ausente/inválido).
    ajustarPericia(periciaId, { treinada: p.treinada, retreinos: p.retreinos, atributo: novoAtributo || null })
  }

  return (
    <div className="mt-8">
      <div className="text-forest font-display mb-4">Ficha calculada — Grau de Ascensão {grau_ascensao}</div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {['vida', 'sanidade', 'arche', 'defesa'].map((chave) => (
          <div key={chave} className="stat-tile">
            <span className="text-xs uppercase tracking-widest text-mist">{NOMES_STATUS[chave]}</span>
            <div className="font-display text-lg mt-1">{status[chave]}</div>
          </div>
        ))}
        <div className="stat-tile">
          <span className="text-xs uppercase tracking-widest text-mist">Deslocamento</span>
          <div className="font-display text-lg mt-1">{status.deslocamento_m}m</div>
        </div>
      </div>

      {ataqueDesarmado && (
        <p className="text-sm text-mist mb-6">
          Ataque desarmado: <span className="text-white">{ataqueDesarmado.dano}{bonusAtaqueDesarmado >= 0 ? '+' : ''}{bonusAtaqueDesarmado} ({ataqueDesarmado.tipo_dano})</span>
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {ATRIBUTOS.map((a) => (
          <div key={a} className="stat-tile">
            <span className="text-xs uppercase tracking-widest text-mist">{NOMES_ATRIBUTOS[a]}</span>
            <div className="font-display text-lg mt-1">{atributos_finais[a] >= 0 ? '+' : ''}{atributos_finais[a]}</div>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-widest text-mist">Perícias</div>
          {interativo && (
            <div className="text-[11px] text-mist">
              Clique pra treinar/destreinar · <span className="text-gold">+</span> soma um retreino (+2 cada, sem limite) ·
              atributo é trocável (ex.: habilidades que mudam o atributo-base de uma perícia)
            </div>
          )}
        </div>
        {erroPericia && <p className="text-blood-bright text-xs mb-2">{erroPericia}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {periciasOrdenadas.map(([id, p]) => {
            const processando = periciaProcessando === id
            const atributoAlterado = p.atributo !== p.atributo_padrao
            const conteudo = (
              <>
                <span className="flex items-center gap-1.5">
                  {nomePericia(catalogo, id)}
                  {interativo ? (
                    <select
                      value={p.atributo}
                      onChange={(e) => aoMudarAtributo(e, id, p, e.target.value === p.atributo_padrao ? '' : e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={processando}
                      title="Trocar o atributo-base desta perícia"
                      className={`text-[9px] rounded border bg-transparent leading-none py-0.5 px-1 cursor-pointer
                        ${atributoAlterado ? 'border-gold/50 text-gold' : 'border-panel-border/70 text-mist'}`}
                    >
                      {ATRIBUTOS.map((a) => (
                        <option key={a} value={a} className="bg-void text-white">
                          {ABREV_ATRIBUTOS[a]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    atributoAlterado && (
                      <span
                        title={`Atributo-base trocado de ${NOMES_ATRIBUTOS[p.atributo_padrao]} pra ${NOMES_ATRIBUTOS[p.atributo]}`}
                        className="text-[9px] px-1 rounded border border-gold/50 text-gold leading-none py-0.5"
                      >
                        {ABREV_ATRIBUTOS[p.atributo]}
                      </span>
                    )
                  )}
                  {p.retreinos > 0 && (
                    <span className="text-[9px] px-1 rounded-full border border-gold/50 text-gold leading-none py-0.5">
                      +{p.retreinos * 2}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  {interativo && p.treinada && (
                    <span className="flex items-center gap-0.5">
                      {p.retreinos > 0 && (
                        <button
                          type="button"
                          onClick={(e) => aoMudarRetreino(e, id, p, -1)}
                          disabled={processando}
                          title="Remover um retreino (-2)"
                          className="text-[10px] w-4 h-4 rounded-full border border-panel-border text-mist hover:border-blood-bright/50 hover:text-blood-bright leading-none flex items-center justify-center transition-colors"
                        >
                          −
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => aoMudarRetreino(e, id, p, 1)}
                        disabled={processando}
                        title="Adicionar um retreino (+2, sem limite)"
                        className="text-[10px] w-4 h-4 rounded-full border border-panel-border text-mist hover:border-gold/50 hover:text-gold leading-none flex items-center justify-center transition-colors"
                      >
                        +
                      </button>
                    </span>
                  )}
                  <span>{p.bonus_total >= 0 ? '+' : ''}{p.bonus_total}</span>
                </span>
              </>
            )
            const classeBase = `text-xs px-3 py-2 rounded border flex items-center justify-between transition-colors
              ${p.treinada ? 'border-gold/50 text-gold' : 'border-panel-border text-mist'}
              ${interativo ? 'hover:border-white/40 cursor-pointer' : ''}
              ${processando ? 'opacity-50' : ''}`

            return interativo ? (
              <button key={id} type="button" onClick={() => aoClicarPericia(id, p)} disabled={processando} className={classeBase}>
                {conteudo}
              </button>
            ) : (
              <div key={id} className={classeBase}>
                {conteudo}
              </div>
            )
          })}
        </div>
      </div>

      {isCaca ? (
        espiritual && (
          <div>
            <div className="text-xs uppercase tracking-widest text-mist mb-3">Espiritual</div>
            <div className="card-fantasy p-4">
              <div className="font-display font-semibold mb-1">{espiritual.nome}</div>
              <p className="text-xs text-mist mb-2">{(espiritual.bonus_transformacao || []).join(' · ')}</p>
              {espiritual.poder_tribal && (
                <button
                  onClick={() => setPoderAberto(espiritual.poder_tribal)}
                  className="text-xs text-gold text-left hover:underline"
                >
                  {espiritual.poder_tribal.nome}: <span className="text-mist">{espiritual.poder_tribal.descricao}</span>
                </button>
              )}
            </div>
          </div>
        )
      ) : (
        poderesResolvidos.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-widest text-mist mb-3">Poderes</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {poderesResolvidos.map((poder) => (
                <button
                  key={poder.nome}
                  onClick={() => setPoderAberto(poder)}
                  className="text-left card-fantasy p-4 hover:border-white/20 transition-colors"
                >
                  <div className="font-display font-semibold mb-1">{poder.nome}</div>
                  <p className="text-xs text-mist mb-2">{poder.descricao}</p>
                  <span className="inline-block text-[11px] px-2 py-1 rounded border border-gold/40 text-gold">
                    Custo: {poder.custo_arche} Arché
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
      )}

      {poderAberto && (
        <ModalBase onFechar={() => setPoderAberto(null)}>
          <PoderDetalhe p={poderAberto} />
        </ModalBase>
      )}
    </div>
  )
}
