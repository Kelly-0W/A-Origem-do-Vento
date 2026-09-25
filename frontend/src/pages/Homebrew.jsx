import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'

const vazio = { tipo: 'poder_elemental', elemento: '', nome: '', descricao: '', efeito: '', execucao: 'padrao', alcance: '', pericia: 'misticismo', alvo: '', duracao: '', custo_arche: 1, grau_minimo: 0 }
const inputClass = 'campo-input w-full'
const opcoesExecucao = [
  ['padrao', 'Ação padrão'], ['movimento', 'Ação de movimento'], ['reacao', 'Reação'],
  ['livre', 'Ação livre'], ['bonus', 'Ação bônus'], ['completa', 'Ação completa'],
]
const opcoesAlcance = [
  ['pessoal', 'Pessoal'], ['toque', 'Toque'], ['corpo a corpo', 'Corpo a corpo'], ['3m', '3 m'], ['6m', '6 m'],
  ['curto', 'Curto'], ['12m', '12 m'], ['15m', '15 m'], ['medio', 'Médio'],
  ['21m', '21 m'], ['24m', '24 m'], ['longo', 'Longo'],
]
const opcoesDuracao = [
  ['instantaneo', 'Instantâneo'], ['1 turno', '1 turno'], ['1 rodada', '1 rodada'],
  ['2 rodadas', '2 rodadas'], ['3 rodadas', '3 rodadas'], ['4 rodadas', '4 rodadas'],
  ['5 rodadas', '5 rodadas'], ['6 rodadas', '6 rodadas'], ['cena', 'Cena'],
  ['sustentado', 'Sustentado'], ['permanente', 'Permanente'],
  ['ate 3 golpes (acertando ou errando)', 'Até 3 golpes'],
]
const opcoesCusto = Array.from({ length: 21 }, (_, valor) => valor)
const opcoesGrau = Array.from({ length: 11 }, (_, valor) => valor)

