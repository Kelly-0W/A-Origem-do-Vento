from __future__ import annotations
from typing import Any, Dict, Tuple
from .atributos import aplicar_modificadores_raciais
from .constantes import VERSAO_MOTOR, BONUS_PERICIA_DUPLICATA
from .pericias import calcular_pericias
from .status import calcular_status
from .validacoes import validar_escolhas_personagem
"""
functions/motor/ficha.py

Orquestrador: junta validação + cálculo de status/perícias numa única
chamada. É isto que a Cloud Function `validar_e_calcular_ficha` (e o
endpoint Vercel equivalente) chamam.
"""


def calcular_ficha(
    escolhas: Dict[str, Any], catalogo: Dict[str, Any], grau_ascensao: int = 0
) -> Tuple[bool, Dict[str, Any]]:
    """
    Retorna (sucesso, resultado).
    Se sucesso=False, resultado = {"erros": [...]}
    Se sucesso=True, resultado = {"calculado": {...}} pronto pra gravar na
    ficha do personagem (ver docs/schema-banco-dados-personagem.md).
    """
    valido, erros = validar_escolhas_personagem(escolhas, catalogo, grau_ascensao=grau_ascensao)
    if not valido:
        return False, {"erros": erros}

    raca = catalogo["racas"][escolhas["raca_id"]]
    linhagem_id = escolhas.get("linhagem_id")
    linhagem = None
    if linhagem_id:
        linhagem = next(l for l in raca["linhagens"] if l["id"] == linhagem_id)

    formula_status = linhagem["status"] if linhagem else raca["status"]
    modificadores_atributo = (
        linhagem["modificadores_atributo"] if linhagem else raca["modificadores_atributo"]
    )

    atributos_finais = aplicar_modificadores_raciais(
        escolhas["atributos"], modificadores_atributo)
    status_calculados = calcular_status(
        formula_status, atributos_finais, grau_ascensao)

    marcos_treinamento = (
        catalogo.get("constantes_ascensao", {})
        .get("bonus_treinamento_pericia", {})
        .get("marcos", {})
    )

    # Regra das duplicatas: se a pericia treinada fixa da CLASSE for a
    # mesma escolhida na ORIGEM, as duas fontes "colidem" na mesma
    # pericia e o personagem so ganharia treinamento uma vez, perdendo o
    # benefico da segunda fonte -- em vez disso, ele recebe um bonus FIXO
    # compensatorio (BONUS_PERICIA_DUPLICATA), que nao escala com o grau
    # de Ascensao (por isso e passado como bonus_fixo, nao como retreino).
    classe = catalogo["classes"][escolhas["classe_id"]]
    pericia_fixa_classe = classe.get("pericia_treinada_fixa")
    pericia_escolhida_origem = escolhas.get("origem_pericia_escolhida")

    bonus_fixo_pericias: Dict[str, int] = {}
    if pericia_fixa_classe and pericia_fixa_classe == pericia_escolhida_origem:
        bonus_fixo_pericias[pericia_fixa_classe] = BONUS_PERICIA_DUPLICATA

    pericias_calculadas = calcular_pericias(
        escolhas.get("pericias_treinadas", []),
        atributos_finais,
        grau_ascensao,
        catalogo["pericias"],
        marcos_treinamento,
        pericias_manuais=escolhas.get("pericias_manuais", {}),
        bonus_fixo=bonus_fixo_pericias,
    )

    calculado = {
        "atributos_base": escolhas["atributos"],
        "atributos_finais": atributos_finais,
        "grau_ascensao": grau_ascensao,
        "status": status_calculados,
        "pericias": pericias_calculadas,
        "versao_motor": VERSAO_MOTOR,
    }
    return True, {"calculado": calculado}


