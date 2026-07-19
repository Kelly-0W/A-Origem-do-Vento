export function nomePericia(catalogo, id) {
  return catalogo.pericias?.[id]?.nome ?? id
}

// "custo_arche_por_turno" -> "Custo Arche Por Turno" -- usado pra exibir
// as chaves de `parametros` do sistema racial único (kaimar, ocularde,
// fada, astara, draconato) sem precisar mapear cada uma na mão.
export function formatarRotulo(chave) {
  return chave
    .split('_')
    .map((palavra) => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ')
}