export default function Homebrew() {
  const { usuario } = useAuth()
  const [form, setForm] = useState(vazio)
  const [itens, setItens] = useState([])
  const [campanhas, setCampanhas] = useState([])
  const [pericias, setPericias] = useState([])
  const [elementos, setElementos] = useState([])
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState('')
  const [solicitando, setSolicitando] = useState('')

  async function carregar() {
    try {
      const [h, c, catalogoPericias, catalogoElementos] = await Promise.all([
        api.listarHomebrew(),
        getDocs(query(collection(db, 'campanhas'), where('jogadores_uids', 'array-contains', usuario.uid))),
        api.buscarBiblioteca('pericias'),
        api.buscarBiblioteca('elementos'),
      ])
      if (!h.ok) throw new Error(h.dados?.erros?.[0] || 'Não foi possível carregar suas criações.')
      setItens(h.dados.itens || [])
      setCampanhas(c.docs.map((d) => ({ id: d.id, ...d.data() })))
      setPericias(Object.entries(catalogoPericias.dados?.itens || {}).map(([id, pericia]) => ({ id, nome: pericia.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      setElementos(Object.entries(catalogoElementos.dados?.itens || {}).map(([id, elemento]) => ({ id, nome: elemento.nome || id })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
    } catch (e) { setErro(e.message || 'Não foi possível carregar suas criações.') }
  }
  useEffect(() => { carregar() }, [usuario?.uid])

  async function salvar(e) {
    e.preventDefault(); setErro(''); setMsg(''); setSalvando(true)
    try {
      const payload = { ...form, elemento: form.tipo === 'poder_elemental' ? form.elemento : undefined, dano: form.dano_texto?.trim() ? { dados: form.dano_texto.trim(), atributo_bonus: form.pericia || 'misticismo', tipo: 'personalizado' } : null, custo_arche: Number(form.custo_arche) || 0, grau_minimo: Number(form.grau_minimo) || 0 }
      const r = await api.salvarHomebrew(payload)
      if (!r.ok || !r.dados.sucesso) throw new Error(r.dados?.erros?.[0] || 'Não foi possível salvar.')
      setForm(vazio); setMsg('Criação salva na sua conta.'); await carregar()
    } catch (e2) { setErro(e2.message === 'internal' ? 'Não foi possível salvar agora. Tente novamente.' : e2.message) } finally { setSalvando(false) }
  }
  async function solicitar(campanhaId, skillId) {
    const chave = `${campanhaId}_${skillId}`
    setErro(''); setMsg(''); setSolicitando(chave)
    try {
      const r = await api.solicitarHomebrew(campanhaId, skillId)
      if (!r.ok || !r.dados.sucesso) throw new Error(r.dados?.erros?.[0] || 'Falha ao solicitar aprovação.')
      setMsg('Pedido enviado ao mestre.')
      setTimeout(() => setMsg(''), 2500)
    } finally { setSolicitando('') }
  }
  async function excluir(item) {
    if (!window.confirm(`Excluir “${item.nome}” das suas criações?`)) return
    setErro(''); setMsg(''); setExcluindo(item.id)
    try {
      const r = await api.excluirHomebrew(item.id)
      if (!r.ok || !r.dados.sucesso) throw new Error(r.dados?.erros?.[0] || 'Não foi possível excluir a criação.')
      setMsg('Criação excluída.')
      setTimeout(() => setMsg(''), 2500)
      await carregar()
    } catch (e) { setErro(e.message) } finally { setExcluindo('') }
  }

  return <div className="pt-2 space-y-8">
    <header><h1 className="text-3xl mb-2">Minhas criações</h1><p className="text-mist">Crie poderes e habilidades para propor às suas campanhas.</p></header>
    <form onSubmit={salvar} className="card-fantasy p-6 space-y-4">
      <h2 className="text-xl">Criar conteúdo</h2>
      <label className="block text-sm text-mist">Categoria<select className={`${inputClass} mt-1`} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value, elemento: '' })}><option value="poder_elemental">Poder elemental</option><option value="habilidade_personagem">Habilidade de personagem</option></select></label>
      {form.tipo === 'poder_elemental' && <label className="block text-sm text-mist">Elemento<select required className={`${inputClass} mt-1`} value={form.elemento} onChange={e => setForm({ ...form, elemento: e.target.value })}><option value="">Escolha o elemento...</option>{elementos.map(elemento => <option key={elemento.id} value={elemento.id}>{elemento.nome}</option>)}</select><span className="block text-xs mt-1">Jogadores que manipulam este elemento poderão solicitar o poder na campanha.</span></label>}
      <label className="block text-sm text-mist">Nome<input required maxLength="100" className={`${inputClass} mt-1`} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></label>
      <label className="block text-sm text-mist">Descrição<textarea required maxLength="3000" rows="3" className={`${inputClass} mt-1`} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></label>
      <label className="block text-sm text-mist">Efeito<textarea maxLength="3000" rows="2" className={`${inputClass} mt-1`} value={form.efeito} onChange={e => setForm({ ...form, efeito: e.target.value })} /></label>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="text-sm text-mist">Execução<select className={`${inputClass} mt-1`} value={form.execucao} onChange={e => setForm({ ...form, execucao: e.target.value })}>{opcoesExecucao.map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}</select></label>
        <label className="text-sm text-mist">Alcance<select required className={`${inputClass} mt-1`} value={form.alcance} onChange={e => setForm({ ...form, alcance: e.target.value })}><option value="">Selecione...</option>{opcoesAlcance.map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}</select></label>
        <label className="text-sm text-mist">Perícia<select className={`${inputClass} mt-1`} value={form.pericia} onChange={e => setForm({ ...form, pericia: e.target.value })}><option value="">Não se aplica</option>{pericias.map((pericia) => <option key={pericia.id} value={pericia.id}>{pericia.nome}</option>)}</select></label>
        <label className="text-sm text-mist">Alvo<input className={`${inputClass} mt-1`} value={form.alvo} onChange={e => setForm({ ...form, alvo: e.target.value })} /></label>
        <label className="text-sm text-mist">Duração<select required className={`${inputClass} mt-1`} value={form.duracao} onChange={e => setForm({ ...form, duracao: e.target.value })}><option value="">Selecione...</option>{opcoesDuracao.map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}</select></label>
        <label className="text-sm text-mist">Custo de Arché<select className={`${inputClass} mt-1`} value={form.custo_arche} onChange={e => setForm({ ...form, custo_arche: Number(e.target.value) })}>{opcoesCusto.map(valor => <option key={valor} value={valor}>{valor === 0 ? 'Sem custo' : `${valor} ${valor === 1 ? 'ponto' : 'pontos'}`}</option>)}</select></label>
        <label className="text-sm text-mist">Grau mínimo<select className={`${inputClass} mt-1`} value={form.grau_minimo} onChange={e => setForm({ ...form, grau_minimo: Number(e.target.value) })}>{opcoesGrau.map(valor => <option key={valor} value={valor}>{valor === 0 ? 'Nenhum requisito' : `Grau ${valor}`}</option>)}</select></label>
        <label className="text-sm text-mist">Dano (ex.: 2d6, tipo)<input className={`${inputClass} mt-1`} placeholder="2d6 fogo" value={form.dano_texto || ''} onChange={e => setForm({ ...form, dano_texto: e.target.value })} /></label>
      </div>
      {erro && <p className="text-blood-bright text-sm">{erro}</p>}{msg && <p className="text-gold text-sm">{msg}</p>}
      <button className="btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar criação'}</button>
    </form>
    <section><h2 className="text-xl mb-4">Suas criações salvas</h2>{itens.length === 0 ? <p className="text-mist">Ainda não há conteúdo homebrew.</p> : <div className="grid md:grid-cols-2 gap-4">{itens.map(item => <article key={item.id} className="card-fantasy p-5"><div className="text-[10px] uppercase tracking-widest text-gold mb-1">{item.tipo === 'poder_elemental' ? `Poder elemental · ${elementos.find(e => e.id === item.elemento)?.nome || item.elemento || 'Elemento não definido'}` : 'Habilidade de personagem'}</div><h3 className="text-lg">{item.nome}</h3><p className="text-sm text-mist mt-2">{item.descricao}</p>{item.efeito && <p className="text-sm mt-2">Efeito: {item.efeito}</p>}<div className="text-xs text-mist mt-3">{[opcoesExecucao.find(([valor]) => valor === item.execucao)?.[1], opcoesAlcance.find(([valor]) => valor === item.alcance)?.[1], item.pericia ? pericias.find(p => p.id === item.pericia)?.nome : 'Sem perícia', item.duracao].filter(Boolean).join(' · ')}{item.custo_arche != null ? ` · ${item.custo_arche} Arché · Grau mínimo ${item.grau_minimo ?? 0}` : ''}</div><div className="mt-4 flex flex-wrap gap-2">{campanhas.map(c => { const chave = `${c.id}_${item.id}`; return <button key={c.id} disabled={solicitando === chave} className="btn-secondary text-xs" onClick={() => solicitar(c.id, item.id).catch(e => setErro(e.message))}>{solicitando === chave ? 'Enviando...' : `Propor a ${c.nome}`}</button> })}<button className="btn-secondary text-xs border-blood-bright/50" disabled={excluindo === item.id} onClick={() => excluir(item)}>{excluindo === item.id ? 'Excluindo...' : 'Excluir'}</button></div></article>)}</div>}</section>
  </div>
}
