import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutGrid, Users, BookOpen, Swords, Library, FlaskConical, Settings, Wind, LogOut, X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'

const ITENS = [
  { to: '/', label: 'Painel', icon: LayoutGrid, fim: true },
  { to: '/personagens', label: 'Personagens', icon: Users },
  { to: '/campanhas', label: 'Campanhas', icon: BookOpen },
  { to: '/combate', label: 'Combate', icon: Swords },
  { to: '/biblioteca', label: 'Biblioteca', icon: Library },
  { to: '/homebrew', label: 'Homebrew', icon: FlaskConical },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

// Em telas md+ funciona como sempre (coluna fixa, sempre visível). Abaixo
// de md vira um menu off-canvas: fica fora da tela (`-translate-x-full`)
// até `aberto` ficar true, quando desliza pra dentro -- controlado pelo
// botão de hambúrguer da TopBar, via AppLayout.
export default function Sidebar({ aberto, onFechar }) {
  const { usuario, sair } = useAuth()
  const navigate = useNavigate()
  const nome = usuario?.displayName || (usuario?.isAnonymous ? 'Visitante' : 'Aventureiro')

  async function aoSair() {
    await sair()
    navigate('/login')
  }

  return (
    <>
      {/* Fundo escurecido atrás do menu, só em mobile e só quando aberto */}
      {aberto && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={onFechar} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] border-r border-panel-border bg-void flex flex-col justify-between
          transition-transform duration-200 ease-out
          ${aberto ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:w-[319px] md:h-screen md:sticky md:top-0`}
      >
        <div>
          <div className="flex items-center justify-between gap-3 px-6 py-6 border-b border-panel-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full border border-gold/60 flex items-center justify-center text-gold shrink-0">
                <Wind size={18} />
              </div>
              <div className="leading-tight">
                <div className="font-display font-bold text-sm">A ORIGEM</div>
                <div className="font-display text-[11px] tracking-[0.2em] text-gold">DO VENTO</div>
              </div>
            </div>
            <button onClick={onFechar} className="text-mist hover:text-white md:hidden" aria-label="Fechar menu">
              <X size={20} />
            </button>
          </div>

          <nav className="flex flex-col gap-1 p-4">
            {ITENS.map(({ to, label, icon: Icon, fim }) => (
              <NavLink
                key={to}
                to={to}
                end={fim}
                onClick={onFechar}
                className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="px-6 py-6 border-t border-panel-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full border border-panel-border flex items-center justify-center text-sm font-display">
              {nome[0]?.toUpperCase()}
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-sm font-semibold truncate">{nome}</div>
              <div className="text-[11px] uppercase tracking-wide text-mist">
                {usuario?.isAnonymous ? 'Visitante' : 'Jogador'}
              </div>
            </div>
          </div>
          <button
            onClick={aoSair}
            className="flex items-center gap-2 text-xs text-mist hover:text-blood-bright transition-colors"
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>
    </>
  )
}
