import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'

export default function Personagens() {
  const { usuario, carregando: carregandoAuth } = useAuth()
  const [personagens, setPersonagens] = useState([])
  const [racas, setRacas] = useState({})
  const [classes, setClasses] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (carregandoAuth || !usuario) return

    async function carregar() {
      setCarregando(true)
      setErro(null)
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
        // ordena por atualizado_em (mais recente primeiro) no cliente, pra
        // não depender de índice composto do Firestore (where + orderBy em
        // campos diferentes exige criar um índice manualmente).
        lista.sort((a, b) => (b.atualizado_em?.seconds ?? 0) - (a.atualizado_em?.seconds ?? 0))
        setPersonagens(lista)
      } catch (err) {
        setErro('Não foi possível carregar seus personagens agora.')
        console.error(err)
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [usuario, carregandoAuth])

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl mb-1">Personagens</h1>
          <p className="text-mist">Suas lendas em andamento.</p>
        </div>
        <Link to="/personagens/novo" className="btn-primary">+ Novo Personagem</Link>
      </div>

      {carregando ? (
        <p className="text-mist text-sm">Carregando...</p>
      ) : erro ? (
        <div className="card-fantasy p-10 text-center text-blood-bright text-sm">{erro}</div>
      ) : personagens.length === 0 ? (
        <div className="card-fantasy p-10 text-center text-mist">
          Nenhum personagem criado ainda.{' '}
          <Link to="/personagens/novo" className="text-gold">Forje o primeiro</Link>.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {personagens.map((p) => {
            const nome = p.escolhas?.nome_personagem || 'Personagem sem nome'
            const raca = racas[p.escolhas?.raca_id]?.nome || p.escolhas?.raca_id
            const classe = classes[p.escolhas?.classe_id]?.nome || p.escolhas?.classe_id
            const vida = p.calculado?.status?.vida

            return (
              <Link key={p.id} to={`/personagens/${p.id}`} className="card-fantasy p-5 flex gap-4 hover:border-white/20 transition-colors">
                <div className="w-14 h-14 rounded border border-panel-border bg-void overflow-hidden shrink-0 flex items-center justify-center">
                  {p.imagem_base64 ? (
                    <img src={p.imagem_base64} alt={nome} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-mist text-[10px]">Sem foto</span>
                  )}
                </div>
                <div>
                  <div className="font-display font-semibold mb-1">{nome}</div>
                  <div className="text-xs text-mist mb-3">
                    {raca}{classe ? ` · ${classe}` : ''}
                  </div>
                  {vida != null && (
                    <span className="inline-block text-[11px] px-2 py-1 rounded border border-gold/40 text-gold">
                      Vida {vida}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
