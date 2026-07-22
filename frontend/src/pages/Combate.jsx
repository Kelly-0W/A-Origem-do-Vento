import { useEffect, useState } from 'react'
import {
  collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'
import ModalBase from '../components/ModalBase.jsx'
import { participanteDePersonagem, participanteDeMonstro } from '../lib/combate.js'

const ROTULO_STATUS = { preparando: 'Preparando', em_andamento: 'Em andamento', encerrado: 'Encerrado' }
const ROTULO_TIPO = { personagem: 'Personagem', monstro: 'Monstro', npc: 'NPC' }

function ModalNovoEncontro({ campanhas, onFechar, onCriado }) {
  const [campanhaId, setCampanhaId] = useState(campanhas[0]?.id || '')
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  async function criar() {
    if (!nome.trim() || !campanhaId) return
    setSalvando(true)
    setErro(null)
    try {
      const campanha = campanhas.find((c) => c.id === campanhaId)
      const referencia = doc(collection(db, 'encontros'))
      const dados = {
        campanha_id: campanhaId,
        campanha_nome: campanha?.nome || null,
        mestre_id: campanha.mestre_id,
        nome: nome.trim(),
        status: 'preparando',
        participantes: [],
        criado_em: serverTimestamp(),
        atualizado_em: serverTimestamp(),
      }
      await setDoc(referencia, dados)
      onCriado({ id: referencia.id, ...dados })
    } catch (err) {
      console.error(err)
      setErro('Não foi possível criar o encontro agora.')
    } finally {
      setSalvando(false)
    }
  }

  if (campanhas.length === 0) {
    return (
      <ModalBase titulo="Novo Encontro" onFechar={onFechar}>
        <p className="text-mist text-sm">
          Você precisa ser mestre de ao menos uma campanha pra criar um encontro.
        </p>
      </ModalBase>
    )
  }

  return (
    <ModalBase titulo="Novo Encontro" onFechar={onFechar}>
      <label className="flex flex-col gap-1.5 mb-4">
        <span className="text-[11px] uppercase tracking-widest text-mist">Campanha</span>
        <select value={campanhaId} onChange={(e) => setCampanhaId(e.target.value)} className="campo-input">
          {campanhas.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 mb-5">
        <span className="text-[11px] uppercase tracking-widest text-mist">Nome do encontro</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Emboscada na Estrada" className="campo-input" />
      </label>

      {erro && <p className="text-blood-bright text-xs mb-4">{erro}</p>}

      <button className="btn-primary w-full disabled:opacity-50" onClick={criar} disabled={salvando || !nome.trim()}>
        {salvando ? 'Criando...' : 'Criar Encontro'}
      </button>
    </ModalBase>
  )
}

function ModalAdicionarPersonagens({ encontro, mestreUid, onFechar, onAdicionados }) {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [itens, setItens] = useState([])
  const [selecionados, setSelecionados] = useState([])
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      setErro(null)
      try {
        const { dados } = await api.buscarPersonagensDaCampanhaComoMestre(encontro.campanha_id, mestreUid)
        if (!dados?.sucesso) {
          setErro('Não foi possível carregar os personagens da campanha.')
          return
        }
        const idsJaAdicionados = new Set(
          encontro.participantes.filter((p) => p.tipo === 'personagem').map((p) => p.ref_id)
        )
        setItens(dados.itens.filter((item) => !idsJaAdicionados.has(item.id)))
      } catch (err) {
        console.error(err)
        setErro('Não foi possível carregar os personagens da campanha.')
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [encontro.campanha_id, mestreUid])

  function alternar(id) {
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function adicionar() {
    setSalvando(true)
    try {
      const novos = itens.filter((item) => selecionados.includes(item.id)).map(participanteDePersonagem)
      const participantes = [...encontro.participantes, ...novos]
      await updateDoc(doc(db, 'encontros', encontro.id), { participantes, atualizado_em: serverTimestamp() })
      onAdicionados(participantes)
    } catch (err) {
      console.error(err)
      setErro('Não foi possível adicionar os personagens agora.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <ModalBase titulo="Adicionar Personagens" onFechar={onFechar}>
      {carregando ? (
        <p className="text-mist text-sm">Carregando...</p>
      ) : erro ? (
        <p className="text-blood-bright text-sm">{erro}</p>
      ) : itens.length === 0 ? (
        <p className="text-mist text-sm">Todos os personagens da campanha já estão neste encontro.</p>
      ) : (
        <>
          <div className="flex flex-col gap-2 mb-5 max-h-80 overflow-y-auto">
            {itens.map((item) => {
              const marcado = selecionados.includes(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => alternar(item.id)}
                  className={`text-left p-3 rounded border flex items-center justify-between gap-3 transition-colors
                    ${marcado ? 'border-gold' : 'border-panel-border hover:border-white/20'}`}
                >
                  <div>
                    <div className="font-display text-sm">{item.nome_personagem || 'Personagem sem nome'}</div>
                    <div className="text-xs text-mist">{item.dono_nome || 'jogador desconhecido'}</div>
                  </div>
                  {marcado && <span className="text-gold text-xs shrink-0">Selecionado</span>}
                </button>
              )
            })}
          </div>
          <button className="btn-primary w-full disabled:opacity-50" onClick={adicionar} disabled={salvando || selecionados.length === 0}>
            {salvando ? 'Adicionando...' : `Adicionar ${selecionados.length || ''}`.trim()}
          </button>
        </>
      )}
    </ModalBase>
  )
}

function ModalAdicionarMonstro({ encontro, onFechar, onAdicionados }) {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [bestiario, setBestiario] = useState({})
  const [monstroId, setMonstroId] = useState(null)
  const [quantidade, setQuantidade] = useState(1)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      setErro(null)
      try {
        const { dados } = await api.buscarBiblioteca('bestiario')
        if (!dados?.sucesso) {
          setErro('Não foi possível carregar o bestiário.')
          return
        }
        setBestiario(dados.itens)
      } catch (err) {
        console.error(err)
        setErro('Não foi possível carregar o bestiário.')
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [])

  async function adicionar() {
    if (!monstroId) return
    setSalvando(true)
    try {
      const monstro = bestiario[monstroId]
      const novos = Array.from({ length: quantidade }, (_, i) =>
        participanteDeMonstro(monstro, monstroId, i + 1, quantidade)
      )
      const participantes = [...encontro.participantes, ...novos]
      await updateDoc(doc(db, 'encontros', encontro.id), { participantes, atualizado_em: serverTimestamp() })
      onAdicionados(participantes)
    } catch (err) {
      console.error(err)
      setErro('Não foi possível adicionar o monstro agora.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <ModalBase titulo="Adicionar Monstro do Bestiário" onFechar={onFechar}>
      {carregando ? (
        <p className="text-mist text-sm">Carregando...</p>
      ) : erro ? (
        <p className="text-blood-bright text-sm">{erro}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 mb-5 max-h-72 overflow-y-auto">
            {Object.entries(bestiario).map(([id, m]) => (
              <button
                key={id}
                onClick={() => setMonstroId(id)}
                className={`text-left p-3 rounded border transition-colors
                  ${monstroId === id ? 'border-gold' : 'border-panel-border hover:border-white/20'}`}
              >
                <div className="font-display text-sm">{m.nome}</div>
                <div className="text-[11px] text-mist capitalize">{m.categoria} · {m.elemento}</div>
              </button>
            ))}
          </div>

          {monstroId && (
            <div className="flex items-center gap-4 mb-5">
              <span className="text-[11px] uppercase tracking-widest text-mist">Quantidade</span>
              <div className="flex items-center gap-3">
                <button className="w-7 h-7 rounded border border-panel-border text-white" onClick={() => setQuantidade((q) => Math.max(1, q - 1))}>-</button>
                <span className="font-display text-lg w-6 text-center">{quantidade}</span>
                <button className="w-7 h-7 rounded border border-panel-border text-white" onClick={() => setQuantidade((q) => Math.min(20, q + 1))}>+</button>
              </div>
            </div>
          )}

          <button className="btn-primary w-full disabled:opacity-50" onClick={adicionar} disabled={salvando || !monstroId}>
            {salvando ? 'Adicionando...' : 'Adicionar ao Encontro'}
          </button>
        </>
      )}
    </ModalBase>
  )
}

function CardParticipante({ participante, onRemover }) {
  return (
    <div className="card-fantasy p-4 relative">
      <button
        onClick={onRemover}
        className="absolute top-2 right-2 text-mist hover:text-blood-bright text-sm leading-none"
        aria-label="Remover"
      >
        ×
      </button>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded border border-panel-border bg-void overflow-hidden shrink-0 flex items-center justify-center">
          {participante.imagem_base64 ? (
            <img src={participante.imagem_base64} alt={participante.nome} className="w-full h-full object-cover" />
          ) : (
            <span className="text-mist text-[9px]">—</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="font-display text-sm truncate">{participante.nome}</div>
          <div className="text-[11px] text-mist">
            {ROTULO_TIPO[participante.tipo]}{participante.dono_nome ? ` · ${participante.dono_nome}` : ''}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px] text-mist">
        <span>Vida: <span className="text-white">{participante.vida_atual}/{participante.vida_maxima}</span></span>
        <span>Defesa: <span className="text-white">{participante.defesa + (participante.bonus_defesa || 0)}</span></span>
        <span>Sanidade: <span className="text-white">{participante.sanidade_atual}/{participante.sanidade_maxima}</span></span>
        <span>Arché: <span className="text-white">{participante.arche_atual}/{participante.arche_maximo}</span></span>
      </div>
    </div>
  )
}

export default function Combate() {
  const { usuario, carregando: carregandoAuth } = useAuth()
  const [campanhas, setCampanhas] = useState([])
  const [encontros, setEncontros] = useState([])
  const [encontroSelecionadoId, setEncontroSelecionadoId] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [modalAberto, setModalAberto] = useState(null)

  useEffect(() => {
    if (carregandoAuth || !usuario) return

    async function carregar() {
      setCarregando(true)
      setErro(null)
      try {
        const [campanhasSnap, encontrosSnap] = await Promise.all([
          getDocs(query(collection(db, 'campanhas'), where('mestre_id', '==', usuario.uid))),
          getDocs(query(collection(db, 'encontros'), where('mestre_id', '==', usuario.uid))),
        ])
        setCampanhas(campanhasSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setEncontros(encontrosSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error(err)
        setErro('Não foi possível carregar seus encontros agora.')
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [usuario, carregandoAuth])

  const encontroSelecionado = encontros.find((e) => e.id === encontroSelecionadoId) || null

  function atualizarEncontroLocal(id, participantes) {
    setEncontros((prev) => prev.map((e) => (e.id === id ? { ...e, participantes } : e)))
  }

  function aoCriarEncontro(novo) {
    setEncontros((prev) => [novo, ...prev])
    setEncontroSelecionadoId(novo.id)
    setModalAberto(null)
  }

  async function removerParticipante(participanteId) {
    if (!encontroSelecionado) return
    const participantes = encontroSelecionado.participantes.filter((p) => p.id !== participanteId)
    atualizarEncontroLocal(encontroSelecionado.id, participantes)
    try {
      await updateDoc(doc(db, 'encontros', encontroSelecionado.id), { participantes, atualizado_em: serverTimestamp() })
    } catch (err) {
      console.error(err)
    }
  }

  async function excluirEncontro(id) {
    try {
      await deleteDoc(doc(db, 'encontros', id))
      setEncontros((prev) => prev.filter((e) => e.id !== id))
      if (encontroSelecionadoId === id) setEncontroSelecionadoId(null)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl mb-1">Combate</h1>
          <p className="text-mist">Rastreie iniciativas, turnos e a fúria da batalha.</p>
        </div>
        <button className="btn-primary" onClick={() => setModalAberto('novo_encontro')}>⚔ Novo Encontro</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <div className="card-fantasy p-5">
          <div className="text-xs uppercase tracking-widest text-mist mb-3">Encontros</div>
          {carregando ? (
            <p className="text-sm text-mist">Carregando...</p>
          ) : erro ? (
            <p className="text-sm text-blood-bright">{erro}</p>
          ) : encontros.length === 0 ? (
            <p className="text-sm text-mist">Nenhum encontro criado.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {encontros.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setEncontroSelecionadoId(e.id)}
                  className={`text-left p-3 rounded border transition-colors
                    ${e.id === encontroSelecionadoId ? 'border-gold' : 'border-panel-border hover:border-white/20'}`}
                >
                  <div className="font-display text-sm">{e.nome}</div>
                  <div className="text-[11px] text-mist">{e.campanha_nome} · {ROTULO_STATUS[e.status]}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {!encontroSelecionado ? (
          <div className="card-fantasy p-5 flex items-center justify-center text-mist text-sm min-h-[240px]">
            Selecione ou crie um encontro para começar.
          </div>
        ) : (
          <div className="card-fantasy p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-xl">{encontroSelecionado.nome}</h2>
                <p className="text-mist text-xs">{encontroSelecionado.campanha_nome} · {ROTULO_STATUS[encontroSelecionado.status]}</p>
              </div>
              <button
                className="text-xs text-blood-bright hover:underline"
                onClick={() => excluirEncontro(encontroSelecionado.id)}
              >
                Excluir encontro
              </button>
            </div>

            <div className="flex flex-wrap gap-3 my-5">
              <button className="btn-secondary" onClick={() => setModalAberto('adicionar_personagens')}>+ Personagens</button>
              <button className="btn-secondary" onClick={() => setModalAberto('adicionar_monstro')}>+ Monstro do Bestiário</button>
              <button className="btn-secondary opacity-50 cursor-not-allowed" disabled title="Depende da aba de NPC / Homebrew, ainda não implementada">
                + NPC (em breve)
              </button>
            </div>

            {encontroSelecionado.participantes.length === 0 ? (
              <p className="text-mist text-sm">Nenhum participante ainda. Adicione personagens ou monstros acima.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {encontroSelecionado.participantes.map((p) => (
                  <CardParticipante key={p.id} participante={p} onRemover={() => removerParticipante(p.id)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {modalAberto === 'novo_encontro' && (
        <ModalNovoEncontro campanhas={campanhas} onFechar={() => setModalAberto(null)} onCriado={aoCriarEncontro} />
      )}
      {modalAberto === 'adicionar_personagens' && encontroSelecionado && (
        <ModalAdicionarPersonagens
          encontro={encontroSelecionado}
          mestreUid={usuario.uid}
          onFechar={() => setModalAberto(null)}
          onAdicionados={(participantes) => {
            atualizarEncontroLocal(encontroSelecionado.id, participantes)
            setModalAberto(null)
          }}
        />
      )}
      {modalAberto === 'adicionar_monstro' && encontroSelecionado && (
        <ModalAdicionarMonstro
          encontro={encontroSelecionado}
          onFechar={() => setModalAberto(null)}
          onAdicionados={(participantes) => {
            atualizarEncontroLocal(encontroSelecionado.id, participantes)
            setModalAberto(null)
          }}
        />
      )}
    </div>
  )
}
