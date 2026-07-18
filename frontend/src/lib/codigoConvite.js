const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function gerarCodigoConvite(tamanho = 6) {
  let codigo = ''
  for (let i = 0; i < tamanho; i++) {
    codigo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)]
  }
  return codigo
}

export function normalizarCodigoConvite(codigo) {
  return codigo.trim().toUpperCase()
}
