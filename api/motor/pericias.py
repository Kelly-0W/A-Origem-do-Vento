"""
Calculo do bonus final de cada uma das 29 pericias (treinada ou nao).
"""
from typing import Dict, Iterable

from .constantes import bonus_treinamento_pericia


def calcular_pericias(
    pericias_treinadas: Iterable[str],
    atributos_finais: Dict[str, int],
    grau_ascensao: int,
    catalogo_pericias: Dict[str, dict],
    marcos_treinamento: Dict[str, int],
) -> Dict[str, dict]:
    """
    catalogo_pericias e o conteudo de pericias.json (id -> {atributo, ...}).
    marcos_treinamento vem de constantes_ascensao.json -> bonus_treinamento_pericia.marcos.

    Retorna, para cada pericia do catalogo, se esta treinada e o bonus total
    (modificador de atributo + bonus de treinamento, se aplicavel).
    """
    treinadas = set(pericias_treinadas)
    bonus_treino = bonus_treinamento_pericia(grau_ascensao, marcos_treinamento)

    resultado = {}
    for pericia_id, dados in catalogo_pericias.items():
        atributo = dados["atributo"]
        mod_atributo = atributos_finais.get(atributo, 0)
        treinada = pericia_id in treinadas
        bonus_total = mod_atributo + (bonus_treino if treinada else 0)
        resultado[pericia_id] = {
            "treinada": treinada,
            "atributo": atributo,
            "mod_atributo": mod_atributo,
            "bonus_treinamento": bonus_treino if treinada else 0,
            "bonus_total": bonus_total,
        }
    return resultado
