import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'

const vazio = { tipo: 'poder_elemental', nome: '', descricao: '', efeito: '', execucao: 'padrao', alcance: '', pericia: 'misticismo', alvo: '', duracao: '', custo_arche: 1, grau_minimo: 0 }
const inputClass = 'campo-input w-full'

export default function Homebrew() {
  const { usuario } = useAuth()
  const [form, setForm] = useState(vazio)
  const [itens, setItens] = useState([])
  const [campanhas, setCampanhas] = useState([])
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    try {
      const [h, c] = await Promise.all([
        api.listarHomebrew(),
        getDocs(query(collection(db, 'campanhas'), where('jogadores_uids', 'array-contains', usuario.uid))),
      ])
      if (!h.ok) throw new Error(h.dados?.erros?.[0])
      setItens(h.dados.itens || [])
      setCampanhas(c.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (e) { setErro(e.message || 'Não foi possível carregar suas criações.') }
  }
  useEffect(() => { carregar() }, [usuario?.uid])

  async function salvar(e) {
    e.preventDefault(); setErro(''); setMsg(''); setSalvando(true)
    try {
      const payload = { ...form, dano: form.dano_texto?.trim() ? { dados: form.dano_texto.trim(), atributo_bonus: form.pericia || 'misticismo', tipo: 'personalizado' } : null, custo_arche: Number(form.custo_arche) || 0, grau_minimo: Number(form.grau_minimo) || 0 }
      const r = await api.salvarHomebrew(payload)
      if (!r.ok || !r.dados.sucesso) throw new Error(r.dados?.erros?.[0] || 'Não foi possível salvar.')
      setForm(vazio); setMsg('Criação salva na sua conta.'); await carregar()
    } catch (e2) { setErro(e2.message) } finally { setSalvando(false) }
  }
  async function solicitar(campanhaId, skillId) {
    const r = await api.solicitarHomebrew(campanhaId, skillId)
    if (!r.ok || !r.dados.sucesso) throw new Error(r.dados?.erros?.[0] || 'Falha ao solicitar aprovação.')
    setMsg('Pedido enviado ao mestre.')
  }

  return <div className="pt-2 space-y-8">
    <header><h1 className="text-3xl mb-2">Minhas criações</h1><p className="text-mist">Crie poderes e habilidades para propor às suas campanhas.</p></header>
    <form onSubmit={salvar} className="card-fantasy p-6 space-y-4">
      <h2 className="text-xl">Criar conteúdo</h2>
      <label className="block text-sm text-mist">Categoria<select className={`${inputClass} mt-1`} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}><option value="poder_elemental">Poder elemental</option><option value="habilidade_personagem">Habilidade de personagem</option></select></label>
      <label className="block text-sm text-mist">Nome<input required maxLength="100" className={`${inputClass} mt-1`} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></label>
      <label className="block text-sm text-mist">Descrição<textarea required maxLength="3000" rows="3" className={`${inputClass} mt-1`} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></label>
      <label className="block text-sm text-mist">Efeito<textarea maxLength="3000" rows="2" className={`${inputClass} mt-1`} value={form.efeito} onChange={e => setForm({ ...form, efeito: e.target.value })} /></label>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {['execucao', 'alcance', 'pericia', 'alvo', 'duracao'].map((campo) => <label key={campo} className="text-sm text-mist capitalize">{campo.replace('_', ' ')}<input className={`${inputClass} mt-1`} value={form[campo]} onChange={e => setForm({ ...form, [campo]: e.target.value })} /></label>)}
        <label className="text-sm text-mist">Custo de Arché<input type="number" min="0" max="99" className={`${inputClass} mt-1`} value={form.custo_arche} onChange={e => setForm({ ...form, custo_arche: e.target.value })} /></label>
        <label className="text-sm text-mist">Grau mínimo<input type="number" min="0" max="99" className={`${inputClass} mt-1`} value={form.grau_minimo} onChange={e => setForm({ ...form, grau_minimo: e.target.value })} /></label>
        <label className="text-sm text-mist">Dano (ex.: 2d6, tipo)<input className={`${inputClass} mt-1`} placeholder="2d6 fogo" value={form.dano_texto || ''} onChange={e => setForm({ ...form, dano_texto: e.target.value })} /></label>
      </div>
      {erro && <p className="text-blood-bright text-sm">{erro}</p>}{msg && <p className="text-gold text-sm">{msg}</p>}
      <button className="btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar criação'}</button>
    </form>
    <section><h2 className="text-xl mb-4">Suas criações salvas</h2>{itens.length === 0 ? <p className="text-mist">Ainda não há conteúdo homebrew.</p> : <div className="grid md:grid-cols-2 gap-4">{itens.map(item => <article key={item.id} className="card-fantasy p-5"><div className="text-[10px] uppercase tracking-widest text-gold mb-1">{item.tipo === 'poder_elemental' ? 'Poder elemental' : 'Habilidade de personagem'}</div><h3 className="text-lg">{item.nome}</h3><p className="text-sm text-mist mt-2">{item.descricao}</p>{item.efeito && <p className="text-sm mt-2">Efeito: {item.efeito}</p>}<div className="mt-4 flex flex-wrap gap-2">{campanhas.map(c => <button key={c.id} className="btn-secondary text-xs" onClick={() => solicitar(c.id, item.id).catch(e => setErro(e.message))}>Propor a {c.nome}</button>)}</div></article>)}</div>}</section>
  </div>
}
