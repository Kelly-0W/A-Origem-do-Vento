"""
Validacao da distribuicao de pontos de atributo e aplicacao de modificadores
raciais na criacao de personagem.
"""
from typing import Dict, List, Tuple

from .constantes import (
    ATRIBUTOS_VALIDOS,
    PONTOS_ATRIBUTOS_INICIAIS,
    ATRIBUTO_MINIMO,
    ATRIBUTO_MAXIMO,
)


def validar_distribuicao_atributos(atributos: Dict[str, int]) -> Tuple[bool, List[str]]:
    """
    Regras do sistema (secao "Atributos e Modificadores" da Criacao de Personagem):
      - 10 pontos para distribuir entre os 6 atributos (for/des/con/int/sab/car).
      - Cada atributo pode ir de -1 a 3 (ANTES de modificadores de raca/linhagem).
      - Cada ponto negativo libera +1 ponto extra para redistribuir -- na
        pratica isso significa que a SOMA final de todos os atributos deve
        ser exatamente 10, nao importa quantos ficaram negativos.
    """
    erros: List[str] = []

    chaves = set(atributos.keys())
    esperadas = set(ATRIBUTOS_VALIDOS)
    faltando = esperadas - chaves
    sobrando = chaves - esperadas
    if faltando:
        erros.append(f"Atributos faltando: {sorted(faltando)}.")
    if sobrando:
        erros.append(f"Atributos desconhecidos para este sistema: {sorted(sobrando)}.")
    if erros:
        return False, erros

    for attr in ATRIBUTOS_VALIDOS:
        valor = atributos[attr]
        if not isinstance(valor, int):
            erros.append(f"Atributo '{attr}' precisa ser um numero inteiro (recebido: {valor!r}).")
            continue
        if valor < ATRIBUTO_MINIMO or valor > ATRIBUTO_MAXIMO:
            erros.append(
                f"Atributo '{attr}'={valor} fora do intervalo permitido "
                f"({ATRIBUTO_MINIMO} a {ATRIBUTO_MAXIMO})."
            )

    if erros:
        return False, erros

    soma = sum(atributos[attr] for attr in ATRIBUTOS_VALIDOS)
    if soma != PONTOS_ATRIBUTOS_INICIAIS:
        erros.append(
            f"A soma de todos os atributos deve ser exatamente "
            f"{PONTOS_ATRIBUTOS_INICIAIS} pontos (soma atual: {soma})."
        )

    return (len(erros) == 0), erros


def aplicar_modificadores_raciais(
    atributos_base: Dict[str, int], modificadores: Dict[str, int]
) -> Dict[str, int]:
    """
    Soma os modificadores de atributo da raca/linhagem aos atributos base ja
    distribuidos pelo jogador. So deve ser chamado DEPOIS de validar a
    distribuicao base -- os limites -1/3 valem so para a distribuicao base,
    o resultado final (pos-modificador racial) pode ultrapassar isso.
    """
    return {
        attr: atributos_base.get(attr, 0) + modificadores.get(attr, 0)
        for attr in ATRIBUTOS_VALIDOS
    }
