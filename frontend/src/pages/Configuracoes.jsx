import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { gerarCodigoConvite, normalizarCodigoConvite } from '../lib/codigoConvite.js'
import { idAmizade } from '../lib/amizade.js'
import ExcluirContaModal from '../components/ExcluirContaModal.jsx'

function rotuloProvedor(usuario) {
  if (usuario.isAnonymous) return 'Visitante (sem conta permanente)'
  if ((usuario.providerData || []).some((p) => p.providerId === 'google.com')) return 'Google'
  if ((usuario.providerData || []).some((p) => p.providerId === 'password')) return 'E-mail e senha'
  return 'Desconhecido'
}

// O id do documento de amizade é sempre determinístico (os dois uids
// ordenados, ver lib/amizade.js) -- então, SE o documento existir, o
// chamador sempre vai ser um dos dois participantes e a regra do
// Firestore sempre vai liberar a leitura. Um erro de permissão aqui só
// pode significar uma coisa: o documento ainda não existe (a regra nega
// leitura de um doc que não existe, porque não tem `uids` pra checar).
async function buscarAmizadeSeExistir(referencia) {
  try {
    const snap = await getDoc(referencia)
    return snap.exists() ? snap.data() : null
  } catch (err) {
    if (err.code === 'permission-denied') return null
    throw err
  }
}

