import { useEffect, useState } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { api } from '../lib/api.js'
import { GRAU_ASCENSAO_MAXIMO, faixaDificuldadeDoGrau } from '../lib/constantes.js'
import RecompensasAscensao from './RecompensasAscensao.jsx'

const ASCENSAO_ZERADA = {
  grau_alvo: null,
  catalisador: false,
  provacao: false,
  ritual: false,
  descricao_manifestacao: '',
  status: 'nenhuma',
  respondido_por_uid: null,
  respondido_em: null,
}

function CheckboxPilar({ marcado, onToggle, disabled, titulo, children }) {
  return (
    <label className={`stat-tile flex gap-3 items-start cursor-pointer ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => onToggle(e.target.checked)}
        disabled={disabled}
        className="mt-1"
      />
      <div>
        <div className="font-display text-sm text-white mb-1">{titulo}</div>
        <div className="text-xs text-mist leading-relaxed">{children}</div>
      </div>
    </label>
  )
}

// `estaEmCampanha`: personagens fora de qualquer campanha decidem sozinhos
// quando subir de grau (pula direto pra escolha de recompensas assim que
// os 3 pilares são cumpridos); personagens numa campanha continuam
// dependendo da aprovação do Mestre (aguardando_mestre) antes disso.
export default function PainelAscensao({
  personagemId,
  donoUid,
  grauAscensao,
  ascensaoEmProgresso,
  raca,
  linhagem,
  classe,
  origem,
  escolhas,
  estaEmCampanha,
  onAtualizado,
  onAscensaoEfetivada,
}) {
  const [constantesAscensao, setConstantesAscensao] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const [provacaoSelecionadaId, setProvacaoSelecionadaId] = useState(null)
  const [descricaoManifestacao, setDescricaoManifestacao] = useState(ascensaoEmProgresso?.descricao_manifestacao || '')

  useEffect(() => {
    api.buscarBiblioteca('constantes_ascensao').then(({ dados }) => {
      setConstantesAscensao(dados?.itens || {})
    })
  }, [])

  useEffect(() => {
    setDescricaoManifestacao(ascensaoEmProgresso?.descricao_manifestacao || '')
  }, [ascensaoEmProgresso?.descricao_manifestacao])

  const ascensao = ascensaoEmProgresso || ASCENSAO_ZERADA
  const grauAlvo = ascensao.status !== 'nenhuma' || ascensao.grau_alvo ? ascensao.grau_alvo : grauAscensao + 1
  const faixasDificuldade = constantesAscensao?.faixas_dificuldade || null
  const faixa = faixasDificuldade ? faixaDificuldadeDoGrau(grauAlvo, faixasDificuldade) : null
  const provacoesFaixa = (faixa && classe?.provacoes?.[faixa]) || []
  const ritualFaixa = (faixa && origem?.rituais?.[faixa]) || null
  const recompensasGrauAlvo = constantesAscensao?.graus?.[String(grauAlvo)]?.recompensas || []

  async function salvar(patch) {
    setSalvando(true)
    setErro(null)
    try {
      await updateDoc(doc(db, 'personagens', personagemId), {
        ascensao_em_progresso: { ...ascensao, ...patch },
        atualizado_em: serverTimestamp(),
      })
      onAtualizado({ ...ascensao, ...patch })
    } catch (err) {
      console.error(err)
      setErro('Não foi possível salvar essa alteração agora.')
    } finally {
      setSalvando(false)
    }
  }

  function iniciarAscensao() {
    salvar({ ...ASCENSAO_ZERADA, grau_alvo: grauAscensao + 1 })
  }

  function cancelarPedido() {
    salvar(ASCENSAO_ZERADA)
  }

  function tentarNovamente() {
    salvar({ ...ASCENSAO_ZERADA, grau_alvo: ascensao.grau_alvo })
  }

  function alternarPilar(campo, valor) {
  const proximo = { ...ascensao, [campo]: valor, descricao_manifestacao: descricaoManifestacao }
  const pilaresCumpridos = [proximo.catalisador, proximo.provacao, proximo.ritual].filter(Boolean).length
  const completo = pilaresCumpridos >= 2
  salvar({
    [campo]: valor,
    descricao_manifestacao: descricaoManifestacao,
    status: completo ? 'aguardando_mestre' : 'nenhuma',})
  } 

  function confirmarProvacao(marcado) {
    if (marcado && !provacaoSelecionadaId && provacoesFaixa.length > 1) return
    alternarPilar('provacao', marcado)
  }

  function aoFinalizarRecompensas(dados) {
    onAscensaoEfetivada({
      grau_ascensao: dados.grau_ascensao,
      calculado: dados.calculado,
      escolhas: dados.escolhas,
    })
  }

  if (grauAscensao >= GRAU_ASCENSAO_MAXIMO) {
    return (
      <div className="mt-8">
        <h3 className="font-display text-gold text-xs uppercase tracking-widest mb-3">Ascensão</h3>
        <div className="card-fantasy p-5 text-sm text-mist">
          Este personagem já está no Grau {GRAU_ASCENSAO_MAXIMO}, o máximo do sistema.
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <h3 className="font-display text-gold text-xs uppercase tracking-widest mb-3">
        Ascensão — Grau {grauAscensao} → {grauAlvo}
      </h3>

      {erro && <p className="text-blood-bright text-xs mb-3">{erro}</p>}

      {ascensao.status === 'nenhuma' && !ascensao.grau_alvo && (
        <div className="card-fantasy p-5">
          <p className="text-sm text-mist mb-4">
            Quando estiver pronto para buscar o próximo Grau de Ascensão, inicie o processo abaixo.
            Você vai precisar cumprir 3 pilares: um Catalisador, uma Provação e um Ritual.
            {!estaEmCampanha && ' Como este personagem não está em nenhuma campanha, você mesmo decide quando os pilares foram cumpridos.'}
          </p>
          <button className="btn-primary disabled:opacity-50" onClick={iniciarAscensao} disabled={salvando}>
            Iniciar Ascensão para o Grau {grauAscensao + 1}
          </button>
        </div>
      )}

      {ascensao.status === 'aguardando_mestre' && (
        <div className="card-fantasy p-5">
          <p className="text-forest text-sm mb-3">Os 3 pilares foram cumpridos. Pedido enviado — aguardando resposta do Mestre.</p>
          <button className="btn-secondary text-xs disabled:opacity-50" onClick={cancelarPedido} disabled={salvando}>
            Cancelar pedido
          </button>
        </div>
      )}

      {ascensao.status === 'aguardando_recompensas' && (
        <RecompensasAscensao
          personagemId={personagemId}
          donoUid={donoUid}
          grauAlvo={grauAlvo}
          recompensas={recompensasGrauAlvo}
          raca={raca}
          linhagem={linhagem}
          classe={classe}
          escolhas={escolhas}
          onFinalizado={aoFinalizarRecompensas}
        />
      )}

      {ascensao.status === 'recusada' && (
        <div className="card-fantasy p-5">
          <p className="text-blood-bright text-sm mb-3">Seu Mestre recusou este pedido de Ascensão.</p>
          <button className="btn-primary disabled:opacity-50" onClick={tentarNovamente} disabled={salvando}>
            Tentar novamente
          </button>
        </div>
      )}

      {ascensao.status === 'nenhuma' && ascensao.grau_alvo && (
        <div className="flex flex-col gap-3">
          <CheckboxPilar
            marcado={ascensao.catalisador}
            onToggle={(v) => alternarPilar('catalisador', v)}
            disabled={salvando}
            titulo="Catalisador"
          >
            Marque quando tiver obtido e consumido o Catalisador exigido para este Grau (combine os detalhes com seu Mestre).
          </CheckboxPilar>

          <div className="stat-tile">
            <div className="font-display text-sm text-white mb-2">Provação</div>
            {provacoesFaixa.length === 0 ? (
              <p className="text-xs text-mist">Nenhuma Provação cadastrada para esta faixa de dificuldade ainda.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-3">
                {provacoesFaixa.map((p) => (
                  <label key={p.id} className="flex items-start gap-2 text-xs text-mist cursor-pointer">
                    <input
                      type="radio"
                      name="provacao-escolhida"
                      checked={provacaoSelecionadaId === p.id}
                      onChange={() => setProvacaoSelecionadaId(p.id)}
                      disabled={salvando || ascensao.provacao}
                      className="mt-0.5"
                    />
                    <span>{p.descricao}</span>
                  </label>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={ascensao.provacao}
                onChange={(e) => confirmarProvacao(e.target.checked)}
                disabled={salvando || (provacoesFaixa.length > 1 && !provacaoSelecionadaId && !ascensao.provacao)}
              />
              <span className="text-white">Cumpri esta Provação</span>
            </label>
          </div>

          <CheckboxPilar
            marcado={ascensao.ritual}
            onToggle={(v) => alternarPilar('ritual', v)}
            disabled={salvando}
            titulo={ritualFaixa ? `Ritual: ${ritualFaixa.nome}` : 'Ritual'}
          >
            {ritualFaixa?.descricao || 'Nenhum ritual cadastrado para esta faixa de dificuldade ainda.'}
          </CheckboxPilar>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-widest text-mist">Descrição da manifestação (opcional)</span>
            <textarea
              value={descricaoManifestacao}
              onChange={(e) => setDescricaoManifestacao(e.target.value)}
              onBlur={() => salvar({ descricao_manifestacao: descricaoManifestacao })}
              placeholder="Como essa Ascensão muda a aparência ou a presença do seu personagem?"
              rows={3}
              className="campo-input resize-y"
            />
          </label>

          <button className="btn-secondary text-xs w-fit disabled:opacity-50" onClick={cancelarPedido} disabled={salvando}>
            Cancelar e recomeçar
          </button>
        </div>
      )}
    </div>
  )
}
