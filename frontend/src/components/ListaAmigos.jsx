import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'
import { Link } from 'react-router-dom'

// Mesmo padrão do NotificacaoSino: autocontido, com a própria escuta em
// tempo real e o próprio estado de aberto/fechado -- só trocar
// <IconBtn><Users/></IconBtn> por <ListaAmigos/> no TopBar.
export default function ListaAmigos() {
  const { usuario } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [amigos, setAmigos] = useState([])
  const [processando, setProcessando] = useState(null)
  const [amigoExpandidoUid, setAmigoExpandidoUid] = useState(null)
  const [personagensPorAmigo, setPersonagensPorAmigo] = useState({})
  const [carregandoPersonagens, setCarregandoPersonagens] = useState(null)

  useEffect(() => {
    if (!usuario) return
    const q = query(collection(db, 'amizades'), where('uids', 'array-contains', usuario.uid))
    const cancelar = onSnapshot(q, (snap) => {
      const aceitas = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((a) => a.status === 'aceita')
        .map((a) => {
          const souSolicitante = a.solicitante_uid === usuario.uid
          return {
            amizadeId: a.id,
            uid: souSolicitante ? a.destinatario_uid : a.solicitante_uid,
            nome: souSolicitante ? a.destinatario_nome : a.solicitante_nome,
          }
        })
      setAmigos(aceitas)
    })
    return cancelar
  }, [usuario])

  async function desfazerAmizade(amizadeId) {
    setProcessando(amizadeId)
    try {
      await deleteDoc(doc(db, 'amizades', amizadeId))
    } catch (err) {
      console.error(err)
    } finally {
      setProcessando(null)
    }
  }

  async function alternarPersonagens(amigoUid) {
    if (amigoExpandidoUid === amigoUid) {
      setAmigoExpandidoUid(null)
      return
    }
    setAmigoExpandidoUid(amigoUid)
    if (personagensPorAmigo[amigoUid]) return

    setCarregandoPersonagens(amigoUid)
    try {
      // Listar (diferente de abrir UM personagem já visível) depende de
      // checar outro documento (a amizade), e uma consulta em lista no
      // Firestore não consegue provar essa condição só pelos filtros da
      // query -- por isso passa pelo endpoint, com Admin SDK do lado do
      // servidor, em vez de uma query direta como o resto deste arquivo.
      const { dados } = await api.buscarPersonagensVisiveisDeAmigo(amigoUid, usuario.uid)
      setPersonagensPorAmigo((prev) => ({
        ...prev,
        [amigoUid]: dados?.sucesso ? dados.itens : [],
      }))
    } catch (err) {
      console.error(err)
      setPersonagensPorAmigo((prev) => ({ ...prev, [amigoUid]: [] }))
    } finally {
      setCarregandoPersonagens(null)
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-10 h-10 rounded-md border border-panel-border flex items-center justify-center text-mist hover:text-white hover:border-white/30 transition-colors"
        aria-label="Amigos"
      >
        <Users size={18} />
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 top-12 z-50 w-80 card-fantasy p-4 max-h-[70vh] overflow-y-auto">
            <div className="text-xs uppercase tracking-widest text-mist mb-3">Amigos</div>
            {amigos.length === 0 ? (
              <p className="text-mist text-sm">
                Nenhum amigo ainda. Adicione um em Configurações, com o código dele.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {amigos.map((amigo) => (
                  <div key={amigo.amizadeId} className="border border-panel-border rounded p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <button
                        onClick={() => alternarPersonagens(amigo.uid)}
                        className="text-sm text-white hover:text-gold text-left"
                      >
                        {amigo.nome}
                      </button>
                      <button
                        onClick={() => desfazerAmizade(amigo.amizadeId)}
                        disabled={processando === amigo.amizadeId}
                        className="text-[11px] text-mist hover:text-blood-bright disabled:opacity-50 shrink-0"
                      >
                        Desfazer amizade
                      </button>
                    </div>

                    {amigoExpandidoUid === amigo.uid && (
                      <div className="flex flex-col gap-1.5 mt-2 pl-1">
                        {carregandoPersonagens === amigo.uid ? (
                          <p className="text-mist text-xs">Carregando...</p>
                        ) : (personagensPorAmigo[amigo.uid] || []).length === 0 ? (
                          <p className="text-mist text-xs">Nenhum personagem visível.</p>
                        ) : (
                          personagensPorAmigo[amigo.uid].map((p) => (
                            <Link
                              key={p.id}
                              to={`/personagens/${p.id}`}
                              onClick={() => setAberto(false)}
                              className="text-xs text-gold hover:underline"
                            >
                              {p.nome_personagem || 'Personagem sem nome'}
                            </Link>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