if __name__ == "__main__":
    # Auto-teste simples: roda com `python -m functions.motor.ficha`
    # ou `python ficha.py` a partir desta pasta.

    catalogo = {
        "racas": {
            "humano": {
                "linhagens": [],
                "modificadores_atributo": {"int": 1, "car": 1, "for": -1},
                "status": {
                    "vida": {"base": 10, "atributo": "con", "mult_ascensao": 4},
                    "sanidade": {"base": 8, "atributo": "sab", "mult_ascensao": 3},
                    "arche": {"base": 8, "atributo": "int", "mult_ascensao": 2},
                    "defesa": {"base": 7, "atributo": "des", "mult_ascensao": 1},
                    "deslocamento_m": 9,
                    "ataque_desarmado": {"dano": "1d4", "atributo": "for", "tipo_dano": "impacto"},
                },
                "qtd_habilidades_iniciais": 1,
                "habilidades_globais": [{"id": "versatilidade"}],
                "habilidades_especificas": [],
            },
        },
        "classes": {
            "gladiador": {
                "qtd_habilidades_iniciais": 1,
                "habilidades": [{"id": "golpe-poderoso"}],
                "pericia_treinada_fixa": "luta",
            },
        },
        "origens": {
            "criminoso": {"pericias_opcoes": ["furtividade"]},
        },
        "pericias": {
            "luta": {"atributo": "for"},
            "furtividade": {"atributo": "des"},
        },
        "elementos": {
            "fogo": {"restricao_elegibilidade": None, "poderes": {"bola-de-fogo": {}, "rastro": {}}},
        },
    }

    escolhas = {
        "raca_id": "humano",
        "linhagem_id": None,
        "classe_id": "gladiador",
        "subclasse_id": None,
        "origem_id": "criminoso",
        "origem_pericia_escolhida": "furtividade",
        "elemento_id": "fogo",
        "poderes_escolhidos": ["bola-de-fogo", "rastro"],
        "atributos": {"for": 3, "des": 2, "con": 2, "int": 1, "sab": 1, "car": 1},
        "pericias_treinadas": ["luta", "furtividade"],
        "habilidades_escolhidas": {
            "raca_globais": ["versatilidade"],
            "raca_linhagem": [],
            "classe": ["golpe-poderoso"],
        },
    }

    sucesso, resultado = calcular_ficha(escolhas, catalogo, grau_ascensao=0)
    assert sucesso, resultado
    calculado = resultado["calculado"]
    # atributos finais = base + modificadores raciais do humano
    assert calculado["atributos_finais"] == {
        "for": 2, "des": 2, "con": 2, "int": 2, "sab": 1, "car": 2}
    assert calculado["status"]["vida"] == 10 + 2  # base + con
    # for final, sem treino no grau 0
    assert calculado["pericias"]["luta"]["bonus_total"] == 2
    assert calculado["versao_motor"] == VERSAO_MOTOR

    # escolhas inválidas -> sucesso False com lista de erros
    sucesso_falho, resultado_falho = calcular_ficha(
        {**escolhas, "raca_id": "orc"}, catalogo, grau_ascensao=0
    )
    assert sucesso_falho is False
    assert "erros" in resultado_falho and len(resultado_falho["erros"]) > 0

    # Regra das duplicatas: origem escolhe a MESMA pericia que a classe já
    # dá fixo ("luta") -> bonus_fixo de compensação, mesmo sem retreino
    # manual nenhum e independente do grau de Ascensão.
    catalogo_dup = {
        **catalogo,
        "origens": {"criminoso": {"pericias_opcoes": ["luta"]}},
        "pericias": {
            **catalogo["pericias"],
            "acrobacia": {"atributo": "des", "requer_treinamento": True},
        },
    }
    escolhas_dup = {
        **escolhas,
        "origem_pericia_escolhida": "luta",
        "pericias_treinadas": ["luta"],
    }
    sucesso_dup, resultado_dup = calcular_ficha(escolhas_dup, catalogo_dup, grau_ascensao=0)
    assert sucesso_dup, resultado_dup
    luta_calc = resultado_dup["calculado"]["pericias"]["luta"]
    assert luta_calc["bonus_fixo"] == BONUS_PERICIA_DUPLICATA
    # for final = 2 (ver acima) + bonus de treino no grau 0 (0) + bonus_fixo (2)
    assert luta_calc["bonus_total"] == 2 + 0 + BONUS_PERICIA_DUPLICATA

    # Pericia que exige treinamento e nao esta treinada -> 0, mesmo com
    # atributo positivo (acrobacia usa Destreza, e o personagem tem +2 de Des).
    acrobacia_calc = resultado_dup["calculado"]["pericias"]["acrobacia"]
    assert acrobacia_calc["bloqueada"] is True
    assert acrobacia_calc["bonus_total"] == 0

    print("ficha.py: todos os auto-testes passaram.")