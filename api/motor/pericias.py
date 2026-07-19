"""
Calculo do bonus final de cada uma das 29 pericias (treinada ou nao).
"""
from typing import Any, Dict, Iterable, Optional

from .constantes import bonus_treinamento_pericia, BONUS_PERICIA_RETREINADA


def calcular_pericias(
    pericias_treinadas: Iterable[str],
    atributos_finais: Dict[str, int],
    grau_ascensao: int,
    catalogo_pericias: Dict[str, dict],
    marcos_treinamento: Dict[str, int],
    pericias_manuais: Optional[Dict[str, Any]] = None,
) -> Dict[str, dict]:
    """
    catalogo_pericias e o conteudo de pericias.json (id -> {atributo, ...}).
    marcos_treinamento vem de constantes_ascensao.json -> bonus_treinamento_pericia.marcos.

    pericias_manuais e um ajuste manual opcional (id -> {"treinada": bool,
    "retreinada": bool}), usado pela tela de personagem pra cobrir casos
    que o catalogo nao automatiza -- por exemplo, uma habilidade de raca
    cuja descricao diz "torna-se treinado em Conhecimento", mas que o
    motor nao le/aplica sozinho. Quando uma pericia aparece em
    pericias_manuais, o valor de "treinada" ali SUBSTITUI por completo o
    que viria de pericias_treinadas (permite tanto adicionar quanto tirar
    um treinamento manualmente). "retreinada" so tem efeito se a pericia
    tambem estiver treinada, e da o bonus FIXO de BONUS_PERICIA_RETREINADA
    (nao escala com o grau, ao contrario do bonus normal de treinamento).

    Retorna, para cada pericia do catalogo, se esta treinada e o bonus
    total (modificador de atributo + bonus de treinamento + bonus de
    retreinamento, se aplicaveis).
    """
    treinadas_base = set(pericias_treinadas)
    manuais = pericias_manuais or {}
    bonus_treino = bonus_treinamento_pericia(grau_ascensao, marcos_treinamento)

    resultado = {}
    for pericia_id, dados in catalogo_pericias.items():
        atributo = dados["atributo"]
        mod_atributo = atributos_finais.get(atributo, 0)

        ajuste = manuais.get(pericia_id)
        if ajuste is not None:
            treinada = bool(ajuste.get("treinada", False))
            retreinada = treinada and bool(ajuste.get("retreinada", False))
        else:
            treinada = pericia_id in treinadas_base
            retreinada = False

        bonus_treinamento_aplicado = bonus_treino if treinada else 0
        bonus_retreino_aplicado = BONUS_PERICIA_RETREINADA if retreinada else 0
        bonus_total = mod_atributo + bonus_treinamento_aplicado + bonus_retreino_aplicado

        resultado[pericia_id] = {
            "treinada": treinada,
            "retreinada": retreinada,
            "atributo": atributo,
            "mod_atributo": mod_atributo,
            "bonus_treinamento": bonus_treinamento_aplicado,
            "bonus_retreino": bonus_retreino_aplicado,
            "bonus_total": bonus_total,
        }
    return resultado


if __name__ == "__main__":
    # Auto-teste simples: roda com `python pericias.py` a partir desta pasta.
    catalogo_pericias = {
        "luta": {"atributo": "for"},
        "furtividade": {"atributo": "des"},
        "misticismo": {"atributo": "sab"},
    }
    atributos_finais = {"for": 3, "des": 1, "sab": 0}
    marcos = {"1": 1, "3": 3, "5": 4, "7": 6, "10": 9}

    # Sem ajuste manual: so' o que veio de pericias_treinadas.
    r = calcular_pericias(["luta"], atributos_finais, 3, catalogo_pericias, marcos)
    assert r["luta"]["treinada"] is True
    assert r["luta"]["bonus_treinamento"] == 3
    assert r["luta"]["bonus_total"] == 3 + 3
    assert r["furtividade"]["treinada"] is False
    assert r["furtividade"]["bonus_total"] == 1

    # Ajuste manual adiciona treinamento numa pericia que nao estava na lista.
    r2 = calcular_pericias(
        ["luta"], atributos_finais, 3, catalogo_pericias, marcos,
        pericias_manuais={"misticismo": {"treinada": True, "retreinada": False}},
    )
    assert r2["misticismo"]["treinada"] is True
    assert r2["misticismo"]["bonus_total"] == 0 + 3

    # Ajuste manual REMOVE um treinamento que veio da lista original.
    r3 = calcular_pericias(
        ["luta"], atributos_finais, 3, catalogo_pericias, marcos,
        pericias_manuais={"luta": {"treinada": False}},
    )
    assert r3["luta"]["treinada"] is False
    assert r3["luta"]["bonus_total"] == 3

    # Retreinada: bonus fixo de +2, somado ao bonus normal (nao substitui).
    r4 = calcular_pericias(
        ["luta"], atributos_finais, 3, catalogo_pericias, marcos,
        pericias_manuais={"luta": {"treinada": True, "retreinada": True}},
    )
    assert r4["luta"]["bonus_retreino"] == 2
    assert r4["luta"]["bonus_total"] == 3 + 3 + 2

    # "retreinada" sem "treinada" nao faz nada -- nao da pra retreinar o
    # que nao esta nem treinado.
    r5 = calcular_pericias(
        [], atributos_finais, 3, catalogo_pericias, marcos,
        pericias_manuais={"luta": {"treinada": False, "retreinada": True}},
    )
    assert r5["luta"]["treinada"] is False
    assert r5["luta"]["retreinada"] is False
    assert r5["luta"]["bonus_total"] == 3

    print("pericias.py: todos os auto-testes passaram.")
