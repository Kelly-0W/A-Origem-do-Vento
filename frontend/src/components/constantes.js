export const ATRIBUTOS = ['for', 'des', 'con', 'int', 'sab', 'car']
export const NOMES_ATRIBUTOS = {
  for: 'Força',
  des: 'Destreza',
  con: 'Constituição',
  int: 'Inteligência',
  sab: 'Sabedoria',
  car: 'Carisma',
}

// Maior grau de Ascensão alcançável (ver marcos de bônus de treinamento em
// api/motor/constantes.py, que vão até o grau 10).
export const GRAU_ASCENSAO_MAXIMO = 10

// Espelha api/motor/constantes.py::faixa_dificuldade_do_grau -- dado o
// objeto `faixas_dificuldade` de constantes_ascensao.json (ex.:
// { facil: { graus: [1,2,3,4] }, medio: { graus: [5,6,7] }, dificil: { graus: [8,9,10] } }),
// devolve em qual faixa um grau cai, ou null se não achar.
export function faixaDificuldadeDoGrau(grau, faixasDificuldade) {
  for (const [nomeFaixa, dados] of Object.entries(faixasDificuldade || {})) {
    if ((dados?.graus || []).includes(grau)) return nomeFaixa
  }
  return null
}
