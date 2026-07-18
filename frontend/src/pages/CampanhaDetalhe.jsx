import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import ModalBase from '../components/ModalBase.jsx'
import PainelMestre from '../components/PainelMestre.jsx'

// Lista, dentro do modal, os personagens do próprio jogador que AINDA não
// estão nessa campanha -- escolher um chama `onAdicionar`, que faz o
// arrayUnion em campanhas_ids (ver CampanhaDetalhe abaixo).
function ModalAdicionarPersonagem({ usuario, idsNaCampanha, onFechar, onAdicionar }) {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [personagens, setPersonagens] = useState([])
  const [adicionandoId, setAdicionandoId] = useState(null)

  useEffect(() => {
    async function carregar() {
      try {
        const snap = await getDocs(query(collection(db, 'personagens'), where('dono_uid', '==', usuario.uid)))
        const lista = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p) => !idsNaCampanha.includes(p.id))
        setPersonagens(lista)
      } catch (err) {
        console.error(err)
        setErro('Não foi possível carregar seus personagens agora.')
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [])

  async function escolher(personagemId) {
    setAdicionandoId(personagemId)
    try {
      await onAdicionar(personagemId)
    } finally {
      setAdicionandoId(null)
    }
  }

  return (
    <ModalBase titulo="Adicionar Personagem" onFechar={onFechar}>
      {carregando ? (
        <p className="text-mist text-sm">Carregando...</p>
      ) : erro ? (
        <p className="text-blood-bright text-xs">{erro}</p>
      ) : personagens.length === 0 ? (
        <p className="text-mist text-sm">
          Todos os seus personagens já estão nessa campanha, ou você ainda não criou nenhum.{' '}
          <Link to="/personagens/novo" className="text-gold">Forje um novo</Link>.
        </p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {personagens.map((p) => (
            <button
              key={p.id}
              onClick={() => escolher(p.id)}
              disabled={adicionandoId === p.id}
              className="w-full text-left px-3 py-2 rounded border border-panel-border hover:border-gold/50 text-sm flex items-center justify-between disabled:opacity-50"
            >
              <span>{p.escolhas?.nome_personagem || 'Personagem sem nome'}</span>
              <span className="text-mist text-xs">{adicionandoId === p.id ? 'Adicionando...' : 'Adicionar'}</span>
            </button>
          ))}
        </div>
      )}
    </ModalBase>
  )
}

export default function CampanhaDetalhe() {
  const { id } = useParams()
  const { usuario } = useAuth()

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [campanha, setCampanha] = useState(null)
  const [personagensDaCampanha, setPersonagensDaCampanha] = useState([])
  const [modalAberto, setModalAberto] = useState(false)
  const [codigoCopiado, setCodigoCopiado] = useState(false)

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      const snap = await getDoc(doc(db, 'campanhas', id))
      if (!snap.exists()) {
        setErro('Campanha não encontrada.')
        return
      }
      const dadosCampanha = { id: snap.id, ...snap.data() }
      const souMembro = dadosCampanha.mestre_id === usuario.uid || (dadosCampanha.jogadores_uids || []).includes(usuario.uid)
      if (!souMembro) {
        setErro('Você não faz parte dessa campanha. Peça o código de convite a quem é o mestre.')
        return
      }
      setCampanha(dadosCampanha)

      // Só os personagens do PRÓPRIO jogador vinculados a essa campanha --
      // ver a ficha de outros jogadores é trabalho do Painel do Mestre
      // (fase seguinte), não dessa tela.
      const q = query(
        collection(db, 'personagens'),
        where('dono_uid', '==', usuario.uid),
        where('campanhas_ids', 'array-contains', id)
      )
      const personagensSnap = await getDocs(q)
      setPersonagensDaCampanha(personagensSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
      setErro('Não foi possível carregar essa campanha agora.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (usuario) carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, usuario])

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(campanha.codigo_convite)
      setCodigoCopiado(true)
      setTimeout(() => setCodigoCopiado(false), 2000)
    } catch {
      setCodigoCopiado(false)
    }
  }

  async function adicionarPersonagemExistente(personagemId) {
    await updateDoc(doc(db, 'personagens', personagemId), {
      campanhas_ids: arrayUnion(id),
      atualizado_em: serverTimestamp(),
    })
    setModalAberto(false)
    await carregar()
  }

  if (carregando) {
    return <div className="pt-10 text-mist">Carregando campanha...</div>
  }

  if (erro) {
    return (
      <div className="pt-2">
        <Link to="/campanhas" className="flex items-center gap-1 text-mist text-sm mb-6 hover:text-white w-fit">
          <ChevronLeft size={16} /> Voltar
        </Link>
        <div className="card-fantasy p-10 text-center text-blood-bright text-sm">{erro}</div>
      </div>
    )
  }

  const ehMestre = campanha.mestre_id === usuario.uid

  return (
    <div className="pt-2">
      <Link to="/campanhas" className="flex items-center gap-1 text-mist text-sm mb-6 hover:text-white w-fit">
        <ChevronLeft size={16} /> Voltar
      </Link>

      <div className="flex flex-col sm:flex-row gap-6 mb-10">
        <div className="w-24 h-24 rounded-lg border border-panel-border bg-void overflow-hidden shrink-0 flex items-center justify-center">
          {campanha.imagem_base64 ? (
            <img src={campanha.imagem_base64} alt={campanha.nome} className="w-full h-full object-cover" />
          ) : (
            <span className="text-mist text-xs text-center px-2">Sem capa</span>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl">{campanha.nome}</h1>
            <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border border-gold/40 text-gold">
              {ehMestre ? 'Mestre' : 'Jogador'}
            </span>
          </div>
          {campanha.descricao && <p className="text-mist mb-3 max-w-xl">{campanha.descricao}</p>}
          {ehMestre && (
            <button onClick={copiarCodigo} className="text-[11px] px-2 py-1 rounded border border-panel-border text-mist hover:border-white/30">
              {codigoCopiado ? 'Copiado!' : `Código de convite: ${campanha.codigo_convite}`}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-xl font-display">Seus personagens nessa campanha</h2>
        <div className="flex gap-3">
          <button className="btn-secondary" onClick={() => setModalAberto(true)}>Adicionar Personagem</button>
          <Link to={`/personagens/novo?campanha=${id}`} className="btn-primary">Criar Personagem</Link>
        </div>
      </div>

      {personagensDaCampanha.length === 0 ? (
        <div className="card-fantasy p-10 text-center text-mist">
          Nenhum personagem seu nessa campanha ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {personagensDaCampanha.map((p) => (
            <Link key={p.id} to={`/personagens/${p.id}`} className="card-fantasy p-5 flex gap-4 hover:border-white/20 transition-colors">
              <div className="w-14 h-14 rounded border border-panel-border bg-void overflow-hidden shrink-0 flex items-center justify-center">
                {p.imagem_base64 ? (
                  <img src={p.imagem_base64} alt={p.escolhas?.nome_personagem} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-mist text-[10px]">Sem foto</span>
                )}
              </div>
              <div>
                <div className="font-display font-semibold mb-1">{p.escolhas?.nome_personagem || 'Personagem sem nome'}</div>
                {p.calculado?.status?.vida != null && (
                  <span className="inline-block text-[11px] px-2 py-1 rounded border border-gold/40 text-gold">
                    Vida {p.calculado.status.vida}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {modalAberto && (
        <ModalAdicionarPersonagem
          usuario={usuario}
          idsNaCampanha={personagensDaCampanha.map((p) => p.id)}
          onFechar={() => setModalAberto(false)}
          onAdicionar={adicionarPersonagemExistente}
        />
      )}

      {ehMestre && <PainelMestre campanhaId={id} mestreUid={usuario.uid} />}
    </div>
  )
}
