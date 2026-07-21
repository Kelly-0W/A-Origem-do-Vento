import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ATRIBUTOS, NOMES_ATRIBUTOS } from '../lib/constantes.js'
import { nomePericia } from '../lib/formato.js'
import ResumoEscolhas from '../components/ResumoEscolhas.jsx'
import FichaVisual from '../components/FichaVisual.jsx'
import ModalBase from '../components/ModalBase.jsx'
import PoderDetalhe from '../components/PoderDetalhe.jsx'

const PONTOS_ATRIBUTOS_BASE = 10

// Definição de TODOS os passos possíveis do assistente, na ordem em que
// aparecem quando visíveis. `condicional` decide se o passo entra na lista
// de passos exibidos para as escolhas atuais (ex.: "Linhagem" só existe
// pra raças que têm linhagem; "Poderes" vira "Espiritual" pra Caça, mas
// nunca desaparece).
function definirPassos(catalogo, escolhas) {
  const raca = catalogo.racas?.[escolhas.raca_id]
  const linhagens = raca?.linhagens || []
  const temLinhagem = linhagens.length > 0

  return [
    { key: 'sagracantico', label: 'Sagracântico' },
    { key: 'raca', label: 'Raça' },
    { key: 'linhagem', label: 'Linhagem', condicional: () => temLinhagem },
    { key: 'habilidades_raca', label: 'Habilidades de Raça' },
    { key: 'classe', label: 'Classe' },
    { key: 'habilidades_classe', label: 'Habilidades de Classe' },
    { key: 'origem', label: 'Origem' },
    { key: 'elemento', label: 'Elemento' },
    { key: 'poderes', label: escolhas.elemento_id === 'caca' ? 'Espiritual' : 'Poderes' },
    { key: 'atributos', label: 'Atributos' },
    { key: 'resumo', label: 'Resumo' },
  ].filter((p) => !p.condicional || p.condicional())
}

