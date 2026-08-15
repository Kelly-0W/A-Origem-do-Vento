import { useMemo, useState } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import {
  PORTES_VALIDOS,
  capacidadeCargaMaximaKg,
  capacidadeEsforcoBrutoKg,
  pesoEfetivoItem,
  pesoTotalInventario,
  estadoDeCarga,
  registrarAcerto,
  repararItem,
  durabilidadeMaximaMaterial,
  limiarDesgasteMaterial,
  NIVEL_NORMAL,
  NIVEL_LIMITE_ABSOLUTO,
} from '../lib/inventario.js'
import ModalBase from './ModalBase.jsx'

// Só armas, armaduras e escudos são forjados de um minério e carregam
// durabilidade (ver Tabela de Materiais, página "Peso" do Notion).
const CATEGORIAS_COM_DURABILIDADE = ['arma', 'armadura', 'escudo']

// A "Regra de Desgaste e Quebra" do Notion é explícita: "As armas e
// escudos de Midgard sofrem fadiga material" -- só ESSAS duas categorias
// perdem durabilidade automaticamente a cada acerto. Armadura tem
// Durabilidade Total (é feita de um material como qualquer outra), mas a
// regra não define um gatilho automático pra ela perder pontos -- por
// isso o botão "Registrar acerto" só aparece pra arma/escudo; armadura
// ganha um ajuste manual neutro, a critério do Mestre.
const CATEGORIAS_COM_REGRA_DE_ACERTO = ['arma', 'escudo']

const ROTULO_CATEGORIA = {
  arma: 'Arma',
  armadura: 'Armadura',
  escudo: 'Escudo',
  ferramenta: 'Ferramenta',
  sobrevivencia: 'Sobrevivência',
  consumivel: 'Consumível',
}

