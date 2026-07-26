import { Menu, ShieldQuestion, Users } from 'lucide-react'
import NotificacaoSino from './NotificacaoSino.jsx'

function IconBtn({ children }) {
  return (
    <button className="w-10 h-10 rounded-md border border-panel-border flex items-center justify-center text-mist hover:text-white hover:border-white/30 transition-colors shrink-0">
      {children}
    </button>
  )
}

export default function TopBar({ onAbrirMenu }) {
  return (
    <>
      <div className="h-[3px] bg-gradient-to-r from-blood-dark via-blood-bright to-blood-dark" />
      <header className="flex items-center justify-between md:justify-end gap-3 px-4 sm:px-8 py-6">
        <button
          onClick={onAbrirMenu}
          className="w-10 h-10 rounded-md border border-panel-border flex items-center justify-center text-mist hover:text-white hover:border-white/30 transition-colors md:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-3">
          <a
            href="mailto:aorigemdovento@gmail.com"
            className="w-10 h-10 rounded-md border border-panel-border flex items-center justify-center text-mist hover:text-white hover:border-white/30 transition-colors shrink-0"
            aria-label="Suporte"
          >
            <ShieldQuestion size={18} />
          </a>
          <NotificacaoSino />
          <IconBtn><Users size={18} /></IconBtn>
        </div>
      </header>
    </>
  )
}
