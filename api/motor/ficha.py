"""
Orquestrador: junta validacao + calculo de status/pericias numa unica
chamada. E isto que a Cloud Function `validar_e_calcular_ficha` vai chamar.
"""
from typing import Any, Dict, Tuple

from .atributos import aplicar_modificadores_raciais
from .pericias import calcular_pericias
from .status import calcular_status
from .validacoes import validar_escolhas_personagem


def calcular_ficha(
    escolhas: Dict[str, Any], catalogo: Dict[str, Any], grau_ascensao: int = 0
) -> Tuple[bool, Dict[str, Any]]:
    """
    Retorna (sucesso, resultado).
    Se sucesso=False, resultado = {"erros": [...]}
    Se sucesso=True, resultado = {"calculado": {...}} pronto pra gravar na
    ficha do personagem (ver docs/schema-banco-dados-personagem.md).
    """
    valido, erros = validar_escolhas_personagem(escolhas, catalogo)
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

    atributos_finais = aplicar_modificadores_raciais(escolhas["atributos"], modificadores_atributo)
    status_calculados = calcular_status(formula_status, atributos_finais, grau_ascensao)

    marcos_treinamento = catalogo["constantes_ascensao"]["bonus_treinamento_pericia"]["marcos"]
    pericias_calculadas = calcular_pericias(
        escolhas.get("pericias_treinadas", []),
        atributos_finais,
        grau_ascensao,
        catalogo["pericias"],
        marcos_treinamento,
    )

    calculado = {
        "atributos_base": escolhas["atributos"],
        "atributos_finais": atributos_finais,
        "grau_ascensao": grau_ascensao,
        "status": status_calculados,
        "pericias": pericias_calculadas,
    }
    return True, {"calculado": calculado}
