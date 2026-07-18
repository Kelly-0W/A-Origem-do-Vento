import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'

const LIMITE_PREVIA = 3

export default function Dashboard() {
  const { usuario, carregando: carregandoAuth } = useAuth()
  const nome = usuario?.displayName || 'Aventureiro'
  const [personagens, setPersonagens] = useState([])
  const [racas, setRacas] = useState({})
  const [classes, setClasses] = useState({})
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (carregandoAuth || !usuario) return

    async function carregar() {
      setCarregando(true)
      try {
        const [racasResp, classesResp] = await Promise.all([
          api.buscarBiblioteca('racas'),
          api.buscarBiblioteca('classes'),
        ])
        setRacas(racasResp.dados?.itens ?? {})
        setClasses(classesResp.dados?.itens ?? {})

        const q = query(collection(db, 'personagens'), where('dono_uid', '==', usuario.uid))
        const snap = await getDocs(q)
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        lista.sort((a, b) => (b.atualizado_em?.seconds ?? 0) - (a.atualizado_em?.seconds ?? 0))
        setPersonagens(lista.slice(0, LIMITE_PREVIA))
      } catch (err) {
        console.error(err)
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [usuario, carregandoAuth])

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

      {carregando ? (
        <p className="text-mist text-sm">Carregando...</p>
      ) : personagens.length === 0 ? (
        <div className="card-fantasy p-8 text-mist text-sm">
          Nenhum personagem ainda.{' '}
          <Link to="/personagens/novo" className="text-gold">Forje o primeiro</Link>.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {personagens.map((p) => {
            const nomePersonagem = p.escolhas?.nome_personagem || 'Personagem sem nome'
            const raca = racas[p.escolhas?.raca_id]?.nome || p.escolhas?.raca_id
            const classe = classes[p.escolhas?.classe_id]?.nome || p.escolhas?.classe_id
            const vida = p.calculado?.status?.vida

            return (
              <Link key={p.id} to={`/personagens/${p.id}`} className="card-fantasy overflow-hidden hover:border-white/20 transition-colors">
                <div className="h-40 bg-panel-border/40 overflow-hidden flex items-center justify-center">
                  {p.imagem_base64 ? (
                    <img src={p.imagem_base64} alt={nomePersonagem} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-mist text-xs">Sem foto</span>
                  )}
                </div>
                <div className="p-4">
                  <div className="font-display font-semibold">{nomePersonagem}</div>
                  <div className="text-xs text-mist mb-2">{classe}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide text-mist">{raca}</span>
                    {vida != null && (
                      <span className="text-[11px] px-2 py-1 rounded border border-gold/40 text-gold">Vida {vida}</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
