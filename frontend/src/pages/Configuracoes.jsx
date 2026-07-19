import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import ExcluirContaModal from '../components/ExcluirContaModal.jsx'

function rotuloProvedor(usuario) {
  if (usuario.isAnonymous) return 'Visitante (sem conta permanente)'
  if ((usuario.providerData || []).some((p) => p.providerId === 'google.com')) return 'Google'
  if ((usuario.providerData || []).some((p) => p.providerId === 'password')) return 'E-mail e senha'
  return 'Desconhecido'
}

export default function Configuracoes() {
  const { usuario } = useAuth()
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false)

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
