import { useEffect, useState } from 'react'
import {
  collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'
import ModalBase from '../components/ModalBase.jsx'
import {
  participanteDePersonagem, participanteDeMonstro, efeitoAplicado,
  resolverInicioDeTurno, aplicarTickEfeito, EFEITOS_COM_TICK,
} from '../lib/combate.js'

const ROTULO_STATUS = { preparando: 'Preparando', em_andamento: 'Em andamento', encerrado: 'Encerrado' }
const ROTULO_TIPO = { personagem: 'Personagem', monstro: 'Monstro', npc: 'NPC' }

function ModalNovoEncontro({ campanhas, onFechar, onCriado }) {
  const [campanhaId, setCampanhaId] = useState(campanhas[0]?.id || '')
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  async function criar() {
    if (!nome.trim() || !campanhaId) return
    setSalvando(true)
    setErro(null)
    try {
      const campanha = campanhas.find((c) => c.id === campanhaId)
      const referencia = doc(collection(db, 'encontros'))
      const dados = {
        campanha_id: campanhaId,
        campanha_nome: campanha?.nome || null,
        mestre_id: campanha.mestre_id,
        nome: nome.trim(),
        status: 'preparando',
        participantes: [],
        ordem: [],
        criado_em: serverTimestamp(),
        atualizado_em: serverTimestamp(),
      }
      await setDoc(referencia, dados)
      onCriado({ id: referencia.id, ...dados })
    } catch (err) {
      console.error(err)
      setErro('Não foi possível criar o encontro agora.')
    } finally {
      setSalvando(false)
    }
  }

  if (campanhas.length === 0) {
    return (
      <ModalBase titulo="Novo Encontro" onFechar={onFechar}>
        <p className="text-mist text-sm">
          Você precisa ser mestre de ao menos uma campanha pra criar um encontro.
        </p>
      </ModalBase>
    )
  }

  return (
    <ModalBase titulo="Novo Encontro" onFechar={onFechar}>
      <label className="flex flex-col gap-1.5 mb-4">
        <span className="text-[11px] uppercase tracking-widest text-mist">Campanha</span>
        <select value={campanhaId} onChange={(e) => setCampanhaId(e.target.value)} className="campo-input">
          {campanhas.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 mb-5">
        <span className="text-[11px] uppercase tracking-widest text-mist">Nome do encontro</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Emboscada na Estrada" className="campo-input" />
      </label>

      {erro && <p className="text-blood-bright text-xs mb-4">{erro}</p>}

      <button className="btn-primary w-full disabled:opacity-50" onClick={criar} disabled={salvando || !nome.trim()}>
        {salvando ? 'Criando...' : 'Criar Encontro'}
      </button>
    </ModalBase>
  )
}

function ModalAdicionarPersonagens({ encontro, mestreUid, onFechar, onAdicionados }) {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [itens, setItens] = useState([])
  const [selecionados, setSelecionados] = useState([])
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      setErro(null)
      try {
        const { dados } = await api.buscarPersonagensDaCampanhaComoMestre(encontro.campanha_id, mestreUid)
        if (!dados?.sucesso) {
          setErro('Não foi possível carregar os personagens da campanha.')
          return
        }
        const idsJaAdicionados = new Set(
          encontro.participantes.filter((p) => p.tipo === 'personagem').map((p) => p.ref_id)
        )
        setItens(dados.itens.filter((item) => !idsJaAdicionados.has(item.id)))
      } catch (err) {
        console.error(err)
        setErro('Não foi possível carregar os personagens da campanha.')
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [encontro.campanha_id, mestreUid])

  function alternar(id) {
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function adicionar() {
    setSalvando(true)
    try {
      const novos = itens.filter((item) => selecionados.includes(item.id)).map(participanteDePersonagem)
      const participantes = [...encontro.participantes, ...novos]
      await updateDoc(doc(db, 'encontros', encontro.id), { participantes, atualizado_em: serverTimestamp() })
      onAdicionados(participantes)
    } catch (err) {
      console.error(err)
      setErro('Não foi possível adicionar os personagens agora.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <ModalBase titulo="Adicionar Personagens" onFechar={onFechar}>
      {carregando ? (
        <p className="text-mist text-sm">Carregando...</p>
      ) : erro ? (
        <p className="text-blood-bright text-sm">{erro}</p>
      ) : itens.length === 0 ? (
        <p className="text-mist text-sm">Todos os personagens da campanha já estão neste encontro.</p>
      ) : (
        <>
          <div className="flex flex-col gap-2 mb-5 max-h-80 overflow-y-auto">
            {itens.map((item) => {
              const marcado = selecionados.includes(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => alternar(item.id)}
                  className={`text-left p-3 rounded border flex items-center justify-between gap-3 transition-colors
                    ${marcado ? 'border-gold' : 'border-panel-border hover:border-white/20'}`}
                >
                  <div>
                    <div className="font-display text-sm">{item.nome_personagem || 'Personagem sem nome'}</div>
                    <div className="text-xs text-mist">{item.dono_nome || 'jogador desconhecido'}</div>
                  </div>
                  {marcado && <span className="text-gold text-xs shrink-0">Selecionado</span>}
                </button>
              )
            })}
          </div>
          <button className="btn-primary w-full disabled:opacity-50" onClick={adicionar} disabled={salvando || selecionados.length === 0}>
            {salvando ? 'Adicionando...' : `Adicionar ${selecionados.length || ''}`.trim()}
          </button>
        </>
      )}
    </ModalBase>
  )
}

function ModalAdicionarMonstro({ encontro, onFechar, onAdicionados }) {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [bestiario, setBestiario] = useState({})
  const [marcosTreinamento, setMarcosTreinamento] = useState(null)
  const [monstroId, setMonstroId] = useState(null)
  const [quantidade, setQuantidade] = useState(1)
  const [grau, setGrau] = useState(0)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      setErro(null)
      try {
        const [respBestiario, respConstantes] = await Promise.all([
          api.buscarBiblioteca('bestiario'),
          api.buscarBiblioteca('constantes_ascensao'),
        ])
        if (!respBestiario.dados?.sucesso) {
          setErro('Não foi possível carregar o bestiário.')
          return
        }
        setBestiario(respBestiario.dados.itens)
        setMarcosTreinamento(respConstantes.dados?.itens?.bonus_treinamento_pericia?.marcos || {})
      } catch (err) {
        console.error(err)
        setErro('Não foi possível carregar o bestiário.')
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [])

  async function adicionar() {
    if (!monstroId) return
    setSalvando(true)
    try {
      const monstro = bestiario[monstroId]
      const novos = Array.from({ length: quantidade }, (_, i) =>
        participanteDeMonstro(monstro, monstroId, i + 1, quantidade, grau, marcosTreinamento)
      )
      const participantes = [...encontro.participantes, ...novos]
      await updateDoc(doc(db, 'encontros', encontro.id), { participantes, atualizado_em: serverTimestamp() })
      onAdicionados(participantes)
    } catch (err) {
      console.error(err)
      setErro('Não foi possível adicionar o monstro agora.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <ModalBase titulo="Adicionar Monstro do Bestiário" onFechar={onFechar}>
      {carregando ? (
        <p className="text-mist text-sm">Carregando...</p>
      ) : erro ? (
        <p className="text-blood-bright text-sm">{erro}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 mb-5 max-h-72 overflow-y-auto">
            {Object.entries(bestiario).map(([id, m]) => (
              <button
                key={id}
                onClick={() => setMonstroId(id)}
                className={`text-left p-3 rounded border transition-colors
                  ${monstroId === id ? 'border-gold' : 'border-panel-border hover:border-white/20'}`}
              >
                <div className="font-display text-sm">{m.nome}</div>
                <div className="text-[11px] text-mist capitalize">{m.categoria} · {m.elemento}</div>
              </button>
            ))}
          </div>

          {monstroId && (
            <div className="flex flex-wrap items-center gap-6 mb-5">
              <div className="flex items-center gap-3">
                <span className="text-[11px] uppercase tracking-widest text-mist">Quantidade</span>
                <button className="w-7 h-7 rounded border border-panel-border text-white" onClick={() => setQuantidade((q) => Math.max(1, q - 1))}>-</button>
                <span className="font-display text-lg w-6 text-center">{quantidade}</span>
                <button className="w-7 h-7 rounded border border-panel-border text-white" onClick={() => setQuantidade((q) => Math.min(20, q + 1))}>+</button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] uppercase tracking-widest text-mist">Grau de Ascensão</span>
                <button className="w-7 h-7 rounded border border-panel-border text-white" onClick={() => setGrau((g) => Math.max(0, g - 1))}>-</button>
                <span className="font-display text-lg w-6 text-center">{grau}</span>
                <button className="w-7 h-7 rounded border border-panel-border text-white" onClick={() => setGrau((g) => Math.min(10, g + 1))}>+</button>
              </div>
            </div>
          )}

          <button className="btn-primary w-full disabled:opacity-50" onClick={adicionar} disabled={salvando || !monstroId}>
            {salvando ? 'Adicionando...' : 'Adicionar ao Encontro'}
          </button>
        </>
      )}
    </ModalBase>
  )
}

function LinhaRecurso({ label, atual, max, sufixo = '', passoInicial = 1, onAjustar }) {
  const [passoTexto, setPassoTexto] = useState(String(passoInicial))
  const passo = Number(passoTexto) || passoInicial

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-mist shrink-0">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onAjustar(-passo)}
          className="w-5 h-5 rounded-full border border-panel-border text-mist hover:border-gold/50 hover:text-gold text-xs leading-none flex items-center justify-center shrink-0"
        >
          −
        </button>
        <span className="text-xs text-white w-14 text-center shrink-0">
          {atual}{max != null ? `/${max}` : ''}{sufixo}
        </span>
        <button
          onClick={() => onAjustar(passo)}
          className="w-5 h-5 rounded-full border border-panel-border text-mist hover:border-gold/50 hover:text-gold text-xs leading-none flex items-center justify-center shrink-0"
        >
          +
        </button>
        <input
          type="number"
          value={passoTexto}
          onChange={(e) => setPassoTexto(e.target.value)}
          title="Quantidade por clique"
          className="w-10 text-[10px] bg-transparent border border-panel-border rounded px-1 py-0.5 text-center text-mist"
        />
      </div>
    </div>
  )
}

function ChipEfeito({ efeito, onRemover }) {
  const cor = efeito.tipo === 'positivo' ? 'border-forest/50 text-forest' : 'border-blood-bright/50 text-blood-bright'
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border ${cor}`}>
      {efeito.nome}
      {efeito.duracao_tipo === 'rodadas' && efeito.rodadas_restantes != null && ` (${efeito.rodadas_restantes}r)`}
      {efeito.acumulos != null && ` [${efeito.acumulos}]`}
      <button onClick={onRemover} className="hover:opacity-70 leading-none" aria-label="Remover efeito">×</button>
    </span>
  )
}

function CardParticipante({ participante, onRemover, onAjustar, onAbrirEfeito, onRemoverEfeito }) {
  return (
    <div className="card-fantasy p-4 relative">
      <button
        onClick={onRemover}
        className="absolute top-2 right-2 text-mist hover:text-blood-bright text-sm leading-none"
        aria-label="Remover"
      >
        ×
      </button>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded border border-panel-border bg-void overflow-hidden shrink-0 flex items-center justify-center">
          {participante.imagem_base64 ? (
            <img src={participante.imagem_base64} alt={participante.nome} className="w-full h-full object-cover" />
          ) : (
            <span className="text-mist text-[9px]">—</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="font-display text-sm truncate">{participante.nome}</div>
          <div className="text-[11px] text-mist">
            {ROTULO_TIPO[participante.tipo]}{participante.dono_nome ? ` · ${participante.dono_nome}` : ''}
            {participante.tipo === 'monstro' ? ` · Grau ${participante.grau}` : ''}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 mb-3">
        <LinhaRecurso
          label="Vida"
          atual={participante.vida_atual}
          max={participante.vida_maxima}
          onAjustar={(delta) => onAjustar('vida_atual', delta, { min: 0, max: participante.vida_maxima })}
        />
        <LinhaRecurso
          label="Sanidade"
          atual={participante.sanidade_atual}
          max={participante.sanidade_maxima}
          onAjustar={(delta) => onAjustar('sanidade_atual', delta, { min: 0, max: participante.sanidade_maxima })}
        />
        <LinhaRecurso
          label="Arché"
          atual={participante.arche_atual}
          max={participante.arche_maximo}
          onAjustar={(delta) => onAjustar('arche_atual', delta, { min: 0, max: participante.arche_maximo })}
        />
        <LinhaRecurso
          label="Defesa"
          atual={participante.defesa + (participante.bonus_defesa || 0)}
          onAjustar={(delta) => onAjustar('bonus_defesa', delta, { min: 0 })}
        />
        <LinhaRecurso
          label="Deslocamento"
          atual={participante.deslocamento_m + (participante.bonus_deslocamento || 0)}
          sufixo="m"
          passoInicial={1.5}
          onAjustar={(delta) => onAjustar('bonus_deslocamento', delta, { min: 0 })}
        />
      </div>

      <div className="border-t border-panel-border pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-widest text-mist">Efeitos</span>
          <button onClick={onAbrirEfeito} className="text-[11px] text-gold hover:underline">+ Efeito</button>
        </div>
        {(participante.efeitos || []).length === 0 ? (
          <p className="text-[11px] text-mist">Nenhum efeito ativo.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {participante.efeitos.map((efeito) => (
              <ChipEfeito key={efeito.id} efeito={efeito} onRemover={() => onRemoverEfeito(efeito.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ModalAdicionarEfeito({ efeitos, onFechar, onAplicar }) {
  const [efeitoId, setEfeitoId] = useState(null)
  const [rodadas, setRodadas] = useState('')

  const efeitoSelecionado = efeitoId ? efeitos[efeitoId] : null
  const positivos = Object.entries(efeitos).filter(([, e]) => e.tipo === 'positivo')
  const negativos = Object.entries(efeitos).filter(([, e]) => e.tipo === 'negativo')

  function selecionar(id) {
    setEfeitoId(id)
    const e = efeitos[id]
    setRodadas(e.duracao_tipo === 'rodadas' ? String(e.duracao_rodadas_padrao ?? '') : '')
  }

  function aplicar() {
    if (!efeitoSelecionado) return
    const efeitoComDuracaoCustomizada = rodadas !== '' && efeitoSelecionado.duracao_tipo === 'rodadas'
      ? { ...efeitoSelecionado, duracao_rodadas_padrao: Number(rodadas) }
      : efeitoSelecionado
    onAplicar(efeitoId, efeitoComDuracaoCustomizada)
  }

  return (
    <ModalBase titulo="Aplicar Efeito" onFechar={onFechar}>
      <div className="grid grid-cols-2 gap-4 mb-5 max-h-80 overflow-y-auto">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-forest mb-2">Positivos</div>
          <div className="flex flex-col gap-1.5">
            {positivos.map(([id, e]) => (
              <button
                key={id}
                onClick={() => selecionar(id)}
                className={`text-left text-xs p-2 rounded border transition-colors
                  ${efeitoId === id ? 'border-gold text-gold' : 'border-panel-border text-mist hover:border-white/20'}`}
              >
                {e.nome}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-widest text-blood-bright mb-2">Negativos</div>
          <div className="flex flex-col gap-1.5">
            {negativos.map(([id, e]) => (
              <button
                key={id}
                onClick={() => selecionar(id)}
                className={`text-left text-xs p-2 rounded border transition-colors
                  ${efeitoId === id ? 'border-gold text-gold' : 'border-panel-border text-mist hover:border-white/20'}`}
              >
                {e.nome}
              </button>
            ))}
          </div>
        </div>
      </div>

      {efeitoSelecionado && (
        <div className="border-t border-panel-border pt-4 mb-5">
          <p className="text-xs text-mist mb-2">{efeitoSelecionado.descricao}</p>
          <ul className="list-disc list-inside text-xs text-mist space-y-1 mb-3">
            {efeitoSelecionado.mecanica.map((linha, i) => <li key={i}>{linha}</li>)}
          </ul>
          {efeitoSelecionado.duracao_tipo === 'rodadas' && (
            <label className="flex items-center gap-2 text-xs text-mist">
              Duração (rodadas)
              <input
                type="number"
                value={rodadas}
                onChange={(e) => setRodadas(e.target.value)}
                className="campo-input w-20 py-1"
              />
            </label>
          )}
          {efeitoSelecionado.duracao_tipo !== 'rodadas' && (
            <p className="text-[11px] text-mist italic">
              {efeitoSelecionado.duracao_tipo === 'instantaneo'
                ? 'Efeito instantâneo -- não fica como um estado contínuo.'
                : 'Sem contagem de rodadas fixa -- dura até ser removido por alguma condição descrita acima.'}
            </p>
          )}
        </div>
      )}

      <button className="btn-primary w-full disabled:opacity-50" onClick={aplicar} disabled={!efeitoSelecionado}>
        Aplicar
      </button>
    </ModalBase>
  )
}

function SecaoIniciativa({ encontro, onAtualizado }) {
  const [extras, setExtras] = useState(() =>
    Object.fromEntries(encontro.participantes.map((p) => [p.id, p.iniciativa_extra ?? '']))
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  const ordemCalculada = encontro.ordem && encontro.ordem.length > 0
    ? encontro.ordem
        .map((id) => encontro.participantes.find((p) => p.id === id))
        .filter(Boolean)
    : []
  const participantesForaDaOrdem = encontro.participantes.filter(
    (p) => !encontro.ordem?.includes(p.id)
  )

  async function calcularOrdem() {
    setSalvando(true)
    setErro(null)
    try {
      const participantesAtualizados = encontro.participantes.map((p) => {
        const extraTexto = extras[p.id]
        const extra = p.velocidade_treinada && extraTexto !== '' && extraTexto != null ? Number(extraTexto) : null
        const final = (p.iniciativa_bonus || 0) + (extra || 0)
        return { ...p, iniciativa_extra: extra, iniciativa_final: final }
      })
      const ordem = [...participantesAtualizados]
        .sort((a, b) => b.iniciativa_final - a.iniciativa_final)
        .map((p) => p.id)

      await updateDoc(doc(db, 'encontros', encontro.id), {
        participantes: participantesAtualizados,
        ordem,
        status: 'em_andamento',
        turno_index: null,
        rodada_atual: 1,
        atualizado_em: serverTimestamp(),
      })
      onAtualizado(participantesAtualizados, ordem)
    } catch (err) {
      console.error(err)
      setErro('Não foi possível calcular a ordem agora.')
    } finally {
      setSalvando(false)
    }
  }

  if (encontro.participantes.length === 0) return null

  return (
    <div className="mt-8 border-t border-panel-border pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg">Ordem de Iniciativa</h3>
        <button className="btn-secondary text-xs" onClick={calcularOrdem} disabled={salvando}>
          {salvando ? 'Calculando...' : ordemCalculada.length > 0 ? 'Recalcular Ordem' : 'Calcular Ordem de Iniciativa'}
        </button>
      </div>

      {erro && <p className="text-blood-bright text-xs mb-4">{erro}</p>}

      {ordemCalculada.length > 0 && participantesForaDaOrdem.length > 0 && (
        <p className="text-gold text-xs mb-4">
          {participantesForaDaOrdem.length} participante(s) adicionados depois do cálculo — recalcule pra incluí-los.
        </p>
      )}

      {ordemCalculada.length > 0 ? (
        <ol className="flex flex-col gap-2 mb-6">
          {ordemCalculada.map((p, i) => (
            <li key={p.id} className="flex items-center justify-between p-3 rounded border border-panel-border">
              <span className="flex items-center gap-3">
                <span className="font-display text-gold w-5">{i + 1}º</span>
                <span>{p.nome}</span>
              </span>
              <span className="text-mist text-xs">
                Iniciativa {p.iniciativa_final}
                {p.iniciativa_extra != null && ` (${p.iniciativa_bonus} + ${p.iniciativa_extra})`}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="flex flex-col gap-2">
        {encontro.participantes.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-3 rounded border border-panel-border">
            <div>
              <div className="text-sm">{p.nome}</div>
              <div className="text-[11px] text-mist">Bônus de Iniciativa: {p.iniciativa_bonus}</div>
            </div>
            {p.velocidade_treinada && (
              <label className="flex items-center gap-2 text-xs text-mist">
                Resultado 1d6+Velocidade
                <input
                  type="number"
                  value={extras[p.id]}
                  onChange={(e) => setExtras((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder="opcional"
                  className="campo-input w-20 py-1"
                />
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SecaoTurno({ encontro, catalogoEfeitos, onAvancar, onConfirmarTick }) {
  const [valores, setValores] = useState({})

  if (!encontro.ordem || encontro.ordem.length === 0) return null

  const indexAtual = encontro.turno_index
  const idAtual = indexAtual != null ? encontro.ordem[indexAtual] : null
  const participanteAtual = idAtual ? encontro.participantes.find((p) => p.id === idAtual) : null

  const pendencias = participanteAtual
    ? (participanteAtual.efeitos || [])
        .filter((e) => EFEITOS_COM_TICK[e.efeito_id])
        .map((e) => ({ efeitoInstanciaId: e.id, efeitoId: e.efeito_id, nome: e.nome, ...EFEITOS_COM_TICK[e.efeito_id] }))
    : []

  return (
    <div className="mt-8 border-t border-panel-border pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg">Turno — Rodada {encontro.rodada_atual ?? 1}</h3>
        <button className="btn-primary text-xs" onClick={onAvancar}>
          {indexAtual == null ? 'Iniciar Turno 1' : 'Próximo Turno →'}
        </button>
      </div>

      <div className="flex flex-col gap-2 mb-6">
        {encontro.ordem.map((id, i) => {
          const p = encontro.participantes.find((part) => part.id === id)
          if (!p) return null
          return (
            <div
              key={id}
              className={`flex items-center justify-between p-3 rounded border
                ${id === idAtual ? 'border-gold bg-gold/5' : 'border-panel-border'}`}
            >
              <span className="flex items-center gap-3">
                {id === idAtual && <span className="text-gold">▶</span>}
                <span className="font-display text-mist w-5">{i + 1}º</span>
                <span>{p.nome}</span>
              </span>
              <span className="text-mist text-xs">Vida {p.vida_atual}/{p.vida_maxima}</span>
            </div>
          )
        })}
      </div>

      {participanteAtual && pendencias.length > 0 && (
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-widest text-mist mb-2">
            Pendências de início de turno — {participanteAtual.nome}
          </div>
          <div className="flex flex-col gap-2">
            {pendencias.map((pendencia) => (
              <div
                key={pendencia.efeitoInstanciaId}
                className="flex items-center justify-between p-3 rounded border border-panel-border"
              >
                <span className="text-sm">
                  {pendencia.nome} <span className="text-mist text-xs">({pendencia.formula}, {pendencia.tipo})</span>
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={valores[pendencia.efeitoInstanciaId] ?? ''}
                    onChange={(e) => setValores((prev) => ({ ...prev, [pendencia.efeitoInstanciaId]: e.target.value }))}
                    placeholder="valor rolado"
                    className="campo-input w-24 py-1"
                  />
                  <button
                    className="btn-secondary text-xs"
                    onClick={() => {
                      const valor = valores[pendencia.efeitoInstanciaId]
                      if (valor === undefined || valor === '') return
                      onConfirmarTick(pendencia, valor)
                      setValores((prev) => ({ ...prev, [pendencia.efeitoInstanciaId]: '' }))
                    }}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[11px] uppercase tracking-widest text-mist mb-2">Registro do Combate</div>
        <div className="flex flex-col gap-1 max-h-56 overflow-y-auto text-xs text-mist">
          {(encontro.log || []).length === 0 ? (
            <p>Nada aconteceu ainda.</p>
          ) : (
            [...encontro.log].reverse().map((linha, i) => <p key={i}>{linha}</p>)
          )}
        </div>
      </div>
    </div>
  )
}

export default function Combate() {
  const { usuario, carregando: carregandoAuth } = useAuth()
  const [campanhas, setCampanhas] = useState([])
  const [encontros, setEncontros] = useState([])
  const [encontroSelecionadoId, setEncontroSelecionadoId] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [modalAberto, setModalAberto] = useState(null)
  const [participanteAlvoId, setParticipanteAlvoId] = useState(null)
  const [catalogoEfeitos, setCatalogoEfeitos] = useState({})

  useEffect(() => {
    if (carregandoAuth || !usuario) return

    async function carregar() {
      setCarregando(true)
      setErro(null)
      try {
        const [campanhasSnap, encontrosSnap, respEfeitos] = await Promise.all([
          getDocs(query(collection(db, 'campanhas'), where('mestre_id', '==', usuario.uid))),
          getDocs(query(collection(db, 'encontros'), where('mestre_id', '==', usuario.uid))),
          api.buscarBiblioteca('efeitos'),
        ])
        setCampanhas(campanhasSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setEncontros(encontrosSnap.docs.map((d) => ({ id: d.id, ordem: [], ...d.data() })))
        setCatalogoEfeitos(respEfeitos.dados?.itens?.efeitos || {})
      } catch (err) {
        console.error(err)
        setErro('Não foi possível carregar seus encontros agora.')
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [usuario, carregandoAuth])

  const encontroSelecionado = encontros.find((e) => e.id === encontroSelecionadoId) || null

  function atualizarEncontroLocal(id, alteracoes) {
    setEncontros((prev) => prev.map((e) => (e.id === id ? { ...e, ...alteracoes } : e)))
  }

  function aoCriarEncontro(novo) {
    setEncontros((prev) => [novo, ...prev])
    setEncontroSelecionadoId(novo.id)
    setModalAberto(null)
  }

  async function ajustarParticipante(participante, campo, delta, opcoes = {}) {
    const { min = null, max = null } = opcoes
    let novo = Math.round((participante[campo] + delta) * 10) / 10
    if (min != null) novo = Math.max(min, novo)
    if (max != null) novo = Math.min(max, novo)
    if (novo === participante[campo]) return

    const participantes = encontroSelecionado.participantes.map((p) =>
      p.id === participante.id ? { ...p, [campo]: novo } : p
    )
    atualizarEncontroLocal(encontroSelecionado.id, { participantes })

    try {
      await updateDoc(doc(db, 'encontros', encontroSelecionado.id), { participantes, atualizado_em: serverTimestamp() })
      if (participante.tipo === 'personagem' && participante.ref_id) {
        const { dados } = await api.ajustarRecursoPersonagemComoMestre(participante.ref_id, usuario.uid, campo, novo)
        if (!dados?.sucesso) {
          console.error('Falha ao sincronizar com a ficha do personagem:', dados?.erros)
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function aplicarEfeito(participanteId, efeitoId, catalogoEfeito) {
    const novoEfeito = efeitoAplicado(efeitoId, catalogoEfeito)
    const participantes = encontroSelecionado.participantes.map((p) =>
      p.id === participanteId ? { ...p, efeitos: [...(p.efeitos || []), novoEfeito] } : p
    )
    atualizarEncontroLocal(encontroSelecionado.id, { participantes })
    setModalAberto(null)
    setParticipanteAlvoId(null)
    try {
      await updateDoc(doc(db, 'encontros', encontroSelecionado.id), { participantes, atualizado_em: serverTimestamp() })
    } catch (err) {
      console.error(err)
    }
  }

  async function removerEfeito(participanteId, efeitoInstanciaId) {
    const participantes = encontroSelecionado.participantes.map((p) =>
      p.id === participanteId ? { ...p, efeitos: (p.efeitos || []).filter((e) => e.id !== efeitoInstanciaId) } : p
    )
    atualizarEncontroLocal(encontroSelecionado.id, { participantes })
    try {
      await updateDoc(doc(db, 'encontros', encontroSelecionado.id), { participantes, atualizado_em: serverTimestamp() })
    } catch (err) {
      console.error(err)
    }
  }

  async function avancarTurno() {
    const ordem = encontroSelecionado.ordem
    if (!ordem || ordem.length === 0) return

    const indexAtual = encontroSelecionado.turno_index
    let proximoIndex = indexAtual == null ? 0 : indexAtual + 1
    let rodada = encontroSelecionado.rodada_atual ?? 1
    if (proximoIndex >= ordem.length) {
      proximoIndex = 0
      rodada += 1
    }

    const idProximo = ordem[proximoIndex]
    const participanteProximo = encontroSelecionado.participantes.find((p) => p.id === idProximo)
    if (!participanteProximo) return

    const { participanteAtualizado, logs } = resolverInicioDeTurno(participanteProximo)
    const participantes = encontroSelecionado.participantes.map((p) =>
      p.id === idProximo ? participanteAtualizado : p
    )
    const log = [
      ...(encontroSelecionado.log || []),
      `Rodada ${rodada} — início do turno de ${participanteAtualizado.nome}.`,
      ...logs,
    ].slice(-100)

    atualizarEncontroLocal(encontroSelecionado.id, {
      participantes, turno_index: proximoIndex, rodada_atual: rodada, log,
    })
    try {
      await updateDoc(doc(db, 'encontros', encontroSelecionado.id), {
        participantes, turno_index: proximoIndex, rodada_atual: rodada, log, atualizado_em: serverTimestamp(),
      })
    } catch (err) {
      console.error(err)
    }
  }

  async function confirmarTick(pendencia, valorDigitado) {
    const idAtual = encontroSelecionado.ordem?.[encontroSelecionado.turno_index]
    const participante = encontroSelecionado.participantes.find((p) => p.id === idAtual)
    if (!participante) return

    const { participanteAtualizado, logs } = aplicarTickEfeito(
      participante, pendencia, Number(valorDigitado), catalogoEfeitos
    )
    const participantes = encontroSelecionado.participantes.map((p) =>
      p.id === idAtual ? participanteAtualizado : p
    )
    const log = [...(encontroSelecionado.log || []), ...logs].slice(-100)

    atualizarEncontroLocal(encontroSelecionado.id, { participantes, log })
    try {
      await updateDoc(doc(db, 'encontros', encontroSelecionado.id), { participantes, log, atualizado_em: serverTimestamp() })
      if (participante.tipo === 'personagem' && participante.ref_id) {
        const { dados } = await api.ajustarRecursoPersonagemComoMestre(
          participante.ref_id, usuario.uid, 'vida_atual', participanteAtualizado.vida_atual
        )
        if (!dados?.sucesso) {
          console.error('Falha ao sincronizar com a ficha do personagem:', dados?.erros)
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function removerParticipante(participanteId) {
    if (!encontroSelecionado) return
    const participantes = encontroSelecionado.participantes.filter((p) => p.id !== participanteId)
    const ordem = (encontroSelecionado.ordem || []).filter((id) => id !== participanteId)
    atualizarEncontroLocal(encontroSelecionado.id, { participantes, ordem })
    try {
      await updateDoc(doc(db, 'encontros', encontroSelecionado.id), { participantes, ordem, atualizado_em: serverTimestamp() })
    } catch (err) {
      console.error(err)
    }
  }

  async function excluirEncontro(id) {
    try {
      await deleteDoc(doc(db, 'encontros', id))
      setEncontros((prev) => prev.filter((e) => e.id !== id))
      if (encontroSelecionadoId === id) setEncontroSelecionadoId(null)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl mb-1">Combate</h1>
          <p className="text-mist">Rastreie iniciativas, turnos e a fúria da batalha.</p>
        </div>
        <button className="btn-primary" onClick={() => setModalAberto('novo_encontro')}>⚔ Novo Encontro</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <div className="card-fantasy p-5">
          <div className="text-xs uppercase tracking-widest text-mist mb-3">Encontros</div>
          {carregando ? (
            <p className="text-sm text-mist">Carregando...</p>
          ) : erro ? (
            <p className="text-sm text-blood-bright">{erro}</p>
          ) : encontros.length === 0 ? (
            <p className="text-sm text-mist">Nenhum encontro criado.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {encontros.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setEncontroSelecionadoId(e.id)}
                  className={`text-left p-3 rounded border transition-colors
                    ${e.id === encontroSelecionadoId ? 'border-gold' : 'border-panel-border hover:border-white/20'}`}
                >
                  <div className="font-display text-sm">{e.nome}</div>
                  <div className="text-[11px] text-mist">{e.campanha_nome} · {ROTULO_STATUS[e.status]}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {!encontroSelecionado ? (
          <div className="card-fantasy p-5 flex items-center justify-center text-mist text-sm min-h-[240px]">
            Selecione ou crie um encontro para começar.
          </div>
        ) : (
          <div className="card-fantasy p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-xl">{encontroSelecionado.nome}</h2>
                <p className="text-mist text-xs">{encontroSelecionado.campanha_nome} · {ROTULO_STATUS[encontroSelecionado.status]}</p>
              </div>
              <button
                className="text-xs text-blood-bright hover:underline"
                onClick={() => excluirEncontro(encontroSelecionado.id)}
              >
                Excluir encontro
              </button>
            </div>

            <div className="flex flex-wrap gap-3 my-5">
              <button className="btn-secondary" onClick={() => setModalAberto('adicionar_personagens')}>+ Personagens</button>
              <button className="btn-secondary" onClick={() => setModalAberto('adicionar_monstro')}>+ Monstro do Bestiário</button>
              <button className="btn-secondary opacity-50 cursor-not-allowed" disabled title="Depende da aba de NPC / Homebrew, ainda não implementada">
                + NPC (em breve)
              </button>
            </div>

            {encontroSelecionado.participantes.length === 0 ? (
              <p className="text-mist text-sm">Nenhum participante ainda. Adicione personagens ou monstros acima.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {encontroSelecionado.participantes.map((p) => (
                  <CardParticipante
                    key={p.id}
                    participante={p}
                    onRemover={() => removerParticipante(p.id)}
                    onAjustar={(campo, delta, opcoes) => ajustarParticipante(p, campo, delta, opcoes)}
                    onAbrirEfeito={() => { setParticipanteAlvoId(p.id); setModalAberto('aplicar_efeito') }}
                    onRemoverEfeito={(efeitoInstanciaId) => removerEfeito(p.id, efeitoInstanciaId)}
                  />
                ))}
              </div>
            )}

            <SecaoIniciativa
              encontro={encontroSelecionado}
              onAtualizado={(participantes, ordem) => atualizarEncontroLocal(encontroSelecionado.id, { participantes, ordem, status: 'em_andamento', turno_index: null, rodada_atual: 1 })}
            />
            <SecaoTurno
              encontro={encontroSelecionado}
              catalogoEfeitos={catalogoEfeitos}
              onAvancar={avancarTurno}
              onConfirmarTick={confirmarTick}
            />
          </div>
        )}
      </div>

      {modalAberto === 'novo_encontro' && (
        <ModalNovoEncontro campanhas={campanhas} onFechar={() => setModalAberto(null)} onCriado={aoCriarEncontro} />
      )}
      {modalAberto === 'adicionar_personagens' && encontroSelecionado && (
        <ModalAdicionarPersonagens
          encontro={encontroSelecionado}
          mestreUid={usuario.uid}
          onFechar={() => setModalAberto(null)}
          onAdicionados={(participantes) => {
            atualizarEncontroLocal(encontroSelecionado.id, { participantes })
            setModalAberto(null)
          }}
        />
      )}
      {modalAberto === 'adicionar_monstro' && encontroSelecionado && (
        <ModalAdicionarMonstro
          encontro={encontroSelecionado}
          onFechar={() => setModalAberto(null)}
          onAdicionados={(participantes) => {
            atualizarEncontroLocal(encontroSelecionado.id, { participantes })
            setModalAberto(null)
          }}
        />
      )}
      {modalAberto === 'aplicar_efeito' && participanteAlvoId && (
        <ModalAdicionarEfeito
          efeitos={catalogoEfeitos}
          onFechar={() => { setModalAberto(null); setParticipanteAlvoId(null) }}
          onAplicar={(efeitoId, catalogoEfeito) => aplicarEfeito(participanteAlvoId, efeitoId, catalogoEfeito)}
        />
      )}
    </div>
  )
}
