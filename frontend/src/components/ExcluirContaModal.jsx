import { useState } from 'react'
import { Chrome } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import ModalBase from './ModalBase.jsx'

const TEXTO_CONFIRMACAO = 'EXCLUIR'

function traduzirErro(codigo) {
  const mapa = {
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'Senha incorreta.',
    'auth/popup-closed-by-user': 'Confirmação cancelada.',
    'auth/requires-recent-login': 'Por segurança, confirme sua identidade de novo antes de excluir a conta.',
  }
  return mapa[codigo] || 'Algo deu errado. Tente novamente.'
}

export default function ExcluirContaModal({ onFechar }) {
  const { usuario, reautenticarComSenha, reautenticarComGoogle, excluirConta } = useAuth()
  const navigate = useNavigate()

  const usaSenha = (usuario.providerData || []).some((p) => p.providerId === 'password')
  const usaGoogle = (usuario.providerData || []).some((p) => p.providerId === 'google.com')
  // Visitante (conta anônima) não tem credencial nenhuma pra reconfirmar --
  // pula direto pra etapa de confirmação por texto.
  const precisaReautenticar = !usuario.isAnonymous

  const [reautenticado, setReautenticado] = useState(!precisaReautenticar)
  const [senha, setSenha] = useState('')
  const [textoConfirmacao, setTextoConfirmacao] = useState('')
  const [erro, setErro] = useState(null)
  const [processando, setProcessando] = useState(false)

  async function aoConfirmarSenha(e) {
    e.preventDefault()
    setErro(null)
    setProcessando(true)
    try {
      await reautenticarComSenha(senha)
      setReautenticado(true)
    } catch (err) {
      setErro(traduzirErro(err.code))
    } finally {
      setProcessando(false)
    }
  }

  async function aoConfirmarGoogle() {
    setErro(null)
    setProcessando(true)
    try {
      await reautenticarComGoogle()
      setReautenticado(true)
    } catch (err) {
      setErro(traduzirErro(err.code))
    } finally {
      setProcessando(false)
    }
  }

  async function aoExcluir() {
    setErro(null)
    setProcessando(true)
    try {
      await excluirConta()
      navigate('/login')
    } catch (err) {
      setErro(err.message || 'Não foi possível excluir a conta agora.')
      setProcessando(false)
    }
  }

  return (
    <ModalBase titulo="Excluir sua conta" onFechar={onFechar}>
      <div className="text-sm text-mist mb-6 flex flex-col gap-2">
        <p>Isso é permanente e não dá pra desfazer. Ao excluir sua conta:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Todos os seus personagens são apagados.</li>
          <li>Campanhas em que você é mestre são apagadas — os jogadores saem delas, mas mantêm os próprios personagens.</li>
          <li>Você sai de campanhas em que só é jogador (elas continuam existindo pros outros).</li>
        </ul>
      </div>

      {erro && (
        <p className="text-blood-bright text-xs border border-blood-bright/40 rounded-md px-3 py-2 mb-4">
          {erro}
        </p>
      )}

      {!reautenticado && usaSenha && (
        <form onSubmit={aoConfirmarSenha} className="flex flex-col gap-4 mb-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-widest text-mist">Confirme sua senha</span>
            <input
              required
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className="campo-input"
            />
          </label>
          <button type="submit" disabled={processando} className="btn-secondary justify-center disabled:opacity-50">
            {processando ? 'Confirmando...' : 'Confirmar senha'}
          </button>
        </form>
      )}

      {!reautenticado && !usaSenha && usaGoogle && (
        <button
          type="button"
          onClick={aoConfirmarGoogle}
          disabled={processando}
          className="btn-secondary justify-center gap-2 w-full mb-2 disabled:opacity-50"
        >
          <Chrome size={16} /> {processando ? 'Confirmando...' : 'Confirmar com Google'}
        </button>
      )}

      {reautenticado && (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-widest text-mist">
              Digite {TEXTO_CONFIRMACAO} pra confirmar
            </span>
            <input
              value={textoConfirmacao}
              onChange={(e) => setTextoConfirmacao(e.target.value)}
              placeholder={TEXTO_CONFIRMACAO}
              className="campo-input"
            />
          </label>
          <button
            onClick={aoExcluir}
            disabled={processando || textoConfirmacao.trim().toUpperCase() !== TEXTO_CONFIRMACAO}
            className="btn-primary justify-center disabled:opacity-50"
          >
            {processando ? 'Excluindo...' : 'Excluir minha conta permanentemente'}
          </button>
        </div>
      )}
    </ModalBase>
  )
}
