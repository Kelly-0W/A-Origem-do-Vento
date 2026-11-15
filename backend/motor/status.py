"""
Calculo dos status basicos (Vida, Sanidade, Arche, Defesa, Deslocamento) a
partir da formula de coeficientes de uma raca ou linhagem.
"""
from typing import Dict, Optional

# As 4 status que recebem "Pontos Para Distribuir entre Status" da tabela
# de Progressao de Ascensao (pagina Ascensao, Notion) -- deslocamento_m e
# ataque_desarmado ficam de fora de proposito: nao sao "pools" numericos
# que fariam sentido receber pontos avulsos.
STATUS_DISTRIBUIVEIS = ("vida", "sanidade", "arche", "defesa")


def calcular_status(
    formula_status: Dict,
    atributos_finais: Dict[str, int],
    grau_ascensao: int,
    pontos_status_alocados: Optional[Dict[str, int]] = None,
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

    `pontos_status_alocados` e' o total CUMULATIVO (somando todos os graus
    de Ascensao ja efetivados) que o jogador ja distribuiu entre
    vida/sanidade/arche/defesa -- ver "Tabela de Progressao de Ascensao"
    (coluna "Pontos Para Distribuir entre Status") e
    api/aplicar_recompensas_ascensao.py, que e' quem de fato grava esse
    dicionario em escolhas["pontos_status_alocados"] a cada Ascensao
    efetivada. Somado direto em cima do resultado da formula normal.

    Retorna vida/sanidade/arche/defesa calculados (numeros), mais
    deslocamento_m e ataque_desarmado repassados como estao (nao dependem
    do grau de ascensao nem dos pontos distribuidos).
    """
    pontos = pontos_status_alocados or {}
    resultado: Dict[str, Optional[int]] = {}
    for status_nome in STATUS_DISTRIBUIVEIS:
        formula = formula_status[status_nome]
        valor_atributo = atributos_finais.get(formula["atributo"], 0)
        resultado[status_nome] = (
            formula["base"]
            + valor_atributo
            + formula["mult_ascensao"] * grau_ascensao
            + int(pontos.get(status_nome, 0) or 0)
        )

    resultado["deslocamento_m"] = formula_status.get("deslocamento_m")
    resultado["ataque_desarmado"] = formula_status.get("ataque_desarmado")
    return resultado


if __name__ == "__main__":
    formula = {
        "vida": {"base": 10, "atributo": "con", "mult_ascensao": 4},
        "sanidade": {"base": 8, "atributo": "sab", "mult_ascensao": 3},
        "arche": {"base": 8, "atributo": "int", "mult_ascensao": 2},
        "defesa": {"base": 7, "atributo": "des", "mult_ascensao": 1},
        "deslocamento_m": 9,
        "ataque_desarmado": {"dano": "1d4", "atributo": "for", "tipo_dano": "impacto"},
    }
    atributos = {"con": 2, "sab": 1, "int": 0, "des": 1, "for": 0}

    # Sem pontos de Ascensao alocados (personagem recem-criado, grau 0):
    # comportamento identico ao de antes desta mudanca.
    r = calcular_status(formula, atributos, grau_ascensao=0)
    assert r["vida"] == 12  # 10 + 2 + 4*0
    assert r["defesa"] == 8  # 7 + 1 + 1*0

    # Com pontos de Ascensao alocados: soma direto em cima do resultado da
    # formula, pool por pool.
    r = calcular_status(
        formula, atributos, grau_ascensao=1,
        pontos_status_alocados={"vida": 2, "defesa": 1},
    )
    assert r["vida"] == 18  # 10 + 2 + 4*1 + 2 (pontos alocados)
    assert r["defesa"] == 10  # 7 + 1 + 1*1 + 1 (pontos alocados)
    assert r["sanidade"] == 12  # 8 + 1 + 3*1 + 0 (nao alocou nada aqui)

    print("status.py: todos os auto-testes passaram.")