function novaEntradaId() {
  return crypto.randomUUID?.() ?? `item-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function minerioPadraoDoItem(item) {
  return item?.arma?.minerio ?? item?.defesa?.minerio ?? null
}

function arredondar(n) {
  return Math.round((n + Number.EPSILON) * 1000) / 1000
}

export default function PainelInventario({
  personagemId,
  interativo,
  inventario,
  catalogoItens,
  materiais,
  porteBiologico,
  forcaFinal,
  deslocamentoBaseM,
  onAtualizado,
}) {
  const [modalAberto, setModalAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')
  const [itemEscolhidoId, setItemEscolhidoId] = useState(null)
  const [minerioEscolhido, setMinerioEscolhido] = useState('cobre')
  const [quantidadeEscolhida, setQuantidadeEscolhida] = useState(1)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState(null)

  const lista = inventario || []

  const porteValido = PORTES_VALIDOS.includes(porteBiologico)
  const capacidadeMaximaKg = useMemo(
    () => (porteValido ? capacidadeCargaMaximaKg(porteBiologico, forcaFinal ?? 0) : null),
    [porteValido, porteBiologico, forcaFinal]
  )
  const pesoTotalKg = useMemo(
    () => pesoTotalInventario(lista, catalogoItens, materiais),
    [lista, catalogoItens, materiais]
  )
  const carga = useMemo(
    () =>
      capacidadeMaximaKg != null
        ? estadoDeCarga(pesoTotalKg, capacidadeMaximaKg, deslocamentoBaseM ?? 0)
        : null,
    [pesoTotalKg, capacidadeMaximaKg, deslocamentoBaseM]
  )

  async function persistir(novaLista) {
    if (!interativo || !personagemId) return
    setProcessando(true)
    setErro(null)
    try {
      await updateDoc(doc(db, 'personagens', personagemId), {
        inventario: novaLista,
        atualizado_em: serverTimestamp(),
      })
      onAtualizado?.(novaLista)
    } catch (err) {
      console.error(err)
      setErro('Não foi possível atualizar o inventário agora.')
    } finally {
      setProcessando(false)
    }
  }

  function abrirModalAdicionar() {
    setBusca('')
    setCategoriaFiltro('todas')
    setItemEscolhidoId(null)
    setMinerioEscolhido('cobre')
    setQuantidadeEscolhida(1)
    setErro(null)
    setModalAberto(true)
  }

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return Object.entries(catalogoItens || {})
      .filter(([, item]) => (categoriaFiltro === 'todas' ? true : item.categoria === categoriaFiltro))
      .filter(([, item]) => (termo ? item.nome.toLowerCase().includes(termo) : true))
      .sort((a, b) => a[1].nome.localeCompare(b[1].nome))
  }, [catalogoItens, busca, categoriaFiltro])

  const itemEscolhido = itemEscolhidoId ? catalogoItens?.[itemEscolhidoId] : null
  const itemEscolhidoTemDurabilidade =
    !!itemEscolhido && CATEGORIAS_COM_DURABILIDADE.includes(itemEscolhido.categoria)
  const itemEscolhidoUsaMinerio = !!itemEscolhido && !!(itemEscolhido.arma || itemEscolhido.defesa)

  function confirmarAdicao() {
    if (!itemEscolhido) return
    const minerio = itemEscolhidoUsaMinerio ? minerioEscolhido : null
    const quantidade = itemEscolhidoTemDurabilidade ? 1 : Math.max(1, Number(quantidadeEscolhida) || 1)
    const durabilidadeInicial = itemEscolhidoTemDurabilidade
      ? durabilidadeMaximaMaterial(minerio, materiais)
      : null
    const novaEntrada = {
      id: novaEntradaId(),
      item_id: itemEscolhidoId,
      minerio,
      quantidade,
      durabilidade_atual: durabilidadeInicial,
      quebrado: false,
    }
    persistir([...lista, novaEntrada])
    setModalAberto(false)
  }

  function removerEntrada(entradaId) {
    persistir(lista.filter((e) => e.id !== entradaId))
  }

  function ajustarQuantidade(entradaId, delta) {
    const nova = lista.map((e) =>
      e.id === entradaId ? { ...e, quantidade: Math.max(1, (Number(e.quantidade) || 1) + delta) } : e
    )
    persistir(nova)
  }

  function aplicarAcerto(entradaId, alvoProtegido) {
    const nova = lista.map((e) => {
      if (e.id !== entradaId) return e
      const resultado = registrarAcerto(e.durabilidade_atual, e.minerio, materiais, alvoProtegido)
      return { ...e, durabilidade_atual: resultado.durabilidadeAtual, quebrado: resultado.quebrado }
    })
    persistir(nova)
  }

  function repararEntrada(entradaId) {
    const nova = lista.map((e) => {
      if (e.id !== entradaId) return e
      const resultado = repararItem(e.minerio, materiais)
      return { ...e, durabilidade_atual: resultado.durabilidadeAtual, quebrado: resultado.quebrado }
    })
    persistir(nova)
  }

  const corTextoNivel =
    carga?.nivel === NIVEL_LIMITE_ABSOLUTO ? 'text-blood-bright' : carga && carga.nivel !== NIVEL_NORMAL ? 'text-gold' : 'text-white'
  const corBarraNivel =
    carga?.nivel === NIVEL_LIMITE_ABSOLUTO ? 'bg-blood-bright' : carga && carga.nivel !== NIVEL_NORMAL ? 'bg-gold' : 'bg-forest'
  const percentualBarra =
    carga && carga.limiteAbsolutoKg > 0 ? Math.min(100, Math.round((pesoTotalKg / carga.limiteAbsolutoKg) * 100)) : 0

  return (
    <div className="card-fantasy p-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-display text-white">Inventário</h2>
        {interativo && (
          <button className="btn-secondary text-xs" onClick={abrirModalAdicionar} disabled={processando}>
            + Adicionar item
          </button>
        )}
      </div>

      {carga ? (
        <>
          <div className="mb-2 flex items-baseline justify-between text-xs flex-wrap gap-1">
            <span className="text-mist">
              Peso: <span className={corTextoNivel}>{pesoTotalKg} kg</span> / {carga.capacidadeMaximaKg} kg
            </span>
            <span className="text-mist">Limite absoluto: {carga.limiteAbsolutoKg} kg</span>
          </div>
          <div className="relative w-full h-2 rounded-full bg-void border border-panel-border overflow-hidden mb-1">
            <div className={`h-full ${corBarraNivel} transition-all`} style={{ width: `${percentualBarra}%` }} />
            <div className="absolute top-0 bottom-0 w-px bg-white/30" style={{ left: '50%' }} title="Capacidade máxima" />
          </div>
          <p className="text-[10px] text-mist mb-3">
            Força bruta (erguer/empurrar/arrastar): até {capacidadeEsforcoBrutoKg(carga.capacidadeMaximaKg)} kg, sem
            penalidade.
          </p>

          {carga.nivel === NIVEL_NORMAL ? (
            <p className="text-xs text-mist mb-5">Carga dentro do limite — sem penalidades de movimento.</p>
          ) : (
            <div
              className={`text-xs mb-5 border rounded-md p-3 ${
                carga.nivel === NIVEL_LIMITE_ABSOLUTO
                  ? 'border-blood-bright/40 bg-blood-bright/5 text-blood-bright'
                  : 'border-gold/40 bg-gold/5 text-gold'
              }`}
            >
              <p className="font-semibold mb-1">
                {carga.nivel === NIVEL_LIMITE_ABSOLUTO ? 'Limite absoluto excedido' : 'Sobrecarregado'}
              </p>
              <p>
                Deslocamento reduzido em {carga.reducaoDeslocamentoM}m (de {deslocamentoBaseM}m para{' '}
                {carga.deslocamentoFinalM}m).
                {carga.nivel === NIVEL_LIMITE_ABSOLUTO && ' Incapaz de andar ou esquivar.'}
              </p>
              <p>Desvantagem em Atletismo, Acrobacia, Furtividade, Velocidade e Reflexo.</p>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-mist mb-5">
          Peso total: {pesoTotalKg} kg. Capacidade de carga indisponível — porte biológico da raça ainda não
          cadastrado no catálogo.
        </p>
      )}

      {erro && <p className="text-blood-bright text-xs mb-3">{erro}</p>}

      {lista.length === 0 ? (
        <p className="text-mist text-sm">Nenhum item no inventário ainda.</p>
      ) : (
        <div className="space-y-2">
          {lista.map((entrada) => {
            const item = catalogoItens?.[entrada.item_id]
            if (!item) {
              return (
                <div
                  key={entrada.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md border border-panel-border bg-void/40 text-xs text-mist"
                >
                  <span>Item removido do catálogo ({entrada.item_id})</span>
                  {interativo && (
                    <button className="text-blood-bright hover:underline shrink-0" onClick={() => removerEntrada(entrada.id)}>
                      Remover
                    </button>
                  )}
                </div>
              )
            }

            const temDurabilidade = CATEGORIAS_COM_DURABILIDADE.includes(item.categoria)
            const usaRegraDeAcerto = CATEGORIAS_COM_REGRA_DE_ACERTO.includes(item.categoria)
            const material = entrada.minerio ? materiais?.[entrada.minerio] : null
            const pesoUnitario = pesoEfetivoItem(item.peso_base_kg || 0, entrada.minerio, materiais)
            const maximoDurabilidade = temDurabilidade ? durabilidadeMaximaMaterial(entrada.minerio, materiais) : null
            const limiar = temDurabilidade ? limiarDesgasteMaterial(entrada.minerio, materiais) : null
            const indestrutivel = temDurabilidade && maximoDurabilidade === null
            const durabilidadeAtual = entrada.durabilidade_atual ?? maximoDurabilidade
            const emLimiar =
              temDurabilidade &&
              !indestrutivel &&
              !entrada.quebrado &&
              limiar != null &&
              durabilidadeAtual != null &&
              durabilidadeAtual <= limiar

            return (
              <div key={entrada.id} className="p-3 rounded-md border border-panel-border bg-void/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium text-sm">{item.nome}</span>
                      <span className="text-[10px] uppercase tracking-widest text-mist">
                        {ROTULO_CATEGORIA[item.categoria] ?? item.categoria}
                      </span>
                      {material && <span className="text-[10px] text-mist">· {material.nome}</span>}
                      {entrada.quebrado && <span className="text-[10px] text-blood-bright font-semibold">QUEBRADO</span>}
                      {emLimiar && <span className="text-[10px] text-gold font-semibold">Limiar de desgaste</span>}
                    </div>
                    <p className="text-[11px] text-mist mt-0.5">
                      {pesoUnitario} kg
                      {entrada.quantidade > 1 ? ` x${entrada.quantidade} = ${arredondar(pesoUnitario * entrada.quantidade)} kg` : ''}
                    </p>
                  </div>
                  {interativo && (
                    <button className="text-mist hover:text-blood-bright text-xs shrink-0" onClick={() => removerEntrada(entrada.id)}>
                      Remover
                    </button>
                  )}
                </div>

                {!temDurabilidade && interativo && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      className="btn-secondary text-xs px-2 py-0.5"
                      onClick={() => ajustarQuantidade(entrada.id, -1)}
                      disabled={processando || entrada.quantidade <= 1}
                    >
                      −
                    </button>
                    <span className="text-xs text-mist">Quantidade: {entrada.quantidade}</span>
                    <button className="btn-secondary text-xs px-2 py-0.5" onClick={() => ajustarQuantidade(entrada.id, 1)} disabled={processando}>
                      +
                    </button>
                  </div>
                )}

                {temDurabilidade && (
                  <div className="mt-2">
                    {indestrutivel ? (
                      <p className="text-[11px] text-gold">Indestrutível ({material?.nome})</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-[11px] text-mist mb-1">
                          <span>
                            Durabilidade: {durabilidadeAtual} / {maximoDurabilidade}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-void border border-panel-border overflow-hidden mb-2">
                          <div
                            className={`h-full ${entrada.quebrado ? 'bg-blood-bright' : emLimiar ? 'bg-gold' : 'bg-forest'}`}
                            style={{
                              width: `${Math.max(0, Math.min(100, ((durabilidadeAtual ?? 0) / maximoDurabilidade) * 100))}%`,
                            }}
                          />
                        </div>
                        {interativo && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {!entrada.quebrado && usaRegraDeAcerto && (
                              <>
                                <button
                                  className="btn-secondary text-[11px] px-2 py-0.5"
                                  onClick={() => aplicarAcerto(entrada.id, false)}
                                  disabled={processando}
                                  title="A cada ataque físico bem-sucedido usando este item, ele perde 1 ponto de durabilidade."
                                >
                                  Registrar acerto (−1)
                                </button>
                                <button
                                  className="btn-secondary text-[11px] px-2 py-0.5"
                                  onClick={() => aplicarAcerto(entrada.id, true)}
                                  disabled={processando}
                                  title="Se o alvo usava armadura ou tinha pele densa, o item perde 2 pontos."
                                >
                                  Acerto em alvo protegido (−2)
                                </button>
                              </>
                            )}
                            {!entrada.quebrado && !usaRegraDeAcerto && (
                              <div
                                className="flex items-center gap-2"
                                title="A Regra de Desgaste e Quebra do Notion se aplica a armas e escudos; use isto pra ajustar a durabilidade da armadura manualmente, a critério do Mestre."
                              >
                                <button className="btn-secondary text-[11px] px-2 py-0.5" onClick={() => aplicarAcerto(entrada.id, false)} disabled={processando}>
                                  Ajustar (−1)
                                </button>
                                <button className="btn-secondary text-[11px] px-2 py-0.5" onClick={() => aplicarAcerto(entrada.id, true)} disabled={processando}>
                                  Ajustar (−2)
                                </button>
                              </div>
                            )}
                            <button className="text-[11px] text-forest hover:underline" onClick={() => repararEntrada(entrada.id)} disabled={processando}>
                              Reparar
                            </button>
                          </div>
                        )}
                        {emLimiar && (
                          <p className="text-[11px] text-gold mt-1">
                            No limiar de desgaste: a cada acerto, role 1d12 — em 1, o item quebra.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modalAberto && (
        <ModalBase titulo="Adicionar item" onFechar={() => setModalAberto(false)}>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar item..."
                className="campo-input flex-1"
              />
              <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className="campo-input w-36">
                <option value="todas">Todas</option>
                {Object.entries(ROTULO_CATEGORIA).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-48 overflow-y-auto border border-panel-border rounded-md divide-y divide-panel-border">
              {itensFiltrados.length === 0 && <p className="text-mist text-xs p-3">Nenhum item encontrado.</p>}
              {itensFiltrados.map(([id, item]) => (
                <button
                  key={id}
                  onClick={() => {
                    setItemEscolhidoId(id)
                    setMinerioEscolhido(minerioPadraoDoItem(item) || 'cobre')
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-panel-border/40 transition-colors ${
                    itemEscolhidoId === id ? 'bg-gold/10 text-gold' : 'text-mist'
                  }`}
                >
                  <span className="text-white">{item.nome}</span>
                  <span className="ml-2 text-[10px] uppercase tracking-widest">{ROTULO_CATEGORIA[item.categoria] ?? item.categoria}</span>
                  <span className="ml-2 text-[10px]">{item.peso_base_kg} kg base</span>
                </button>
              ))}
            </div>

            {itemEscolhido && (
              <div className="border-t border-panel-border pt-3 flex flex-col gap-3">
                {itemEscolhidoUsaMinerio && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] uppercase tracking-widest text-mist">Minério</span>
                    <select value={minerioEscolhido} onChange={(e) => setMinerioEscolhido(e.target.value)} className="campo-input">
                      {Object.entries(materiais || {}).map(([id, mat]) => (
                        <option key={id} value={id}>
                          {mat.nome} (x{mat.multiplicador_peso})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {!itemEscolhidoTemDurabilidade && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] uppercase tracking-widest text-mist">Quantidade</span>
                    <input
                      type="number"
                      min={1}
                      value={quantidadeEscolhida}
                      onChange={(e) => setQuantidadeEscolhida(e.target.value)}
                      className="campo-input"
                    />
                  </label>
                )}
                <button className="btn-primary disabled:opacity-50" onClick={confirmarAdicao} disabled={processando}>
                  {processando ? 'Adicionando...' : 'Adicionar ao inventário'}
                </button>
              </div>
            )}
          </div>
        </ModalBase>
      )}
    </div>
  )
}
