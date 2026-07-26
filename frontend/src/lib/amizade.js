// Id determinístico pro documento de amizade de um par de usuários --
// sempre os dois uids ordenados e grudados, então não importa quem manda
// a solicitação pra quem, o par sempre cai no mesmo documento (evita
// duplicar pedido nos dois sentidos, e permite checar "somos amigos?"
// direto pelo id, sem precisar de query).
export function idAmizade(uidA, uidB) {
  return [uidA, uidB].sort().join('_')
}
