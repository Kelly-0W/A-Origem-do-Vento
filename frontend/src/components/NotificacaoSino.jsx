import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'

// Autocontido de propósito: cuida do próprio estado (aberto/fechado) e da
// própria escuta em tempo real, então basta trocar o <IconBtn><Bell/></IconBtn>
// original por <NotificacaoSino /> no TopBar, sem precisar subir estado
// pra lá. Por enquanto só existe um tipo de notificação (pedido de
// amizade), mas a query já é "tudo que me foi endereçado" -- dá pra
// crescer pra outros tipos aqui dentro sem mudar como o TopBar usa isso.
export default function NotificacaoSino() {
  const { usuario } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [pedidos, setPedidos] = useState([])
  const [processando, setProcessando] = useState(null)

  useEffect(() => {
    if (!usuario) return
    // Só igualdade num campo só -- não precisa de índice composto (ver
    // o mesmo cuidado tomado em Combate.jsx com dono_uid).
    const q = query(collection(db, 'amizades'), where('destinatario_uid', '==', usuario.uid))
    const cancelar = onSnapshot(q, (snap) => {
      const pendentes = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((a) => a.status === 'pendente')
      setPedidos(pendentes)
    })
    return cancelar
  }, [usuario])

  async function aceitar(pedido) {
    setProcessando(pedido.id)
    try {
      await updateDoc(doc(db, 'amizades', pedido.id), {
        status: 'aceita',
        respondido_em: serverTimestamp(),
      })
    } catch (err) {
      console.error(err)
    } finally {
      setProcessando(null)
    }
  }

  async function recusar(pedido) {
    setProcessando(pedido.id)
    try {
      await deleteDoc(doc(db, 'amizades', pedido.id))
    } catch (err) {
      console.error(err)
    } finally {
      setProcessando(null)
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-10 h-10 rounded-md border border-panel-border flex items-center justify-center text-mist hover:text-white hover:border-white/30 transition-colors relative"
        aria-label="Notificações"
      >
        <Bell size={18} />
        {pedidos.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blood-bright text-white text-[10px] leading-[18px] text-center">
            {pedidos.length}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 top-12 z-50 w-80 card-fantasy p-4">
            <div className="text-xs uppercase tracking-widest text-mist mb-3">Solicitações de Amizade</div>
            {pedidos.length === 0 ? (
              <p className="text-mist text-sm">Nenhuma solicitação pendente.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {pedidos.map((pedido) => (
                  <div key={pedido.id} className="border border-panel-border rounded p-3">
                    <p className="text-sm mb-3">
                      <span className="text-white">{pedido.solicitante_nome}</span> quer ser seu amigo.
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="btn-primary text-xs flex-1 disabled:opacity-50"
                        onClick={() => aceitar(pedido)}
                        disabled={processando === pedido.id}
                      >
                        Aceitar
                      </button>
                      <button
                        className="btn-secondary text-xs flex-1 disabled:opacity-50"
                        onClick={() => recusar(pedido)}
                        disabled={processando === pedido.id}
                      >
                        Recusar
                      </button>
                    </div>
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