export default function Configuracoes() {
  const { usuario } = useAuth()
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false)
  const [codigoAmizade, setCodigoAmizade] = useState(null)
  const [carregandoCodigo, setCarregandoCodigo] = useState(true)
  const [copiado, setCopiado] = useState(false)

  const [codigoDigitado, setCodigoDigitado] = useState('')
  const [enviandoSolicitacao, setEnviandoSolicitacao] = useState(false)
  const [mensagemSolicitacao, setMensagemSolicitacao] = useState(null)

  useEffect(() => {
    async function carregarOuCriarCodigo() {
      setCarregandoCodigo(true)
      try {
        const referencia = doc(db, 'usuarios', usuario.uid)
        const snap = await getDoc(referencia)
        const codigoExistente = snap.data()?.codigo_amizade

        if (codigoExistente) {
          setCodigoAmizade(codigoExistente)
          return
        }

        // Conta criada antes desse campo existir -- gera e grava agora,
        // na primeira vez que a pessoa visita Configurações.
        const novoCodigo = gerarCodigoConvite()
        await updateDoc(referencia, { codigo_amizade: novoCodigo, atualizado_em: serverTimestamp() })
        setCodigoAmizade(novoCodigo)
      } catch (err) {
        console.error(err)
      } finally {
        setCarregandoCodigo(false)
      }
    }
    carregarOuCriarCodigo()
  }, [usuario.uid])

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(codigoAmizade)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  async function enviarSolicitacaoAmizade() {
    const codigo = normalizarCodigoConvite(codigoDigitado)
    if (!codigo) return
    setEnviandoSolicitacao(true)
    setMensagemSolicitacao(null)
    try {
      const snap = await getDocs(
        query(collection(db, 'usuarios'), where('codigo_amizade', '==', codigo), limit(1))
      )
      if (snap.empty) {
        setMensagemSolicitacao({ tipo: 'erro', texto: 'Nenhum jogador encontrado com esse código.' })
        return
      }

      const destinatarioDoc = snap.docs[0]
      const destinatarioUid = destinatarioDoc.id
      const destinatarioNome = destinatarioDoc.data().nome || 'Aventureiro'

      if (destinatarioUid === usuario.uid) {
        setMensagemSolicitacao({ tipo: 'erro', texto: 'Esse é o seu próprio código.' })
        return
      }

      const referencia = doc(db, 'amizades', idAmizade(usuario.uid, destinatarioUid))
      const existente = await buscarAmizadeSeExistir(referencia)
      if (existente) {
        const jaAmigos = existente.status === 'aceita'
        setMensagemSolicitacao({
          tipo: 'erro',
          texto: jaAmigos ? 'Vocês já são amigos.' : 'Já existe uma solicitação pendente com essa pessoa.',
        })
        return
      }

      await setDoc(referencia, {
        uids: [usuario.uid, destinatarioUid],
        solicitante_uid: usuario.uid,
        solicitante_nome: usuario.displayName || 'Aventureiro',
        destinatario_uid: destinatarioUid,
        destinatario_nome: destinatarioNome,
        status: 'pendente',
        criado_em: serverTimestamp(),
        respondido_em: null,
      })

      setMensagemSolicitacao({ tipo: 'sucesso', texto: `Solicitação enviada para ${destinatarioNome}.` })
      setCodigoDigitado('')
    } catch (err) {
      console.error(err)
      setMensagemSolicitacao({ tipo: 'erro', texto: 'Não foi possível enviar a solicitação agora.' })
    } finally {
      setEnviandoSolicitacao(false)
    }
  }

  return (
    <div className="pt-2">
      <h1 className="text-3xl mb-1">Configurações</h1>
      <p className="text-mist mb-8">Sua conta e suas preferências.</p>

      <div className="card-fantasy p-6 mb-8 max-w-xl">
        <h2 className="font-display text-lg mb-4">Sua conta</h2>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-mist">Nome de exibição</span>
            <span>{usuario.displayName || '—'}</span>
          </div>
          {usuario.email && (
            <div className="flex justify-between">
              <span className="text-mist">E-mail</span>
              <span>{usuario.email}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-mist">Forma de login</span>
            <span>{rotuloProvedor(usuario)}</span>
          </div>
        </div>
      </div>

      <div className="card-fantasy p-6 mb-8 max-w-xl">
        <h2 className="font-display text-lg mb-2">Código de amizade</h2>
        <p className="text-mist text-sm mb-4">
          Compartilhe esse código pra alguém te enviar um pedido de amizade.
        </p>
        {carregandoCodigo ? (
          <p className="text-mist text-sm">Carregando...</p>
        ) : (
          <button
            onClick={copiarCodigo}
            className="font-display text-2xl tracking-[0.3em] px-4 py-2 rounded border border-gold/40 text-gold hover:border-gold/70 transition-colors"
          >
            {copiado ? 'Copiado!' : codigoAmizade}
          </button>
        )}
      </div>

      <div className="card-fantasy p-6 mb-8 max-w-xl">
        <h2 className="font-display text-lg mb-2">Adicionar amigo</h2>
        <p className="text-mist text-sm mb-4">Cole o código de amizade de outra pessoa pra mandar um pedido.</p>
        <div className="flex gap-3">
          <input
            value={codigoDigitado}
            onChange={(e) => setCodigoDigitado(e.target.value)}
            placeholder="Ex: 7XQ2FK"
            maxLength={6}
            className="campo-input uppercase tracking-widest flex-1"
          />
          <button
            className="btn-primary disabled:opacity-50 whitespace-nowrap"
            onClick={enviarSolicitacaoAmizade}
            disabled={enviandoSolicitacao || codigoDigitado.trim().length === 0}
          >
            {enviandoSolicitacao ? 'Enviando...' : 'Enviar Solicitação'}
          </button>
        </div>
        {mensagemSolicitacao && (
          <p className={`text-xs mt-3 ${mensagemSolicitacao.tipo === 'erro' ? 'text-blood-bright' : 'text-forest'}`}>
            {mensagemSolicitacao.texto}
          </p>
        )}
      </div>

      <div className="card-fantasy p-6 max-w-xl border-blood-bright/30">
        <h2 className="font-display text-lg mb-2 text-blood-bright">Zona de risco</h2>
        <p className="text-mist text-sm mb-4">
          Excluir sua conta apaga seus personagens e é permanente.
        </p>
        <button onClick={() => setModalExcluirAberto(true)} className="btn-primary">
          Excluir minha conta
        </button>
      </div>

      {modalExcluirAberto && <ExcluirContaModal onFechar={() => setModalExcluirAberto(false)} />}
    </div>
  )
}
