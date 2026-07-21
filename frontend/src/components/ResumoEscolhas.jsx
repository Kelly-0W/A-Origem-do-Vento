import { ATRIBUTOS, NOMES_ATRIBUTOS } from '../lib/constantes.js'
import { nomePericia } from '../lib/formato.js'

function nomeHabilidade(listas, id) {
  for (const lista of listas) {
    const achada = (lista || []).find((h) => h.id === id)
    if (achada) return achada.nome
  }
  return id
}

export function ChipLista({ itens }) {
  if (!itens || itens.length === 0) return <span className="text-mist text-xs">nenhuma</span>
  return (
    <div className="flex flex-wrap gap-2">
      {itens.map((texto) => (
        <span key={texto} className="inline-block text-[11px] px-2 py-1 rounded border border-gold/40 text-gold">
          {texto}
        </span>
      ))}
    </div>
  )
}

export function LinhaResumo({ rotulo, children }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4 py-2 border-b border-panel-border/60 last:border-b-0">
      <span className="text-xs uppercase tracking-widest text-mist pt-1">{rotulo}</span>
      <div className="text-sm text-white">{children}</div>
    </div>
  )
}

// Resumo em linguagem natural das escolhas -- monta as frases a partir do
// catálogo já carregado em memória, sem expor os nomes de campo internos
// (snake_case) nem a estrutura de dados crua pro jogador. Usado tanto no
// passo de Resumo do Wizard quanto na tela de detalhe do personagem.
export default function ResumoEscolhas({ catalogo, escolhas, raca, linhagem, classe, origem, elemento, isCaca }) {
  // Habilidades "inatas" (ex.: Asas de Amion da Fada) são concedidas a
  // toda a raça automaticamente -- não entram em habilidades_escolhidas e
  // não competem com as habilidades que o jogador de fato escolhe, mas
  // ainda assim têm que aparecer no resumo.
  const idsInatas = new Set((raca?.habilidades_globais || []).filter((h) => h.inata).map((h) => h.id))
  const nomesHabilidadesRaca = [
    ...new Set([...escolhas.habilidades_escolhidas.raca_globais, ...idsInatas]),
    ...escolhas.habilidades_escolhidas.raca_linhagem,
  ].map((id) => nomeHabilidade([raca?.habilidades_globais, raca?.habilidades_especificas], id))

  const nomesHabilidadesClasse = escolhas.habilidades_escolhidas.classe.map((id) =>
    nomeHabilidade([classe?.habilidades], id)
  )

  const nomesPoderes = escolhas.poderes_escolhidos.map((id) => elemento?.poderes?.[id]?.nome ?? id)
  const nomeEspiritual = escolhas.espiritual_escolhido ? elemento?.espirituais?.[escolhas.espiritual_escolhido]?.nome : null
  const deusSagracantico = catalogo.sagracanticos?.deuses?.[escolhas.sagracantico_deus_id] || null

  const frase = [
    raca ? raca.nome : '(sem raça)',
    linhagem ? `da ${linhagem.nome}` : null,
    '—',
    classe ? classe.nome : '(sem classe)',
    origem ? `, origem ${origem.nome}${escolhas.origem_pericia_escolhida ? ` (perícia: ${nomePericia(catalogo, escolhas.origem_pericia_escolhida)})` : ''}` : '',
    elemento ? `, manipulador(a) de ${elemento.nome}` : '',
    deusSagracantico ? `. Sagracântico de ${deusSagracantico.nome}` : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="border border-panel-border rounded p-5">
      <p className="text-white mb-4">{frase}.</p>
      <LinhaResumo rotulo="Habilidades de Raça"><ChipLista itens={nomesHabilidadesRaca} /></LinhaResumo>
      <LinhaResumo rotulo="Habilidades de Classe"><ChipLista itens={nomesHabilidadesClasse} /></LinhaResumo>
      <LinhaResumo rotulo={isCaca ? 'Espiritual' : 'Poderes'}>
        <ChipLista itens={isCaca ? (nomeEspiritual ? [nomeEspiritual] : []) : nomesPoderes} />
      </LinhaResumo>
      <LinhaResumo rotulo="Atributos">
        {ATRIBUTOS.map((a) => `${NOMES_ATRIBUTOS[a]} ${escolhas.atributos[a] >= 0 ? '+' : ''}${escolhas.atributos[a]}`).join(' · ')}
      </LinhaResumo>
    </div>
  )
}
