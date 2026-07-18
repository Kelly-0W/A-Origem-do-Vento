import { useState } from 'react'
import { Chrome } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import ModalBase from './ModalBase.jsx'

function traduzirErroVinculo(codigo) {
  const mapa = {
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Se for sua, saia e entre com ela — mas seu progresso como visitante não é transferido automaticamente.',
    'auth/credential-already-in-use': 'Essa conta Google já está associada a outro usuário. Se for sua, saia e entre com ela — mas seu progresso como visitante não é transferido automaticamente.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/popup-closed-by-user': 'Login cancelado.',
    'auth/popup-blocked': 'O navegador bloqueou o popup de login. Permita popups pra este site e tente de novo.',
  }
  return mapa[codigo] || 'Algo deu errado. Tente novamente.'
}

export default function VincularContaModal({ onFechar }) {
  const { vincularEmail, vincularGoogle } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviarEmail(e) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await vincularEmail(nome, email, senha)
      onFechar()
    } catch (err) {
      setErro(traduzirErroVinculo(err.code))
    } finally {
      setEnviando(false)
    }
  }

  async function aoClicarGoogle() {
    setErro(null)
    setEnviando(true)
    try {
      await vincularGoogle()
      onFechar()
    } catch (err) {
      setErro(traduzirErroVinculo(err.code))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ModalBase titulo="Salvar sua conta" onFechar={onFechar}>
      <p className="text-mist text-sm mb-6">
        Seus personagens e campanhas continuam exatamente como estão — isso só troca o
        jeito de você entrar da próxima vez, de "visitante deste navegador" pra uma conta
        de verdade.
      </p>

      <form onSubmit={aoEnviarEmail} className="flex flex-col gap-4 mb-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-widest text-mist">Nome de exibição</span>
          <input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como quer ser chamado"
            className="campo-input"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-widest text-mist">E-mail</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            className="campo-input"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-widest text-mist">Senha</span>
          <input
            required
            type="password"
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            className="campo-input"
          />
        </label>

        {erro && (
          <p className="text-blood-bright text-xs border border-blood-bright/40 rounded-md px-3 py-2">
            {erro}
          </p>
        )}

        <button type="submit" disabled={enviando} className="btn-primary justify-center disabled:opacity-50">
          {enviando ? 'Um momento...' : 'Salvar com e-mail e senha'}
        </button>
      </form>

      <div className="flex items-center gap-3 mb-6">
        <div className="h-px bg-panel-border flex-1" />
        <span className="text-[11px] uppercase tracking-widest text-mist">ou</span>
        <div className="h-px bg-panel-border flex-1" />
      </div>

      <button
        type="button"
        onClick={aoClicarGoogle}
        disabled={enviando}
        className="btn-secondary justify-center gap-2 w-full disabled:opacity-50"
      >
        <Chrome size={16} /> Salvar com Google
      </button>
    </ModalBase>
  )
}
