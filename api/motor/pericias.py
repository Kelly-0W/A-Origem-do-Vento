"""
Calculo do bonus final de cada uma das 29 pericias (treinada ou nao).
"""
from typing import Any, Dict, Iterable, Optional

from .constantes import ATRIBUTOS_VALIDOS, bonus_treinamento_pericia, BONUS_PERICIA_RETREINADA


def calcular_pericias(
    pericias_treinadas: Iterable[str],
    atributos_finais: Dict[str, int],
    grau_ascensao: int,
    catalogo_pericias: Dict[str, dict],
    marcos_treinamento: Dict[str, int],
    pericias_manuais: Optional[Dict[str, Any]] = None,
    bonus_fixo: Optional[Dict[str, int]] = None,
) -> Dict[str, dict]:
    """
    catalogo_pericias e o conteudo de pericias.json (id -> {atributo,
    requer_treinamento, ...}).
    marcos_treinamento vem de constantes_ascensao.json -> bonus_treinamento_pericia.marcos.

    pericias_manuais e um ajuste manual opcional (id -> {"treinada": bool,
    "retreinos": int, "atributo": "for"|"des"|"con"|"int"|"sab"|"car"}),
    usado pela tela de personagem pra cobrir casos que o catalogo nao
    automatiza -- por exemplo, uma habilidade de raca cuja descricao diz
    "torna-se treinado em Conhecimento", mas que o motor nao le/aplica
    sozinho. Quando uma pericia aparece em pericias_manuais, o valor de
    "treinada" ali SUBSTITUI por completo o que viria de
    pericias_treinadas (permite tanto adicionar quanto tirar um
    treinamento manualmente).

    "atributo", quando presente e for um dos 6 atributos validos,
    SUBSTITUI o atributo-base daquela pericia (o do catalogo) so' pra esse
    personagem -- cobre habilidades como a do Orc que trocam o atributo
    usado numa pericia especifica (ex.: Guerra passa a usar Forca em vez
    de Inteligencia). Um valor invalido ou ausente e' ignorado (cai pro
    atributo padrao do catalogo) -- assim como o resto de pericias_manuais,
    isso nao e' validado contra "essa habilidade existe mesmo", e' um
    ajuste de confianca da propria mesa.

    "retreinos" e a contagem de vezes que a pericia foi treinada de novo
    depois da primeira (sem limite -- cada retreino narrativo empilha) e
    so tem efeito se a pericia tambem estiver treinada; cada unidade da
    o bonus FIXO de BONUS_PERICIA_RETREINADA (nao escala com o grau, ao
    contrario do bonus normal de treinamento).

    bonus_fixo e um mapa opcional (id -> valor inteiro) de bonus FIXOS
    adicionais que nao vem de treino nem retreino -- hoje usado so pela
    regra das duplicatas (ver ficha.py), mas o parametro fica generico
    caso surja outra fonte de bonus fixo no futuro.

    IMPORTANTE: se a pericia EXIGE treinamento (requer_treinamento=True no
    catalogo) e nao esta treinada, o bonus_total fica travado em 0,
    independente do modificador de atributo ou de qualquer bonus_fixo --
    no sistema, essas pericias simplesmente nao podem ser usadas
    destreinadas (nao e so "usar sem bonus", e' nao poder usar mesmo).

    Retorna, para cada pericia do catalogo, se esta treinada, quantos
    retreinos tem, e o bonus total.
    """
    treinadas_base = set(pericias_treinadas)
    manuais = pericias_manuais or {}
    bonus_fixo_mapa = bonus_fixo or {}
    bonus_treino = bonus_treinamento_pericia(grau_ascensao, marcos_treinamento)

    resultado = {}
    for pericia_id, dados in catalogo_pericias.items():
        atributo_padrao = dados["atributo"]
        requer_treinamento = bool(dados.get("requer_treinamento", False))

        ajuste = manuais.get(pericia_id)
        if ajuste is not None:
            treinada = bool(ajuste.get("treinada", False))
            retreinos = max(0, int(ajuste.get("retreinos", 0))) if treinada else 0
            atributo_override = ajuste.get("atributo")
            atributo = atributo_override if atributo_override in ATRIBUTOS_VALIDOS else atributo_padrao
        else:
            treinada = pericia_id in treinadas_base
            retreinos = 0
            atributo = atributo_padrao

        mod_atributo = atributos_finais.get(atributo, 0)
        bloqueada = requer_treinamento and not treinada

        bonus_treinamento_aplicado = bonus_treino if treinada else 0
        bonus_retreino_aplicado = BONUS_PERICIA_RETREINADA * retreinos
        bonus_fixo_aplicado = bonus_fixo_mapa.get(pericia_id, 0)

        if bloqueada:
            bonus_total = 0
        else:
            bonus_total = mod_atributo + bonus_treinamento_aplicado + bonus_retreino_aplicado + bonus_fixo_aplicado

        resultado[pericia_id] = {
            "treinada": treinada,
            "retreinos": retreinos,
            "atributo": atributo,
            "atributo_padrao": atributo_padrao,
            "requer_treinamento": requer_treinamento,
            "bloqueada": bloqueada,
            "mod_atributo": mod_atributo,
            "bonus_treinamento": bonus_treinamento_aplicado,
            "bonus_retreino": bonus_retreino_aplicado,
            "bonus_fixo": bonus_fixo_aplicado,
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
    assert r["luta"]["retreinos"] == 0
    assert r["luta"]["bonus_total"] == 3 + 3
    assert r["furtividade"]["treinada"] is False
    assert r["furtividade"]["bonus_total"] == 1

    # Ajuste manual adiciona treinamento numa pericia que nao estava na lista.
    r2 = calcular_pericias(
        ["luta"], atributos_finais, 3, catalogo_pericias, marcos,
        pericias_manuais={"misticismo": {"treinada": True, "retreinos": 0}},
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

    # Retreino: +2 por unidade, empilhando sem limite.
    r4 = calcular_pericias(
        ["luta"], atributos_finais, 3, catalogo_pericias, marcos,
        pericias_manuais={"luta": {"treinada": True, "retreinos": 1}},
    )
    assert r4["luta"]["bonus_retreino"] == 2
    assert r4["luta"]["bonus_total"] == 3 + 3 + 2

    r4b = calcular_pericias(
        ["luta"], atributos_finais, 3, catalogo_pericias, marcos,
        pericias_manuais={"luta": {"treinada": True, "retreinos": 5}},
    )
    assert r4b["luta"]["bonus_retreino"] == 10
    assert r4b["luta"]["bonus_total"] == 3 + 3 + 10

    # Retreinos sem treinada nao faz nada -- nao da pra retreinar o que
    # nao esta nem treinado.
    r5 = calcular_pericias(
        [], atributos_finais, 3, catalogo_pericias, marcos,
        pericias_manuais={"luta": {"treinada": False, "retreinos": 3}},
    )
    assert r5["luta"]["treinada"] is False
    assert r5["luta"]["retreinos"] == 0
    assert r5["luta"]["bonus_total"] == 3

    # Pericia que EXIGE treinamento e nao esta treinada -> trava em 0,
    # mesmo tendo um modificador de atributo alto.
    catalogo_com_restricao = {
        **catalogo_pericias,
        "misticismo": {"atributo": "sab", "requer_treinamento": True},
    }
    r6 = calcular_pericias([], {"for": 3, "des": 1, "sab": 5}, 5, catalogo_com_restricao, marcos)
    assert r6["misticismo"]["treinada"] is False
    assert r6["misticismo"]["bloqueada"] is True
    assert r6["misticismo"]["bonus_total"] == 0

    # A mesma pericia, agora treinada -> funciona normal, sem trava.
    r7 = calcular_pericias(["misticismo"], {"for": 3, "des": 1, "sab": 5}, 5, catalogo_com_restricao, marcos)
    assert r7["misticismo"]["bloqueada"] is False
    assert r7["misticismo"]["bonus_total"] == 5 + 4  # sab + bonus do grau 5

    # bonus_fixo (usado pela regra das duplicatas em ficha.py) soma por
    # cima do resto, mas so quando a pericia nao esta bloqueada.
    r8 = calcular_pericias(
        ["luta"], atributos_finais, 3, catalogo_pericias, marcos,
        bonus_fixo={"luta": 2},
    )
    assert r8["luta"]["bonus_fixo"] == 2
    assert r8["luta"]["bonus_total"] == 3 + 3 + 2

    # Override de atributo-base (ex.: habilidade do Orc trocando Guerra de
    # Inteligencia pra Forca): muda qual atributo entra no mod_atributo,
    # mas nao mexe em treinada/retreino/bloqueio.
    catalogo_com_guerra = {**catalogo_pericias, "guerra": {"atributo": "int", "requer_treinamento": True}}
    atributos_com_int_baixo = {"for": 4, "des": 1, "sab": 0, "int": -1}
    r9 = calcular_pericias(
        ["guerra"], atributos_com_int_baixo, 3, catalogo_com_guerra, marcos,
        pericias_manuais={"guerra": {"treinada": True, "retreinos": 0, "atributo": "for"}},
    )
    assert r9["guerra"]["atributo"] == "for"
    assert r9["guerra"]["atributo_padrao"] == "int"
    assert r9["guerra"]["mod_atributo"] == 4
    assert r9["guerra"]["bonus_total"] == 4 + 3  # for(4) + bonus de treino do grau 3, nao mais int(-1)

    # Sem override -- continua usando o atributo padrao do catalogo.
    r10 = calcular_pericias(["guerra"], atributos_com_int_baixo, 3, catalogo_com_guerra, marcos)
    assert r10["guerra"]["atributo"] == "int"
    assert r10["guerra"]["mod_atributo"] == -1

    # Override invalido (atributo que nao existe) -- cai pro padrao em vez
    # de quebrar; e' um ajuste de confianca, entao falha silenciosamente
    # pro valor seguro.
    r11 = calcular_pericias(
        ["guerra"], atributos_com_int_baixo, 3, catalogo_com_guerra, marcos,
        pericias_manuais={"guerra": {"treinada": True, "retreinos": 0, "atributo": "sabedoria-errada"}},
    )
    assert r11["guerra"]["atributo"] == "int"

    print("pericias.py: todos os auto-testes passaram.")
