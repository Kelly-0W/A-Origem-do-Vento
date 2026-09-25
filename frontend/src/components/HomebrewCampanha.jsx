import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function HomebrewCampanha({ campanhaId, usuario }) {
  const [dados, setDados] = useState({ aprovados: [], pedidos: [], biblioteca_jogadores: [], eh_mestre: false })
  const [tipo, setTipo] = useState('poder_elemental')
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState('')

  async function carregar() {
    setCarregando(true)
    try {
      const r = await api.dadosHomebrewCampanha(campanhaId)
      if (!r.ok || !r.dados.sucesso) throw new Error(r.dados?.erros?.[0] || 'Falha ao carregar homebrew.')
      setDados(r.dados)
    } catch (e) { setErro(e.message) } finally { setCarregando(false) }
  }
  useEffect(() => { carregar() }, [campanhaId, usuario?.uid])

  async function responder(pedido, aprovar) {
    setOcupado(pedido.id); setErro('')
    try {
      const r = await api.responderHomebrew(campanhaId, pedido.id, aprovar)
      if (!r.ok || !r.dados.sucesso) throw new Error(r.dados?.erros?.[0] || 'Falha ao responder.')
      await carregar()
    } catch (e) { setErro(e.message) } finally { setOcupado('') }
  }

  async function solicitar(habilidade) {
    const chave = `${habilidade.owner_uid}_${habilidade.id}`
    setOcupado(chave); setErro(''); setMensagem('')
    try {
      const r = await api.solicitarHomebrew(campanhaId, habilidade.id, habilidade.owner_uid)
      if (!r.ok || !r.dados.sucesso) throw new Error(r.dados?.erros?.[0] || 'Falha ao solicitar aprovação.')
      setMensagem('Pedido enviado ao mestre.')
      await carregar()
      setTimeout(() => setMensagem(''), 2500)
    } catch (e) { setErro(e.message) } finally { setOcupado('') }
  }

  const lista = dados.aprovados.filter(h => h.tipo === tipo)
  const bibliotecaJogadores = (dados.biblioteca_jogadores || []).filter(h => h.tipo === tipo)
  const label = tipo === 'poder_elemental' ? 'Poderes Elementais' : 'Habilidades de Personagem'
  return <section className="card-fantasy p-6 mt-8">
    <div className="flex items-start justify-between gap-4 flex-wrap"><div><h2 className="text-2xl">Conteúdo Personalizado</h2><p className="text-sm text-mist mt-1">Conteúdo homebrew aprovado para esta campanha.</p></div></div>
    <div className="flex border-b border-panel-border mt-5 mb-5"><button className={`tab-item ${tipo === 'poder_elemental' ? 'active' : ''}`} onClick={() => setTipo('poder_elemental')}>Poderes Elementais</button><button className={`tab-item ${tipo === 'habilidade_personagem' ? 'active' : ''}`} onClick={() => setTipo('habilidade_personagem')}>Habilidades de Personagem</button></div>
    {erro && <p className="text-blood-bright text-sm mb-3">{erro}</p>}{mensagem && <p role="status" className="text-forest text-sm mb-3">{mensagem}</p>}
    {carregando ? <p className="text-mist text-sm">Carregando...</p> : lista.length ? <div className="grid md:grid-cols-2 gap-4">{lista.map(h => <article key={h.id} className="border border-panel-border rounded p-4"><h3 className="text-lg">{h.nome}</h3><p className="text-sm text-mist mt-2">{h.descricao}</p>{h.efeito && <p className="text-sm mt-2">Efeito: {h.efeito}</p>}<div className="text-xs text-mist mt-3">{[h.elemento, h.execucao, h.alcance, h.duracao].filter(Boolean).join(' · ')}{h.custo_arche != null ? ` · ${h.custo_arche} Arché` : ''}</div></article>)}</div> : <p className="text-sm text-mist">Nenhum item aprovado em {label.toLowerCase()}.</p>}
    {dados.eh_mestre ? <div className="mt-8 border-t border-panel-border pt-5"><h3 className="text-xl mb-3">Pedidos aguardando aprovação</h3>{dados.pedidos.length ? <div className="space-y-3">{dados.pedidos.map(p => <article key={p.id} className="border border-panel-border rounded p-4"><strong>{p.conteudo?.nome || 'Criação indisponível'}</strong><p className="text-xs text-mist">{p.conteudo?.elemento ? `Poder elemental · ${p.conteudo.elemento} · ` : ''}Solicitante: {p.solicitante_uid || p.owner_uid}</p><p className="text-sm text-mist mt-1">{p.conteudo?.descricao}</p><div className="flex gap-2 mt-3"><button disabled={!!ocupado} onClick={() => responder(p, true)} className="btn-primary text-xs">{ocupado === p.id ? 'Salvando…' : 'Aprovar'}</button><button disabled={!!ocupado} onClick={() => responder(p, false)} className="btn-secondary text-xs">Rejeitar</button></div></article>)}</div> : <p className="text-sm text-mist">Nenhum pedido pendente.</p>}
      <h3 className="text-xl mt-7 mb-3">Criações dos jogadores</h3>{bibliotecaJogadores.length ? <div className="grid md:grid-cols-2 gap-3">{bibliotecaJogadores.map(h => <article key={`${h.owner_uid}_${h.id}`} className="border border-panel-border rounded p-3"><span className="text-[10px] uppercase tracking-widest text-gold">{h.tipo === 'poder_elemental' ? `Poder elemental · ${h.elemento || 'Elemento não definido'}` : 'Habilidade de personagem'}</span><h4 className="mt-1">{h.nome}</h4><p className="text-xs text-mist mt-1">{h.descricao}</p></article>)}</div> : <p className="text-sm text-mist">Nenhuma criação dos jogadores nesta categoria.</p>}</div> : <div className="mt-8 border-t border-panel-border pt-5"><h3 className="text-xl mb-3">Seus pedidos</h3>{dados.pedidos.length ? <ul className="space-y-2">{dados.pedidos.map(p => <li key={p.id} className="text-sm">{p.conteudo?.nome || p.skill_id} <span className="text-gold">· {p.status}</span></li>)}</ul> : <p className="text-sm text-mist">Você ainda não enviou pedidos de conteúdo.</p>}
      <h3 className="text-xl mt-7 mb-3">Criações disponíveis dos jogadores</h3>{bibliotecaJogadores.length ? <div className="grid md:grid-cols-2 gap-3">{bibliotecaJogadores.map(h => { const chave = `${h.owner_uid}_${h.id}`; const pendente = dados.pedidos.some(p => p.owner_uid === h.owner_uid && p.skill_id === h.id && p.status === 'pendente'); return <article key={chave} className="border border-panel-border rounded p-3"><span className="text-[10px] uppercase tracking-widest text-gold">{h.tipo === 'poder_elemental' ? `Poder elemental · ${h.elemento}` : 'Habilidade de personagem'}</span><h4 className="mt-1">{h.nome}</h4><p className="text-xs text-mist mt-1">{h.descricao}</p><button disabled={!!ocupado || pendente} onClick={() => solicitar(h)} className="btn-secondary text-xs mt-3">{ocupado === chave ? 'Enviando...' : pendente ? 'Pedido pendente' : 'Solicitar ao mestre'}</button></article> })}</div> : <p className="text-sm text-mist">Nenhuma criação compatível disponível nesta categoria.</p>}</div>}
  </section>
}
