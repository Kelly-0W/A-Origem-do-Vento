export function nomePericia(catalogo, id) {
  return catalogo.pericias?.[id]?.nome ?? id
}
