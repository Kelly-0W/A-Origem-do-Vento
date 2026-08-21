import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import ResumoEscolhas from './ResumoEscolhas.jsx'
import FichaVisual from './FichaVisual.jsx'

function CardPersonagem({ item, catalogo, expandido, onAlternarExpandido, filho }) {
  const escolhas = item.escolhas || {}
  const raca = catalogo.racas?.[escolhas.raca_id] || null
  const linhagem = (raca?.linhagens || []).find((l) => l.id === escolhas.linhagem_id) || null
  const classe = catalogo.classes?.[escolhas.classe_id] || null
  const origem = catalogo.origens?.[escolhas.origem_id] || null
  const elemento = catalogo.elementos?.[escolhas.elemento_id] || null
  const isCaca = escolhas.elemento_id === 'caca'

  return (
    <div className="card-fantasy p-5">
      <button className="w-full flex items-center justify-between gap-3 text-left" onClick={onAlternarExpandido}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded border border-panel-border bg-void overflow-hidden shrink-0 flex items-center justify-center">
            {item.imagem_base64 ? (
              <img src={item.imagem_base64} alt={item.nome_personagem} className="w-full h-full object-cover" />
            ) : (
              <span className="text-mist text-[9px]">Sem foto</span>
            )}
          </div>
          <div>
            <div className="font-display font-semibold">{item.nome_personagem || 'Personagem sem nome'}</div>
            <div className="text-xs text-mist">
              {item.dono_nome || 'jogador desconhecido'} · Grau {item.grau_ascensao ?? 0}
            </div>
          </div>
        </div>
        <span className="text-mist text-xs shrink-0">{expandido ? 'Fechar ▲' : 'Ver ficha ▼'}</span>
      </button>

      {expandido && (
        <div className="mt-5 border-t border-panel-border pt-5">
          <ResumoEscolhas
            catalogo={catalogo}
            escolhas={escolhas}
            raca={raca}
            linhagem={linhagem}
            classe={classe}
            origem={origem}
            elemento={elemento}
            isCaca={isCaca}
          />
          {item.calculado && (
            <FichaVisual
              resultado={item.calculado}
              catalogo={catalogo}
              raca={raca}
              linhagem={linhagem}
              classe={classe}
              origem={origem}
              elemento={elemento}
              escolhas={escolhas}
              isCaca={isCaca}
              vidaAtual={item.vida_atual}
              sanidadeAtual={item.sanidade_atual}
              archeAtual={item.arche_atual}
              bonusDefesa={item.bonus_defesa}
              bonusDeslocamento={item.bonus_deslocamento}
              bonusVidaMaxima={item.bonus_vida_maxima}
              vidaTemporaria={item.vida_temporaria}
            />
          )}
        </div>
      )}

      {filho}
    </div>
  )
}

export default function PainelMestre({ campanhaId, mestreUid }) {
  const [catalogo, setCatalogo] = useState(null)
  const [itens, setItens] = useState([])
  const [jogadores, setJogadores] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [expandidoId, setExpandidoId] = useState(null)
  const [respondendoId, setRespondendoId] = useState(null)

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      if (!catalogo) {
        const colecoes = ['racas', 'classes', 'origens', 'elementos', 'pericias', 'sagracanticos']
        const respostas = await Promise.all(colecoes.map((c) => api.buscarBiblioteca(c)))
        const novoCatalogo = {}
        colecoes.forEach((c, i) => { novoCatalogo[c] = respostas[i].dados?.itens ?? {} })
        setCatalogo(novoCatalogo)
      }

      const { ok, dados } = await api.buscarPersonagensDaCampanhaComoMestre(campanhaId, mestreUid)
      if (!ok || !dados?.sucesso) {
        setErro(dados?.erros?.[0] || 'Não foi possível carregar os personagens da mesa.')
        return
      }
      setItens(dados.itens || [])
      setJogadores(dados.jogadores || [])
    } catch (err) {
      console.error(err)
      setErro('Não foi possível carregar os personagens da mesa.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanhaId, mestreUid])

  async function responder(personagemId, aprovar) {
    setRespondendoId(personagemId)
    try {
      const { ok, dados } = await api.responderAscensao({ mestreUid, campanhaId, personagemId, aprovar })
      if (!ok || !dados?.sucesso) {
        setErro(dados?.erros?.[0] || 'Não foi possível responder a esse pedido agora.')
        return
      }
      await carregar()
    } finally {
      setRespondendoId(null)
    }
  }

  if (carregando && itens.length === 0) {
    return <div className="text-mist text-sm">Carregando painel do mestre...</div>
  }

  const pendentes = itens.filter((i) => i.ascensao_em_progresso?.status === 'aguardando_mestre')

  return (
    <div className="mt-10">
      {erro && <p className="text-blood-bright text-xs mb-4">{erro}</p>}

      <h2 className="text-xl font-display mb-4">Jogadores da Mesa</h2>
      {jogadores.length === 0 ? (
        <div className="card-fantasy p-6 text-center text-mist text-sm mb-10">
          Ninguém entrou com o código de convite ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
          {jogadores.map((j) => (
            <div
              key={j.uid}
              className={`card-fantasy p-4 flex items-center justify-between gap-3 ${
                j.tem_personagem ? '' : 'border-gold/40'
              }`}
            >
              <span className="text-sm truncate">{j.nome || 'Jogador sem nome definido'}</span>
              {j.tem_personagem ? (
                <span className="text-[10px] uppercase tracking-widest text-forest shrink-0">
                  {j.quantidade_personagens > 1 ? `${j.quantidade_personagens} personagens` : '1 personagem'}
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-widest text-gold shrink-0">Sem personagem</span>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="text-xl font-display mb-4">Pedidos de Ascensão Pendentes</h2>
      {pendentes.length === 0 ? (
        <div className="card-fantasy p-6 text-center text-mist text-sm mb-10">Nenhum pedido pendente no momento.</div>
      ) : (
        <div className="flex flex-col gap-4 mb-10">
          {pendentes.map((item) => (
            <CardPersonagem
              key={item.id}
              item={item}
              catalogo={catalogo}
              expandido={expandidoId === item.id}
              onAlternarExpandido={() => setExpandidoId((atual) => (atual === item.id ? null : item.id))}
              filho={
                <div className="mt-4 border-t border-panel-border pt-4">
                  <p className="text-xs text-mist mb-3">
                    Pedido para o Grau {item.ascensao_em_progresso.grau_alvo}.
                    {item.ascensao_em_progresso.descricao_manifestacao && (
                      <>
                        {' '}Manifestação descrita: <span className="text-white">{item.ascensao_em_progresso.descricao_manifestacao}</span>
                      </>
                    )}
                  </p>
                  <div className="flex gap-3">
                    <button
                      className="btn-primary text-xs disabled:opacity-50"
                      onClick={() => responder(item.id, true)}
                      disabled={respondendoId === item.id}
                    >
                      {respondendoId === item.id ? 'Aprovando...' : 'Aprovar'}
                    </button>
                    <button
                      className="btn-secondary text-xs disabled:opacity-50"
                      onClick={() => responder(item.id, false)}
                      disabled={respondendoId === item.id}
                    >
                      {respondendoId === item.id ? 'Recusando...' : 'Recusar'}
                    </button>
                  </div>
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
