import { useState } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { gerarCodigoConvite } from '../lib/codigoConvite.js'

// Código de vínculo com o bot do Discord: uso único e validade curta.
// O bot (bot/vinculos.py) procura o código no documento do personagem, cria o
// vínculo e apaga o código. Só o dono da ficha deve ver este componente.
const VALIDADE_MIN = 15

function vigente(codigo, expira) {
  return codigo && expira && expira > Date.now() ? { codigo, expira } : null
}

export default function VinculoDiscord({ personagemId, codigoInicial, expiraInicial, discordNome }) {
  const [atual, setAtual] = useState(() => vigente(codigoInicial, expiraInicial))
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState(null)
  const [copiado, setCopiado] = useState(false)

  async function gerar() {
    setGerando(true)
    setErro(null)
    try {
      const codigo = gerarCodigoConvite()
      const expira = Date.now() + VALIDADE_MIN * 60 * 1000
      await updateDoc(doc(db, 'personagens', personagemId), {
        codigo_vinculo_discord: codigo,
        codigo_vinculo_discord_expira: expira,
        atualizado_em: serverTimestamp(),
      })
      setAtual({ codigo, expira })
    } catch (err) {
      console.error(err)
      setErro('Não foi possível gerar o código agora.')
    } finally {
      setGerando(false)
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(atual.codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  const horaExpira = atual
    ? new Date(atual.expira).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="mt-6 max-w-sm">
      <span className="text-[11px] uppercase tracking-widest text-mist">Discord</span>

      {discordNome && (
        <p className="text-xs text-forest mt-1">Vinculado ao Discord de {discordNome}.</p>
      )}

      {atual ? (
        <div className="mt-2">
          <button
            onClick={copiar}
            className="font-display text-2xl tracking-[0.3em] px-4 py-2 rounded border border-gold/40 text-gold hover:border-gold/70 transition-colors"
          >
            {copiado ? 'Copiado!' : atual.codigo}
          </button>
          <p className="text-[11px] text-mist mt-2">
            No Discord, use <span className="text-white">/vincular</span> com esse código. Vale até {horaExpira} e
            só pode ser usado uma vez.
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-mist mt-1">
          {discordNome ? 'Quer vincular a outra conta? ' : ''}
          Gere um código temporário pra conectar este personagem ao bot do Discord.
        </p>
      )}

      <button className="btn-secondary text-xs mt-3 disabled:opacity-50" onClick={gerar} disabled={gerando}>
        {gerando ? 'Gerando...' : atual ? 'Gerar novo código' : 'Vincular ao Discord'}
      </button>
      {erro && <p className="text-blood-bright text-xs mt-2">{erro}</p>}
    </div>
  )
}
