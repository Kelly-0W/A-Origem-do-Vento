"""
Calculo dos status basicos (Vida, Sanidade, Arche, Defesa, Deslocamento) a
partir da formula de coeficientes de uma raca ou linhagem.
"""
from typing import Dict, Optional


def calcular_status(
    formula_status: Dict, atributos_finais: Dict[str, int], grau_ascensao: int
) -> Dict:
    """
    formula_status e o bloco "status" de uma raca/linhagem no catalogo, ex:
      {
        "vida": {"base": 10, "atributo": "con", "mult_ascensao": 4},
        "sanidade": {"base": 8, "atributo": "sab", "mult_ascensao": 3},
        "arche": {"base": 8, "atributo": "int", "mult_ascensao": 2},
        "defesa": {"base": 7, "atributo": "des", "mult_ascensao": 1},
        "deslocamento_m": 9,
        "ataque_desarmado": {"dano": "1d4", "atributo": "for", "tipo_dano": "impacto"}
      }
    Retorna vida/sanidade/arche/defesa calculados (numeros), mais
    deslocamento_m e ataque_desarmado repassados como estao (nao dependem
    do grau de ascensao).
    """
    resultado: Dict[str, Optional[int]] = {}
    for status_nome in ("vida", "sanidade", "arche", "defesa"):
        formula = formula_status[status_nome]
        valor_atributo = atributos_finais.get(formula["atributo"], 0)
        resultado[status_nome] = (
            formula["base"] + valor_atributo + formula["mult_ascensao"] * grau_ascensao
        )

    resultado["deslocamento_m"] = formula_status.get("deslocamento_m")
    resultado["ataque_desarmado"] = formula_status.get("ataque_desarmado")
    return resultado
