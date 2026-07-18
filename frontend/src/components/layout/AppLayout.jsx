import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import TopBar from './TopBar.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import VincularContaModal from '../VincularContaModal.jsx'

export default function AppLayout() {
  const { usuario } = useAuth()
  const [modalAberto, setModalAberto] = useState(false)

  return (
    <div className="flex min-h-screen bg-void">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <TopBar />

        {usuario?.isAnonymous && (
          <div className="mx-8 mt-4 px-4 py-3 rounded-md border border-gold/40 bg-gold/5 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-xs text-mist">
              Você está testando como visitante. Seus personagens ficam só neste navegador até você salvar a conta.
            </span>
            <button onClick={() => setModalAberto(true)} className="btn-secondary text-xs shrink-0">
              Salvar minha conta
            </button>
          </div>
        )}

        <main className="px-8 pb-12 animate-fade-up">
          <Outlet />
        </main>
      </div>

      {modalAberto && <VincularContaModal onFechar={() => setModalAberto(false)} />}
    </div>
  )
}
