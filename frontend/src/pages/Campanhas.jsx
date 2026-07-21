import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { redimensionarImagem } from '../lib/imagem.js'
import { gerarCodigoConvite, normalizarCodigoConvite } from '../lib/codigoConvite.js'
import ModalBase from '../components/ModalBase.jsx'

async function buscarCampanhasDoUsuario(uid) {
  const [comoMestre, comoJogador] = await Promise.all([
    getDocs(query(collection(db, 'campanhas'), where('mestre_id', '==', uid))),
    getDocs(query(collection(db, 'campanhas'), where('jogadores_uids', 'array-contains', uid))),
  ])
  const mapa = new Map()
  comoMestre.docs.forEach((d) => mapa.set(d.id, { id: d.id, ...d.data() }))
  comoJogador.docs.forEach((d) => mapa.set(d.id, { id: d.id, ...d.data() }))
  return Array.from(mapa.values()).sort(
    (a, b) => (b.atualizado_em?.seconds ?? 0) - (a.atualizado_em?.seconds ?? 0)
  )
}

function ModalNovaCampanha({ usuario, onFechar, onCriada }) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [imagemBase64, setImagemBase64] = useState(null)
  const [aceitaSagracanticos, setAceitaSagracanticos] = useState(false)
  const [processandoImagem, setProcessandoImagem] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  async function selecionarImagem(evento) {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return
    if (!arquivo.type.startsWith('image/')) {
      setErro('Escolha um arquivo de imagem.')
      return
    }
    setErro(null)
    setProcessandoImagem(true)
    try {
      setImagemBase64(await redimensionarImagem(arquivo))
    } catch (err) {
      console.error(err)
      setErro('Não foi possível processar essa imagem.')
    } finally {
      setProcessandoImagem(false)
    }
  }

  async function criar() {
    if (!nome.trim()) return
    setSalvando(true)
    setErro(null)
    try {
      const referencia = doc(collection(db, 'campanhas'))
      const dados = {
        nome: nome.trim(),
        descricao: descricao.trim(),
        imagem_base64: imagemBase64,
        mestre_id: usuario.uid,
        jogadores_uids: [],
        codigo_convite: gerarCodigoConvite(),
        // Flag informativa (NÃO é uma trava dura -- ver PainelAscensao/
        // CharacterWizard): o Mestre pode topar um Sagracântico avulso
        // mesmo com isso desmarcado, ex. um amigo extra entrando na mesa.
        aceita_sagracanticos: aceitaSagracanticos,
        criado_em: serverTimestamp(),
        atualizado_em: serverTimestamp(),
      }
      await setDoc(referencia, dados)
      onCriada({ id: referencia.id, ...dados })
    } catch (err) {
      console.error(err)
      setErro('Não foi possível criar a campanha agora.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <ModalBase titulo="Nova Campanha" onFechar={onFechar}>
      <label className="flex flex-col gap-1.5 mb-4">
        <span className="text-[11px] uppercase tracking-widest text-mist">Nome</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="O nome da sua mesa" className="campo-input" />
      </label>

      <label className="flex flex-col gap-1.5 mb-4">
        <span className="text-[11px] uppercase tracking-widest text-mist">Descrição</span>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Do que se trata essa campanha"
          rows={3}
          className="campo-input resize-y"
        />
      </label>

      <label className="flex flex-col gap-1.5 mb-5">
        <span className="text-[11px] uppercase tracking-widest text-mist">Imagem de capa</span>
        <input type="file" accept="image/*" onChange={selecionarImagem} disabled={processandoImagem} className="text-xs text-mist" />
      </label>

      <label className="flex items-start gap-2 mb-5 cursor-pointer">
        <input
          type="checkbox"
          checked={aceitaSagracanticos}
          onChange={(e) => setAceitaSagracanticos(e.target.checked)}
          className="mt-1"
        />
        <span className="text-xs text-mist">
          Esta campanha aceita Sagracânticos (Arautos de um deus). Isso é só um aviso pros jogadores — não impede
          ninguém de trazer um Sagracântico mesmo desmarcado, ex. um amigo extra entrando na mesa depois.
        </span>
      </label>

      {erro && <p className="text-blood-bright text-xs mb-4">{erro}</p>}

      <button
        className="btn-primary w-full disabled:opacity-50"
        onClick={criar}
        disabled={salvando || processandoImagem || nome.trim().length === 0}
      >
        {salvando ? 'Criando...' : 'Criar Campanha'}
      </button>
    </ModalBase>
  )
}

function ModalEntrarComCodigo({ usuario, onFechar, onEntrou }) {
  const [codigo, setCodigo] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [erro, setErro] = useState(null)

  async function entrar() {
    const codigoNormalizado = normalizarCodigoConvite(codigo)
    if (!codigoNormalizado) return
    setEntrando(true)
    setErro(null)
    try {
      const snap = await getDocs(query(collection(db, 'campanhas'), where('codigo_convite', '==', codigoNormalizado)))
      if (snap.empty) {
        setErro('Nenhuma campanha encontrada com esse código.')
        return
      }
      const campanhaDoc = snap.docs[0]
      const campanha = campanhaDoc.data()
      if (campanha.mestre_id === usuario.uid || (campanha.jogadores_uids || []).includes(usuario.uid)) {
        setErro('Você já faz parte dessa campanha.')
        return
      }
      await updateDoc(doc(db, 'campanhas', campanhaDoc.id), {
        jogadores_uids: arrayUnion(usuario.uid),
        atualizado_em: serverTimestamp(),
      })
      onEntrou({ id: campanhaDoc.id, ...campanha, jogadores_uids: [...(campanha.jogadores_uids || []), usuario.uid] })
    } catch (err) {
      console.error(err)
      setErro('Não foi possível entrar na campanha agora.')
    } finally {
      setEntrando(false)
    }
  }

  return (
    <ModalBase titulo="Entrar com Código" onFechar={onFechar}>
      <label className="flex flex-col gap-1.5 mb-5">
        <span className="text-[11px] uppercase tracking-widest text-mist">Código de convite</span>
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Ex: 7XQ2FK"
          className="campo-input uppercase tracking-widest"
          maxLength={6}
        />
      </label>

      {erro && <p className="text-blood-bright text-xs mb-4">{erro}</p>}

      <button
        className="btn-primary w-full disabled:opacity-50"
        onClick={entrar}
        disabled={entrando || codigo.trim().length === 0}
      >
        {entrando ? 'Entrando...' : 'Entrar na Campanha'}
      </button>
    </ModalBase>
  )
}

function CardCampanha({ campanha, uid }) {
  const ehMestre = campanha.mestre_id === uid
  const [codigoCopiado, setCodigoCopiado] = useState(false)

  async function copiarCodigo(e) {
    e.preventDefault() // não deixa o clique "vazar" pro Link por trás do botão
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(campanha.codigo_convite)
      setCodigoCopiado(true)
      setTimeout(() => setCodigoCopiado(false), 2000)
    } catch {
      setCodigoCopiado(false)
    }
  }

  return (
    <Link to={`/campanhas/${campanha.id}`} className="card-fantasy p-5 flex gap-4 hover:border-white/20 transition-colors">
      <div className="w-16 h-16 rounded border border-panel-border bg-void overflow-hidden shrink-0 flex items-center justify-center">
        {campanha.imagem_base64 ? (
          <img src={campanha.imagem_base64} alt={campanha.nome} className="w-full h-full object-cover" />
        ) : (
          <span className="text-mist text-[10px] text-center px-1">Sem capa</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="font-display font-semibold truncate">{campanha.nome}</div>
          <span className="shrink-0 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border border-gold/40 text-gold">
            {ehMestre ? 'Mestre' : 'Jogador'}
          </span>
        </div>
        {campanha.descricao && <p className="text-xs text-mist mb-3 line-clamp-2">{campanha.descricao}</p>}
        <p className="text-xs text-mist mb-2">{(campanha.jogadores_uids || []).length} jogador(es)</p>
        {ehMestre && (
          <button onClick={copiarCodigo} className="text-[11px] px-2 py-1 rounded border border-panel-border text-mist hover:border-white/30">
            {codigoCopiado ? 'Copiado!' : `Código: ${campanha.codigo_convite}`}
          </button>
        )}
      </div>
    </Link>
  )
}

export default function Campanhas() {
  const { usuario, carregando: carregandoAuth } = useAuth()
  const [campanhas, setCampanhas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [modalAberto, setModalAberto] = useState(null)

  useEffect(() => {
    if (carregandoAuth || !usuario) return

    async function carregar() {
      setCarregando(true)
      setErro(null)
      try {
        setCampanhas(await buscarCampanhasDoUsuario(usuario.uid))
      } catch (err) {
        console.error(err)
        setErro('Não foi possível carregar suas campanhas agora.')
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [usuario, carregandoAuth])

  function aoCriar(novaCampanha) {
    setCampanhas((prev) => [novaCampanha, ...prev])
    setModalAberto(null)
  }

  function aoEntrar(campanha) {
    setCampanhas((prev) => [campanha, ...prev.filter((c) => c.id !== campanha.id)])
    setModalAberto(null)
  }

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl mb-1">Campanhas</h1>
          <p className="text-mist">Mundos aguardando seus heróis.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary" onClick={() => setModalAberto('entrar')}>Entrar com Código</button>
          <button className="btn-primary" onClick={() => setModalAberto('nova')}>+ Nova Campanha</button>
        </div>
      </div>

      {carregando ? (
        <p className="text-mist text-sm">Carregando...</p>
      ) : erro ? (
        <div className="card-fantasy p-10 text-center text-blood-bright text-sm">{erro}</div>
      ) : campanhas.length === 0 ? (
        <div className="card-fantasy p-10 text-center text-mist">
          Nenhuma campanha ainda. Crie uma ou entre em uma existente com um código de convite.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {campanhas.map((c) => (
            <CardCampanha key={c.id} campanha={c} uid={usuario.uid} />
          ))}
        </div>
      )}

      {modalAberto === 'nova' && (
        <ModalNovaCampanha usuario={usuario} onFechar={() => setModalAberto(null)} onCriada={aoCriar} />
      )}
      {modalAberto === 'entrar' && (
        <ModalEntrarComCodigo usuario={usuario} onFechar={() => setModalAberto(null)} onEntrou={aoEntrar} />
      )}
    </div>
  )
}