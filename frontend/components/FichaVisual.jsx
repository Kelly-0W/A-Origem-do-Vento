import { ATRIBUTOS, NOMES_ATRIBUTOS } from '../lib/constantes.js'
import { nomePericia } from '../lib/formato.js'

const NOMES_STATUS = { vida: 'Vida', sanidade: 'Sanidade', arche: 'Arché', defesa: 'Defesa' }

// Ficha visual pós-cálculo -- troca o JSON cru de `resultado` por blocos no
// mesmo design system já usado no passo de Atributos (`stat-tile`). Usada
// tanto logo após calcular no Wizard quanto na tela de detalhe do
// personagem (a partir do `calculado` já salvo no Firestore).
export default function FichaVisual({ resultado, catalogo, elemento, escolhas, isCaca }) {
  const { status, atributos_finais, pericias, grau_ascensao } = resultado
  const ataqueDesarmado = status?.ataque_desarmado
  const bonusAtaqueDesarmado = ataqueDesarmado ? (atributos_finais?.[ataqueDesarmado.atributo] ?? 0) : 0

  const periciasOrdenadas = Object.entries(pericias || {}).sort(([, a], [, b]) => b.bonus_total - a.bonus_total)

  const poderesResolvidos = (escolhas.poderes_escolhidos || []).map((id) => elemento?.poderes?.[id]).filter(Boolean)
  const espiritual = escolhas.espiritual_escolhido ? elemento?.espirituais?.[escolhas.espiritual_escolhido] : null

  return (
    <div className="mt-8">
      <div className="text-forest font-display mb-4">Ficha calculada — Grau de Ascensão {grau_ascensao}</div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {['vida', 'sanidade', 'arche', 'defesa'].map((chave) => (
          <div key={chave} className="stat-tile">
            <span className="text-xs uppercase tracking-widest text-mist">{NOMES_STATUS[chave]}</span>
            <div className="font-display text-lg mt-1">{status[chave]}</div>
          </div>
        ))}
        <div className="stat-tile">
          <span className="text-xs uppercase tracking-widest text-mist">Deslocamento</span>
          <div className="font-display text-lg mt-1">{status.deslocamento_m}m</div>
        </div>
      </div>

      {ataqueDesarmado && (
        <p className="text-sm text-mist mb-6">
          Ataque desarmado: <span className="text-white">{ataqueDesarmado.dano}{bonusAtaqueDesarmado >= 0 ? '+' : ''}{bonusAtaqueDesarmado} ({ataqueDesarmado.tipo_dano})</span>
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {ATRIBUTOS.map((a) => (
          <div key={a} className="stat-tile">
            <span className="text-xs uppercase tracking-widest text-mist">{NOMES_ATRIBUTOS[a]}</span>
            <div className="font-display text-lg mt-1">{atributos_finais[a] >= 0 ? '+' : ''}{atributos_finais[a]}</div>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-mist mb-3">Perícias</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {periciasOrdenadas.map(([id, p]) => (
            <div
              key={id}
              className={`text-xs px-3 py-2 rounded border flex items-center justify-between
                ${p.treinada ? 'border-gold/50 text-gold' : 'border-panel-border text-mist'}`}
            >
              <span>{nomePericia(catalogo, id)}</span>
              <span>{p.bonus_total >= 0 ? '+' : ''}{p.bonus_total}</span>
            </div>
          ))}
        </div>
      </div>

      {isCaca ? (
        espiritual && (
          <div>
            <div className="text-xs uppercase tracking-widest text-mist mb-3">Espiritual</div>
            <div className="card-fantasy p-4">
              <div className="font-display font-semibold mb-1">{espiritual.nome}</div>
              <p className="text-xs text-mist mb-2">{(espiritual.bonus_transformacao || []).join(' · ')}</p>
              {espiritual.poder_tribal && (
                <p className="text-xs text-gold">{espiritual.poder_tribal.nome}: <span className="text-mist">{espiritual.poder_tribal.descricao}</span></p>
              )}
            </div>
          </div>
        )
      ) : (
        poderesResolvidos.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-widest text-mist mb-3">Poderes</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {poderesResolvidos.map((poder) => (
                <div key={poder.nome} className="card-fantasy p-4">
                  <div className="font-display font-semibold mb-1">{poder.nome}</div>
                  <p className="text-xs text-mist mb-2">{poder.descricao}</p>
                  <span className="inline-block text-[11px] px-2 py-1 rounded border border-gold/40 text-gold">
                    Custo: {poder.custo_arche} Arché
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}
