import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import BibliotecaDetalhe from '../components/BibliotecaDetalhe.jsx'
import ExplicacaoPericias from '../components/ExplicacaoPericias.jsx'

const ABAS = [
  { id: 'racas', label: 'Raças' },
  { id: 'classes', label: 'Classes' },
  { id: 'origens', label: 'Origens' },
  { id: 'elementos', label: 'Poderes' },
  { id: 'itens', label: 'Itens' },
  { id: 'pericias', label: 'Perícias' },
  { id: 'bestiario', label: 'Bestiário' },
]

export default function Biblioteca() {
  const [aba, setAba] = useState('racas')
  const [busca, setBusca] = useState('')
  const [itens, setItens] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [selecionado, setSelecionado] = useState(null) // { id, item }

  useEffect(() => {
    setCarregando(true)
    api.buscarBiblioteca(aba).then(({ dados }) => {
      setItens(dados?.itens ?? {})
      setCarregando(false)
    })
  }, [aba])

  // A troca de aba fecha o detalhe aberto, pra evitar mostrar um item
  // de uma coleção diferente da que está sendo exibida.
  useEffect(() => {
    setSelecionado(null)
  }, [aba])

  const entradas = Object.entries(itens).filter(([, item]) =>
    (item.nome || '').toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="pt-2">
      <h1 className="text-3xl mb-1">Biblioteca</h1>
      <p className="text-mist mb-6">Catálogo de raças, classes, poderes, artefatos e criaturas do mundo.</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`px-4 py-2 rounded-md text-xs uppercase tracking-widest border
              ${aba === a.id ? 'border-blood-bright text-white bg-blood-dark/30' : 'border-panel-border text-mist'}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'pericias' && !carregando && <ExplicacaoPericias pericias={itens} />}

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar..."
        className="w-full bg-panel border border-panel-border rounded-md px-4 py-3 mb-6 text-sm outline-none focus:border-gold/50"
      />

      {carregando ? (
        <p className="text-mist text-sm">Carregando...</p>
      ) : entradas.length === 0 ? (
        <p className="text-mist text-sm">Nada encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {entradas.map(([id, item]) => (
            <button
              key={id}
              onClick={() => setSelecionado({ id, item })}
              className="card-fantasy p-5 text-left hover:border-gold/50 transition-colors duration-150 cursor-pointer"
            >
              {aba === 'bestiario' && item.categoria && (
                <span className="inline-block text-[10px] uppercase tracking-widest text-gold border border-gold/40 rounded px-2 py-0.5 mb-2">
                  {item.categoria}
                </span>
              )}
              <div className="font-display font-semibold mb-2">{item.nome}</div>
              <p className="text-xs text-mist line-clamp-3">
                {item.descricao_curta || item.descricao || item.comportamento_e_alvo_prioritario || ''}
              </p>
            </button>
          ))}
        </div>
      )}

      <BibliotecaDetalhe
        colecao={aba}
        item={selecionado?.item}
        onFechar={() => setSelecionado(null)}
      />
    </div>
  )
}
