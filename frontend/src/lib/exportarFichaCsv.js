function escaparCelula(valor) {
  let texto = String(valor ?? '')
  // Evita que nomes inseridos pelo usuário sejam interpretados como fórmulas
  // quando o CSV for aberto em um programa de planilhas.
  if (/^\s*[=+@-]/.test(texto)) texto = `'${texto}`
  return `"${texto.replaceAll('"', '""')}"`
}

function nomesUnicos(lista) {
  return [...new Set(lista.filter(Boolean))]
}

export function baixarFichaCsv(personagem, catalogo) {
  const escolhas = personagem.escolhas || {}
  const elementoBase = catalogo.elementos?.[escolhas.elemento_id]
  const espiritual = escolhas.espiritual_escolhido
    ? elementoBase?.espirituais?.[escolhas.espiritual_escolhido]
    : null
  const elementoId = escolhas.elemento_id === 'caca' ? espiritual?.elemento_id : escolhas.elemento_id
  const elemento = catalogo.elementos?.[elementoId]
  const classe = catalogo.classes?.[escolhas.classe_id]
  const origem = catalogo.origens?.[escolhas.origem_id]
  const raca = catalogo.racas?.[escolhas.raca_id]
  const linhagem = (raca?.linhagens || []).find((item) => item.id === escolhas.linhagem_id)
  const sistemaUnico = linhagem?.sistema_racial_inato || raca?.sistema_racial_inato
  const habilidadesEscolhidas = escolhas.habilidades_escolhidas || {}

  const habilidadesRaca = nomesUnicos([
    ...(raca?.habilidades_globais || [])
      .filter((habilidade) => habilidade.inata || (habilidadesEscolhidas.raca_globais || []).includes(habilidade.id))
      .map((habilidade) => habilidade.nome),
    ...(raca?.habilidades_especificas || [])
      .filter((habilidade) => (habilidadesEscolhidas.raca_linhagem || []).includes(habilidade.id))
      .map((habilidade) => habilidade.nome),
  ])
  const habilidadesClasse = nomesUnicos((classe?.habilidades || [])
    .filter((habilidade) => (habilidadesEscolhidas.classe || []).includes(habilidade.id))
    .map((habilidade) => habilidade.nome))

  const pericias = Object.entries(personagem.calculado?.pericias || {})
    .sort(([idA], [idB]) => (catalogo.pericias?.[idA]?.nome || idA).localeCompare(catalogo.pericias?.[idB]?.nome || idB, 'pt-BR'))
    .map(([id, dados]) => `${catalogo.pericias?.[id]?.nome || id} ${dados.bonus_total >= 0 ? '+' : ''}${dados.bonus_total}`)
  const poderesOficiais = (escolhas.poderes_escolhidos || [])
    .map((id) => elemento?.poderes?.[id]?.nome)
  const poderesHomebrew = (escolhas.poderes_homebrew_escolhidos || []).map((poder) => poder.nome)
  const poderes = nomesUnicos([...poderesOficiais, ...poderesHomebrew])
  const manipulacao = elemento
    ? `${elemento.nome}${espiritual ? ` (Espiritual: ${espiritual.nome})` : ''}`
    : ''

  const cabecalhos = [
    'Nome', 'Grau', 'Manipulação', 'Classe', 'Origem', 'Perícias (bônus)',
    'Poderes', 'Habilidades de raça', 'Habilidades de classe', 'Sistema único', 'Habilidade de origem',
  ]
  const valores = [
    escolhas.nome_personagem || '',
    personagem.grau_ascensao ?? personagem.calculado?.grau_ascensao ?? 0,
    manipulacao,
    classe?.nome || '',
    origem?.nome || '',
    pericias.join(' | '),
    poderes.join(' | '),
    habilidadesRaca.join(' | '),
    habilidadesClasse.join(' | '),
    sistemaUnico?.nome || '',
    origem?.habilidade_passiva?.nome || '',
  ]
  const conteudo = `\uFEFF${[cabecalhos, valores].map((linha) => linha.map(escaparCelula).join(';')).join('\r\n')}`
  const arquivo = new Blob([conteudo], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(arquivo)
  const link = document.createElement('a')
  const nomeSeguro = (escolhas.nome_personagem || 'personagem')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'personagem'
  link.href = url
  link.download = `ficha-${nomeSeguro}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
