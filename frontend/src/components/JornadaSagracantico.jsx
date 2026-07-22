// Mapeia cada etapa da jornada divina (seed/dados/sagracanticos.json ->
// deuses.<id>.jornada_ascensao) pro Grau de Ascensão que a desbloqueia, e
// pro rótulo exibido. "O Despertar" é a única concedida no Grau 0 (na
// criação do personagem, antes de qualquer Ascensão) -- as demais são
// inteiramente automáticas: não passam pelo card de "Escolher
// Recompensas" nem aparecem naquela tabela, o jogador só as recebe.
const ETAPAS_JORNADA = [
  { chave: 'despertar', grauNecessario: 0, rotulo: 'O Despertar' },
  { chave: 'ascensao_1', grauNecessario: 1, rotulo: 'Ascensão I' },
  { chave: 'ascensao_2', grauNecessario: 3, rotulo: 'Ascensão II' },
  { chave: 'ascensao_3', grauNecessario: 5, rotulo: 'Ascensão III' },
  { chave: 'ascensao_4', grauNecessario: 8, rotulo: 'Ascensão IV' },
  { chave: 'ascensao_5', grauNecessario: 10, rotulo: 'Ascensão V — Avatar Menor' },
]

const RÓTULO_TIPO = {
  habilidade_chave: 'Habilidade-Chave',
  melhoria: 'Melhoria',
  avatar_menor: 'Avatar Menor',
}

// Cada etapa tem um formato mecânico ligeiramente diferente (a Chave e o
// Avatar Menor têm execução/alcance/custo como um poder; as Melhorias são
// só texto de efeito) -- monta os badges só com o que existir, em vez de
// assumir um formato único.
function badgesDaEtapa(etapa) {
  const badges = []
  if (etapa.custo_arche != null) badges.push(`Custo: ${etapa.custo_arche} Arché`)
  if (etapa.execucao) badges.push(`Execução: ${etapa.execucao}`)
  if (etapa.alcance) badges.push(`Alcance: ${etapa.alcance}`)
  if (etapa.alvo) badges.push(`Alvo: ${etapa.alvo}`)
  if (etapa.duracao) badges.push(`Duração: ${etapa.duracao}`)
  if (etapa.dano) badges.push(`Dano: ${etapa.dano}`)
  return badges
}

function CardEtapa({ definicao, etapa, desbloqueada }) {
  return (
    <div className={`card-fantasy p-4 ${desbloqueada ? '' : 'opacity-50'}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[11px] uppercase tracking-widest text-mist">{definicao.rotulo}</span>
        {!desbloqueada && (
          <span className="text-[10px] text-mist">Desbloqueia no Grau {definicao.grauNecessario}</span>
        )}
      </div>
      {etapa ? (
        <>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display font-semibold">{etapa.nome}</span>
            {etapa.tipo && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-gold/40 text-gold shrink-0">
                {RÓTULO_TIPO[etapa.tipo] || etapa.tipo}
              </span>
            )}
          </div>
          <p className="text-xs text-mist mb-2">{etapa.descricao}</p>

          {badgesDaEtapa(etapa).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {badgesDaEtapa(etapa).map((b) => (
                <span key={b} className="inline-block text-[11px] px-2 py-0.5 rounded border border-gold/40 text-gold">
                  {b}
                </span>
              ))}
            </div>
          )}

          {etapa.efeito_texto && <p className="text-xs text-white mb-1">{etapa.efeito_texto}</p>}
          {etapa.efeito && <p className="text-xs text-white mb-1">{etapa.efeito}</p>}
          {etapa.efeito_adicional && (
            <p className="text-xs text-mist border-t border-panel-border pt-2 mt-1">
              <span className="text-gold">{etapa.efeito_adicional.nome}:</span> {etapa.efeito_adicional.descricao}
            </p>
          )}
          {Array.isArray(etapa.efeitos) && etapa.efeitos.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-panel-border pt-2 mt-1">
              {etapa.efeitos.map((e) => (
                <p key={e.nome} className="text-xs text-mist">
                  <span className="text-gold">{e.nome}:</span> {e.descricao}
                </p>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-mist">???</p>
      )}
    </div>
  )
}

// `deus` é o objeto completo do catálogo (catalogo.sagracanticos.deuses[id]),
// `grauAscensao` é o grau ATUAL do personagem (resultado.grau_ascensao).
export default function JornadaSagracantico({ deus, grauAscensao }) {
  if (!deus) return null
  const jornada = deus.jornada_ascensao || {}

  return (
    <div className="mb-8">
      <div className="text-xs uppercase tracking-widest text-mist mb-3">
        Jornada de {deus.nome} <span className="text-gold">(Sagracântico)</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ETAPAS_JORNADA.map((definicao) => (
          <CardEtapa
            key={definicao.chave}
            definicao={definicao}
            etapa={jornada[definicao.chave]}
            desbloqueada={grauAscensao >= definicao.grauNecessario}
          />
        ))}
      </div>
    </div>
  )
}
