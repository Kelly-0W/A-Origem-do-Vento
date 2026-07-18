import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wind } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { entrar, cadastrar } = useAuth()
  const navigate = useNavigate()

  const [modo, setModo] = useState('entrar') // 'entrar' | 'cadastrar'
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(e) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      if (modo === 'entrar') {
        await entrar(email, senha)
      } else {
        await cadastrar(nome, email, senha)
      }
      navigate('/')
    } catch (err) {
      setErro(traduzirErro(err.code))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-void px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full border border-gold/60 flex items-center justify-center text-gold mb-4">
            <Wind size={24} />
          </div>
          <div className="text-center leading-tight">
            <div className="font-display font-bold text-lg">A ORIGEM</div>
            <div className="font-display text-xs tracking-[0.3em] text-gold">DO VENTO</div>
          </div>
        </div>

        <div className="card-fantasy p-8">
          <h1 className="text-xl mb-1">{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</h1>
          <p className="text-mist text-sm mb-6">
            {modo === 'entrar'
              ? 'Volte para suas lendas em andamento.'
              : 'O nome de exibição pode se repetir — sua conta é identificada de forma única por trás dos panos.'}
          </p>

          <form onSubmit={aoEnviar} className="flex flex-col gap-4">
            {modo === 'cadastrar' && (
              <Campo label="Nome de exibição">
                <input
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Como quer ser chamado"
                  className="campo-input"
                />
              </Campo>
            )}

            <Campo label="E-mail">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="campo-input"
              />
            </Campo>

            <Campo label="Senha">
              <input
                required
                type="password"
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="campo-input"
              />
            </Campo>

            {erro && (
              <p className="text-blood-bright text-xs border border-blood-bright/40 rounded-md px-3 py-2">
                {erro}
              </p>
            )}

            <button type="submit" disabled={enviando} className="btn-primary justify-center mt-2 disabled:opacity-50">
              {enviando ? 'Um momento...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          <button
            onClick={() => { setModo(modo === 'entrar' ? 'cadastrar' : 'entrar'); setErro(null) }}
            className="w-full text-center text-xs text-mist mt-6 hover:text-white"
          >
            {modo === 'entrar' ? 'Ainda não tem conta? Criar uma' : 'Já tem conta? Entrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-widest text-mist">{label}</span>
      {children}
    </label>
  )
}

function traduzirErro(codigo) {
  const mapa = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-not-found': 'Não existe conta com esse e-mail.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  }
  return mapa[codigo] || 'Algo deu errado. Tente novamente.'
}