export default function CharacterWizard() {
  const { usuario } = useAuth()
  const navigate = useNavigate()

  const [passo, setPasso] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [catalogo, setCatalogo] = useState({ racas: {}, classes: {}, origens: {}, elementos: {}, pericias: {}, sagracanticos: {} })

  const [nomePersonagem, setNomePersonagem] = useState('')

  const [escolhas, setEscolhas] = useState({
    raca_id: null,
    linhagem_id: null,
    classe_id: null,
    origem_id: null,
    origem_pericia_escolhida: null,
    elemento_id: null,
    confirma_elegibilidade_elemento: false,
    poderes_escolhidos: [],
    espiritual_escolhido: null,
    sagracantico_deus_id: null,
    atributos: { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 },
    pericias_treinadas: [],
    habilidades_escolhidas: { raca_globais: [], raca_linhagem: [], classe: [] },
  })

  const [resultado, setResultado] = useState(null)
  const [erros, setErros] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(null) // { personagemId } | null
  const [avisoSalvamento, setAvisoSalvamento] = useState(null)
  const [poderAberto, setPoderAberto] = useState(null)

  useEffect(() => {
    async function carregar() {
      const colecoes = ['racas', 'classes', 'origens', 'elementos', 'pericias', 'sagracanticos']
      const respostas = await Promise.all(colecoes.map((c) => api.buscarBiblioteca(c)))
      const novoCatalogo = {}
      colecoes.forEach((c, i) => { novoCatalogo[c] = respostas[i].dados?.itens ?? {} })
      setCatalogo(novoCatalogo)
      setCarregando(false)
    }
    carregar()
  }, [])

  const raca = catalogo.racas?.[escolhas.raca_id] || null
  const linhagens = raca?.linhagens || []
  const linhagem = linhagens.find((l) => l.id === escolhas.linhagem_id) || null
  const classe = catalogo.classes?.[escolhas.classe_id] || null
  const origem = catalogo.origens?.[escolhas.origem_id] || null
  const elemento = catalogo.elementos?.[escolhas.elemento_id] || null
  const isCaca = escolhas.elemento_id === 'caca'
  const deusSagracantico = catalogo.sagracanticos?.deuses?.[escolhas.sagracantico_deus_id] || null

  // Raças vetadas pelo deus escolhido (ex.: Nidhogg não aceita humanos nem
  // draconatos como Arautos -- ver seed/dados/sagracanticos.json) somem do
  // passo de Raça antes mesmo do jogador chegar lá.
  const racasDisponiveis = useMemo(() => {
    const restritas = new Set(deusSagracantico?.restricao_arautos?.racas_restritas || [])
    if (restritas.size === 0) return catalogo.racas
    return Object.fromEntries(Object.entries(catalogo.racas || {}).filter(([id]) => !restritas.has(id)))
  }, [catalogo.racas, deusSagracantico])

  const passos = useMemo(() => definirPassos(catalogo, escolhas), [catalogo, escolhas.raca_id, escolhas.elemento_id])

  // Se o passo atual "sumiu" da lista (ex.: trocou de raça e perdeu o
  // passo de Linhagem), reancora num índice válido em vez de travar numa
  // posição inexistente.
  useEffect(() => {
    if (passo > passos.length - 1) {
      setPasso(Math.max(0, passos.length - 1))
    }
  }, [passos, passo])

  const passoAtual = passos[passo] || passos[0]

  // Mantém pericias_treinadas sempre coerente com as garantias de
  // classe/origem (ver api/motor/validacoes.py) sem exigir um passo de UI
  // próprio -- essas duas perícias são automáticas, não escolhidas.
  useEffect(() => {
    setEscolhas((prev) => {
      const garantidas = [classe?.pericia_treinada_fixa, prev.origem_pericia_escolhida].filter(Boolean)
      const jaTinha = garantidas.every((p) => prev.pericias_treinadas.includes(p))
      if (jaTinha && prev.pericias_treinadas.length === garantidas.length) return prev
      return { ...prev, pericias_treinadas: Array.from(new Set(garantidas)) }
    })
  }, [classe?.pericia_treinada_fixa, escolhas.origem_pericia_escolhida])

  // Se a raça atual passou a ser vetada pelo deus recém-escolhido (ex.:
  // trocou pra Nidhogg com Humano já selecionado), reseta a raça em vez de
  // deixar uma combinação inválida parada no estado.
  useEffect(() => {
    const restritas = deusSagracantico?.restricao_arautos?.racas_restritas || []
    if (escolhas.raca_id && restritas.includes(escolhas.raca_id)) {
      selecionarRaca(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolhas.sagracantico_deus_id])

  function atualizar(campo, valor) {
    setEscolhas((prev) => ({ ...prev, [campo]: valor }))
  }

  function selecionarRaca(id) {
    setEscolhas((prev) => ({
      ...prev,
      raca_id: id,
      // raça nova pode não ter as mesmas linhagens/habilidades -- limpa
      // tudo que dependia da raça anterior pra não deixar estado órfão.
      linhagem_id: null,
      habilidades_escolhidas: { ...prev.habilidades_escolhidas, raca_globais: [], raca_linhagem: [] },
    }))
  }

  function selecionarLinhagem(id) {
    setEscolhas((prev) => ({
      ...prev,
      linhagem_id: id,
      habilidades_escolhidas: { ...prev.habilidades_escolhidas, raca_linhagem: [] },
    }))
  }

  function selecionarClasse(id) {
    setEscolhas((prev) => ({
      ...prev,
      classe_id: id,
      habilidades_escolhidas: { ...prev.habilidades_escolhidas, classe: [] },
    }))
  }

  function selecionarOrigem(id) {
    setEscolhas((prev) => ({ ...prev, origem_id: id, origem_pericia_escolhida: null }))
  }

  function selecionarSagracantico(deusId) {
    setEscolhas((prev) => {
      if (!deusId) {
        return { ...prev, sagracantico_deus_id: null }
      }
      const deus = catalogo.sagracanticos?.deuses?.[deusId]
      return {
        ...prev,
        sagracantico_deus_id: deusId,
        // manipulação do elemento do deus não é escolha -- é automática e
        // trava o passo de Elemento (ver renderização abaixo).
        elemento_id: deus?.elemento_id || null,
        confirma_elegibilidade_elemento: false,
        poderes_escolhidos: [],
        espiritual_escolhido: null,
      }
    })
  }

  function selecionarElemento(id) {
    setEscolhas((prev) => ({
      ...prev,
      elemento_id: id,
      confirma_elegibilidade_elemento: false,
      poderes_escolhidos: [],
      espiritual_escolhido: null,
    }))
  }

  function limiteHabilidadesRaca() {
    return raca?.qtd_habilidades_iniciais ?? 2
  }

  function limiteHabilidadesClasse() {
    return classe?.qtd_habilidades_iniciais ?? 1
  }

  function toggleHabilidadeRaca(id, origemLista) {
    const campo = origemLista === 'global' ? 'raca_globais' : 'raca_linhagem'
    setEscolhas((prev) => {
      const atual = prev.habilidades_escolhidas[campo]
      const totalAtual = prev.habilidades_escolhidas.raca_globais.length + prev.habilidades_escolhidas.raca_linhagem.length
      const jaSelecionada = atual.includes(id)
      if (!jaSelecionada && totalAtual >= limiteHabilidadesRaca()) return prev
      const novoValor = jaSelecionada ? atual.filter((h) => h !== id) : [...atual, id]
      return { ...prev, habilidades_escolhidas: { ...prev.habilidades_escolhidas, [campo]: novoValor } }
    })
  }

  function toggleHabilidadeClasse(id) {
    setEscolhas((prev) => {
      const atual = prev.habilidades_escolhidas.classe
      const jaSelecionada = atual.includes(id)
      if (!jaSelecionada && atual.length >= limiteHabilidadesClasse()) return prev
      const novoValor = jaSelecionada ? atual.filter((h) => h !== id) : [...atual, id]
      return { ...prev, habilidades_escolhidas: { ...prev.habilidades_escolhidas, classe: novoValor } }
    })
  }

  function togglePoder(id) {
    setEscolhas((prev) => {
      const atual = prev.poderes_escolhidos
      const jaSelecionado = atual.includes(id)
      if (!jaSelecionado && atual.length >= 2) return prev
      const novoValor = jaSelecionado ? atual.filter((p) => p !== id) : [...atual, id]
      return { ...prev, poderes_escolhidos: novoValor }
    })
  }

  function pontosDisponiveis() {
    const negativos = ATRIBUTOS.filter((a) => (escolhas.atributos[a] ?? 0) < 0).length
    return PONTOS_ATRIBUTOS_BASE + negativos
  }

  function pontosGastos() {
    return ATRIBUTOS.reduce((soma, a) => soma + Math.max(0, escolhas.atributos[a] ?? 0), 0)
  }

  // Validação local por passo -- barra o "Próximo" antes de deixar o
  // jogador avançar com uma escolha incompleta, em vez de só descobrir
  // isso genericamente no Resumo.
  function passoValido(key) {
    switch (key) {
      case 'sagracantico':
        return true
      case 'raca':
        return !!escolhas.raca_id
      case 'linhagem':
        return !!escolhas.linhagem_id
      case 'habilidades_raca': {
        const total = escolhas.habilidades_escolhidas.raca_globais.length + escolhas.habilidades_escolhidas.raca_linhagem.length
        return total === limiteHabilidadesRaca()
      }
      case 'classe':
        return !!escolhas.classe_id
      case 'habilidades_classe':
        return escolhas.habilidades_escolhidas.classe.length === limiteHabilidadesClasse()
      case 'origem':
        return !!escolhas.origem_id && !!escolhas.origem_pericia_escolhida
      case 'elemento':
        if (!escolhas.elemento_id) return false
        if (elemento?.restricao_elegibilidade && !escolhas.confirma_elegibilidade_elemento) return false
        return true
      case 'poderes':
        return isCaca ? !!escolhas.espiritual_escolhido : escolhas.poderes_escolhidos.length === 2
      case 'atributos':
        return pontosGastos() === pontosDisponiveis()
      case 'resumo':
        return nomePersonagem.trim().length > 0
      default:
        return true
    }
  }

  async function finalizar() {
    setSalvando(true)
    setSalvo(null)
    setAvisoSalvamento(null)
    try {
      const { dados } = await api.calcularFicha(
        { ...escolhas, nome_personagem: nomePersonagem.trim() },
        { donoUid: usuario?.uid ?? null }
      )
      if (dados?.sucesso) {
        setResultado(dados.calculado)
        setErros([])
        if (dados.ficha_salva) {
          setSalvo({ personagemId: dados.personagem_id })
        } else {
          setAvisoSalvamento(dados.aviso || 'A ficha foi calculada, mas não foi possível salvar.')
        }
      } else {
        setErros(dados?.erros ?? ['Erro desconhecido ao calcular a ficha.'])
      }
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return <div className="pt-10 text-mist">Carregando catálogo...</div>
  }

  const podeAvancar = passoValido(passoAtual.key)

  return (
    <div className="pt-2">
      <button className="flex items-center gap-1 text-mist text-sm mb-6 hover:text-white">
        <ChevronLeft size={16} /> Voltar
      </button>

      <h1 className="text-3xl mb-8">Forjar Personagem</h1>

      <div className="flex items-center gap-2 mb-10 overflow-x-auto">
        {passos.map((p, i) => (
          <div key={p.key} className="flex items-center gap-2">
            <button
              onClick={() => setPasso(i)}
              className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-display shrink-0
                ${i === passo ? 'border-gold text-gold' : 'border-panel-border text-mist'}`}
            >
              {i + 1}
            </button>
            <span className={`text-xs uppercase tracking-widest whitespace-nowrap ${i === passo ? 'text-white' : 'text-mist'}`}>
              {p.label}
            </span>
            {i < passos.length - 1 && <div className="w-8 h-px bg-panel-border mx-1" />}
          </div>
        ))}
      </div>

      <div className="card-fantasy p-8 min-h-[320px]">
        {passoAtual.key === 'sagracantico' && (
          <div>
            <p className="text-mist text-sm mb-6">
              Alguns mortais são escolhidos por uma divindade para serem seus Arautos — os Sagracânticos. Isso{' '}
              <span className="text-white">não é obrigatório</span>: a maioria dos personagens é comum. Escolher um
              deus define automaticamente qual elemento você manipula e pode restringir quais raças ficam
              disponíveis a seguir.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <button
                onClick={() => selecionarSagracantico(null)}
                className={`text-left card-fantasy p-5 transition-colors
                  ${!escolhas.sagracantico_deus_id ? 'border-gold' : 'hover:border-white/20'}`}
              >
                <div className="font-display font-semibold mb-2">Personagem Comum</div>
                <p className="text-xs text-mist">
                  Sem vínculo com nenhuma divindade. Escolhe o elemento de manipulação livremente mais adiante.
                </p>
              </button>
              {Object.entries(catalogo.sagracanticos?.deuses || {}).map(([id, deus]) => (
                <button
                  key={id}
                  onClick={() => selecionarSagracantico(id)}
                  className={`text-left card-fantasy p-5 transition-colors
                    ${escolhas.sagracantico_deus_id === id ? 'border-gold' : 'hover:border-white/20'}`}
                >
                  <div className="font-display font-semibold mb-2">{deus.nome}</div>
                  <p className="text-xs text-mist mb-3 line-clamp-3">{deus.descricao}</p>
                  <span className="inline-block text-[11px] px-2 py-1 rounded border border-gold/40 text-gold">
                    Manipula: {catalogo.elementos?.[deus.elemento_id]?.nome ?? deus.elemento_id}
                  </span>
                  {(deus.restricao_arautos?.racas_restritas || []).length > 0 && (
                    <p className="text-[11px] text-blood-bright mt-2">
                      Não aceita: {deus.restricao_arautos.racas_restritas.map((rid) => catalogo.racas?.[rid]?.nome ?? rid).join(', ')}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {passoAtual.key === 'raca' && (
          <div>
            {deusSagracantico && (
              <p className="text-xs text-gold mb-5">
                Como Sagracântico de {deusSagracantico.nome}, algumas raças podem não aparecer abaixo.
              </p>
            )}
            <PassoEscolha
              itens={racasDisponiveis}
              selecionadoId={escolhas.raca_id}
              onSelecionar={selecionarRaca}
              renderBadge={(item) => Object.entries(item.modificadores_atributo || {})
                .filter(([, v]) => v !== 0)
                .map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${NOMES_ATRIBUTOS[k] ?? k}`)
                .join(', ')}
            />
          </div>
        )}

        {passoAtual.key === 'linhagem' && (
          <PassoEscolha
            itens={Object.fromEntries(linhagens.map((l) => [l.id, l]))}
            selecionadoId={escolhas.linhagem_id}
            onSelecionar={selecionarLinhagem}
            renderBadge={(item) => Object.entries(item.modificadores_atributo || {})
              .filter(([, v]) => v !== 0)
              .map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${NOMES_ATRIBUTOS[k] ?? k}`)
              .join(', ')}
          />
        )}

        {passoAtual.key === 'habilidades_raca' && (
          <div>
            {(raca?.habilidades_globais || []).some((h) => h.inata) && (
              <div className="mb-8">
                <div className="text-xs uppercase tracking-widest text-mist mb-3">
                  Inatas — concedidas automaticamente
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {raca.habilidades_globais.filter((h) => h.inata).map((h) => (
                    <div key={h.id} className="text-left card-fantasy p-4 border-gold/40">
                      <div className="font-display font-semibold mb-1 text-sm">{h.nome}</div>
                      <p className="text-xs text-mist line-clamp-3">{h.descricao}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <PassoHabilidades
              titulo={`Escolha ${limiteHabilidadesRaca()} habilidade(s) de raça`}
              grupos={[
                {
                  rotulo: 'Globais',
                  habilidades: (raca?.habilidades_globais || []).filter((h) => !h.inata),
                  origemLista: 'global',
                },
                ...(linhagem
                  ? [{
                      rotulo: `Específicas — ${linhagem.nome}`,
                      habilidades: (raca?.habilidades_especificas || []).filter((h) => h.linhagem_id === linhagem.id),
                      origemLista: 'especifica',
                    }]
                  : []),
              ]}
              selecionadas={new Set([...escolhas.habilidades_escolhidas.raca_globais, ...escolhas.habilidades_escolhidas.raca_linhagem])}
              limite={limiteHabilidadesRaca()}
              onToggle={toggleHabilidadeRaca}
            />
          </div>
        )}

        {passoAtual.key === 'classe' && (
          <PassoEscolha
            itens={catalogo.classes}
            selecionadoId={escolhas.classe_id}
            onSelecionar={selecionarClasse}
            renderBadge={(item) => item.pericia_treinada_fixa ? `Perícia fixa: ${nomePericia(catalogo, item.pericia_treinada_fixa)}` : ''}
          />
        )}

        {passoAtual.key === 'habilidades_classe' && (
          <PassoHabilidades
            titulo={`Escolha ${limiteHabilidadesClasse()} habilidade(s) de classe`}
            grupos={[{ rotulo: 'Habilidades', habilidades: classe?.habilidades || [], origemLista: 'classe' }]}
            selecionadas={new Set(escolhas.habilidades_escolhidas.classe)}
            limite={limiteHabilidadesClasse()}
            onToggle={(id) => toggleHabilidadeClasse(id)}
          />
        )}

        {passoAtual.key === 'origem' && (
          <div>
            <PassoEscolha
              itens={catalogo.origens}
              selecionadoId={escolhas.origem_id}
              onSelecionar={selecionarOrigem}
              renderBadge={(item) => (item.pericias_opcoes || []).map((o) => nomePericia(catalogo, o.pericia_id)).join(' · ')}
            />
            {origem && (
              <div className="mt-8">
                <p className="text-mist text-sm mb-3">Escolha a perícia de origem:</p>
                <div className="flex flex-wrap gap-2">
                  {(origem.pericias_opcoes || []).map((o) => (
                    <button
                      key={o.pericia_id}
                      onClick={() => atualizar('origem_pericia_escolhida', o.pericia_id)}
                      className={`text-xs px-3 py-2 rounded border transition-colors
                        ${escolhas.origem_pericia_escolhida === o.pericia_id ? 'border-gold text-gold' : 'border-panel-border text-mist hover:border-white/30'}`}
                    >
                      {nomePericia(catalogo, o.pericia_id)}
                      {o.nota ? ` (${o.nota})` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {passoAtual.key === 'elemento' && (
          <div>
            {deusSagracantico ? (
              <div className="card-fantasy p-5 border-gold/50">
                <p className="text-[11px] uppercase tracking-widest text-mist mb-2">Definido pelo seu Sagracântico</p>
                <div className="font-display font-semibold mb-2">
                  {catalogo.elementos?.[escolhas.elemento_id]?.nome ?? escolhas.elemento_id}
                </div>
                <p className="text-xs text-mist">
                  Sagracânticos de {deusSagracantico.nome} manipulam obrigatoriamente este elemento. Pra escolher
                  outro, volte ao passo "Sagracântico" e selecione "Personagem Comum".
                </p>
              </div>
            ) : (
              <PassoEscolha
                itens={catalogo.elementos}
                selecionadoId={escolhas.elemento_id}
                onSelecionar={selecionarElemento}
                renderBadge={(item) => item.restricao_elegibilidade ? 'Restrição de elegibilidade' : 'Manipulação livre'}
              />
            )}
            {elemento?.restricao_elegibilidade && (
              <label className="mt-6 flex items-start gap-2 text-sm text-mist">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!!escolhas.confirma_elegibilidade_elemento}
                  onChange={(e) => atualizar('confirma_elegibilidade_elemento', e.target.checked)}
                />
                <span>
                  Confirmo que o Mestre validou a condição de elegibilidade:{' '}
                  {elemento.restricao_elegibilidade.condicao || JSON.stringify(elemento.restricao_elegibilidade)}
                </span>
              </label>
            )}
          </div>
        )}

        {passoAtual.key === 'poderes' && isCaca && (
          <div>
            <p className="text-mist text-sm mb-6">Escolha 1 espiritual de Caça.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {Object.entries(elemento?.espirituais || {}).map(([id, esp]) => (
                <button
                  key={id}
                  onClick={() => atualizar('espiritual_escolhido', id)}
                  className={`text-left card-fantasy p-5 transition-colors
                    ${escolhas.espiritual_escolhido === id ? 'border-gold' : 'hover:border-white/20'}`}
                >
                  <div className="font-display font-semibold mb-2">{esp.nome}</div>
                  <p className="text-xs text-mist mb-3">{(esp.bonus_transformacao || []).join(' · ')}</p>
                  {esp.poder_tribal && (
                    <p className="text-xs text-gold flex items-start justify-between gap-2">
                      <span>{esp.poder_tribal.nome}: <span className="text-mist">{esp.poder_tribal.descricao}</span></span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setPoderAberto(esp.poder_tribal) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setPoderAberto(esp.poder_tribal) } }}
                        className="shrink-0 text-[11px] underline hover:text-white"
                      >
                        Ver detalhes
                      </span>
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {passoAtual.key === 'poderes' && !isCaca && (
          <div>
            <p className="text-mist text-sm mb-6">
              Escolha 2 poderes iniciais de {elemento?.nome ?? 'elemento'}. Selecionados: {escolhas.poderes_escolhidos.length} / 2
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {Object.entries(elemento?.poderes || {}).map(([id, poder]) => {
                const selecionado = escolhas.poderes_escolhidos.includes(id)
                return (
                  <button
                    key={id}
                    onClick={() => togglePoder(id)}
                    className={`text-left card-fantasy p-5 transition-colors
                      ${selecionado ? 'border-gold' : 'hover:border-white/20'}`}
                  >
                    <div className="font-display font-semibold mb-2">{poder.nome}</div>
                    <p className="text-xs text-mist mb-3 line-clamp-3">{poder.descricao}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-block text-[11px] px-2 py-1 rounded border border-gold/40 text-gold">
                        Custo: {poder.custo_arche} Arché
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setPoderAberto(poder) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setPoderAberto(poder) } }}
                        className="text-[11px] text-mist underline hover:text-white"
                      >
                        Ver detalhes
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {passoAtual.key === 'atributos' && (
          <div>
            <p className="text-mist text-sm mb-6">
              Distribua pontos entre os atributos (de -1 a 3 cada). Pontos usados: {pontosGastos()} / {pontosDisponiveis()}
              {pontosDisponiveis() > PONTOS_ATRIBUTOS_BASE && ` (${PONTOS_ATRIBUTOS_BASE} base + ${pontosDisponiveis() - PONTOS_ATRIBUTOS_BASE} por atributo(s) negativo(s))`}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {ATRIBUTOS.map((a) => (
                <div key={a} className="stat-tile">
                  <span className="text-xs uppercase tracking-widest text-mist">{NOMES_ATRIBUTOS[a]}</span>
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      className="w-7 h-7 rounded border border-panel-border text-white"
                      onClick={() => atualizar('atributos', { ...escolhas.atributos, [a]: Math.max(-1, escolhas.atributos[a] - 1) })}
                    >-</button>
                    <span className="font-display text-lg w-6 text-center">{escolhas.atributos[a]}</span>
                    <button
                      className="w-7 h-7 rounded border border-panel-border text-white"
                      onClick={() => atualizar('atributos', { ...escolhas.atributos, [a]: Math.min(3, escolhas.atributos[a] + 1) })}
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {passoAtual.key === 'resumo' && (
          <div>
            <p className="text-mist text-sm mb-6">Revise, dê um nome ao personagem e envie para o motor de regras calcular a ficha.</p>

            <label className="flex flex-col gap-1.5 mb-6 max-w-sm">
              <span className="text-[11px] uppercase tracking-widest text-mist">Nome do personagem</span>
              <input
                value={nomePersonagem}
                onChange={(e) => setNomePersonagem(e.target.value)}
                placeholder="Como esse herói é conhecido"
                className="campo-input"
              />
            </label>

            <ResumoEscolhas
              catalogo={catalogo}
              escolhas={escolhas}
              raca={raca}
              linhagem={linhagem}
              classe={classe}
              origem={origem}
              elemento={elemento}
              isCaca={isCaca}
            />

            <button
              className="btn-primary mt-6 disabled:opacity-50"
              onClick={finalizar}
              disabled={salvando || nomePersonagem.trim().length === 0}
            >
              {salvando ? 'Calculando...' : 'Calcular e Salvar Personagem'}
            </button>
            {nomePersonagem.trim().length === 0 && (
              <p className="text-mist text-xs mt-2">Dê um nome ao personagem para poder calcular e salvar.</p>
            )}

            {erros.length > 0 && (
              <div className="mt-6 border border-blood-bright/50 rounded p-4 text-sm">
                <div className="text-blood-bright font-display mb-2">Erros de validação</div>
                <ul className="list-disc list-inside text-mist space-y-1">
                  {erros.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {salvo && (
              <div className="mt-6 border border-forest/60 rounded p-4 text-sm flex items-center justify-between gap-4 flex-wrap">
                <span className="text-forest font-display">Personagem salvo com sucesso.</span>
                <button className="btn-secondary" onClick={() => navigate('/personagens')}>
                  Ver Meus Personagens
                </button>
              </div>
            )}

            {avisoSalvamento && (
              <div className="mt-6 border border-gold/50 rounded p-4 text-sm text-gold">
                {avisoSalvamento}
              </div>
            )}

            {resultado && (
              <FichaVisual
                resultado={resultado}
                catalogo={catalogo}
                raca={raca}
                linhagem={linhagem}
                classe={classe}
                origem={origem}
                elemento={elemento}
                escolhas={escolhas}
                isCaca={isCaca}
              />
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between mt-6">
        <button
          className="btn-secondary disabled:opacity-30"
          disabled={passo === 0}
          onClick={() => setPasso((p) => Math.max(0, p - 1))}
        >
          Anterior
        </button>
        <button
          className="btn-primary disabled:opacity-30"
          disabled={passo === passos.length - 1 || !podeAvancar}
          onClick={() => setPasso((p) => Math.min(passos.length - 1, p + 1))}
        >
          Próximo
        </button>
      </div>

      {poderAberto && (
        <ModalBase onFechar={() => setPoderAberto(null)}>
          <PoderDetalhe p={poderAberto} />
        </ModalBase>
      )}
    </div>
  )
}

function PassoEscolha({ itens, selecionadoId, onSelecionar, renderBadge }) {
  const entradas = Object.entries(itens || {})
  if (entradas.length === 0) {
    return <p className="text-mist text-sm">Nenhum item encontrado no catálogo.</p>
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {entradas.map(([id, item]) => (
        <button
          key={id}
          onClick={() => onSelecionar(id)}
          className={`text-left card-fantasy p-5 transition-colors
            ${selecionadoId === id ? 'border-gold' : 'hover:border-white/20'}`}
        >
          <div className="font-display font-semibold mb-2">{item.nome}</div>
          <p className="text-xs text-mist mb-3 line-clamp-3">{item.descricao_curta || item.descricao || ''}</p>
          {renderBadge && (
            <span className="inline-block text-[11px] px-2 py-1 rounded border border-gold/40 text-gold">
              {renderBadge(item)}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// Passo de seleção múltipla com limite (usado por Habilidades de Raça e
// Habilidades de Classe). `grupos` permite renderizar seções separadas
// (ex.: "Globais" vs "Específicas da Linhagem") que ainda assim compartilham
// o mesmo contador/limite de seleção.
function PassoHabilidades({ titulo, grupos, selecionadas, limite, onToggle }) {
  const totalSelecionadas = selecionadas.size
  const semOpcoes = grupos.every((g) => (g.habilidades || []).length === 0)

  if (semOpcoes) {
    return <p className="text-mist text-sm">Nenhuma habilidade disponível no catálogo para esta escolha.</p>
  }

  return (
    <div>
      <p className="text-mist text-sm mb-6">{titulo}. Selecionadas: {totalSelecionadas} / {limite}</p>
      <div className="space-y-8">
        {grupos.map((grupo) => (
          (grupo.habilidades || []).length > 0 && (
            <div key={grupo.rotulo}>
              <div className="text-xs uppercase tracking-widest text-mist mb-3">{grupo.rotulo}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {grupo.habilidades.map((h) => {
                  const selecionada = selecionadas.has(h.id)
                  const bloqueada = !selecionada && totalSelecionadas >= limite
                  return (
                    <button
                      key={h.id}
                      disabled={bloqueada}
                      onClick={() => onToggle(h.id, grupo.origemLista)}
                      className={`text-left card-fantasy p-4 transition-colors disabled:opacity-30
                        ${selecionada ? 'border-gold' : 'hover:border-white/20'}`}
                    >
                      <div className="font-display font-semibold mb-1 text-sm">{h.nome}</div>
                      <p className="text-xs text-mist line-clamp-3">{h.descricao}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}