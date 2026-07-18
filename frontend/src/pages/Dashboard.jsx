import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function Dashboard() {
  const { usuario } = useAuth()
  const nome = usuario?.displayName || 'Aventureiro'
  const [personagens, setPersonagens] = useState([])

  useEffect(() => {
    // TODO: trocar por fetch real em /api/personagens (filtrado por usuario.uid) quando esse endpoint existir
    setPersonagens([])
  }, [])

  return (
    <div className="pt-2">
      <div className="flex items-start justify-between mb-10">
        <div>
          <div className="flex items-center gap-2 text-blood-bright text-xs uppercase tracking-widest mb-2">
            <Flame size={14} /> Bem-vindo de volta
          </div>
          <h1 className="text-4xl mb-3">{nome}, o vento sopra novamente</h1>
          <p className="text-mist max-w-2xl">
            O que vamos jogar hoje? Escolha um personagem, entre em uma campanha ou forje uma nova lenda.
          </p>
        </div>
        <Link to="/personagens/novo" className="btn-primary whitespace-nowrap">+ Novo Personagem</Link>
      </div>

      <div className="flex items-center justify-between border-b border-panel-border pb-2 mb-4">
        <h2 className="text-sm uppercase tracking-widest text-mist">Seus Personagens</h2>
        <Link to="/personagens" className="text-gold text-xs uppercase tracking-widest">Ver todos →</Link>
      </div>

      {personagens.length === 0 ? (
        <div className="card-fantasy p-8 text-mist text-sm">
          Nenhum personagem ainda.{' '}
          <Link to="/personagens/novo" className="text-gold">Forje o primeiro</Link>.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {personagens.map((p) => (
            <div key={p.id} className="card-fantasy overflow-hidden">
              <div className="h-40 bg-panel-border/40" />
              <div className="p-4">
                <div className="font-display font-semibold">{p.nome}</div>
                <div className="text-xs text-mist mb-2">Grau {p.grau_ascensao} · {p.classe}</div>
                <div className="text-[11px] uppercase tracking-wide text-mist">{p.raca}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
