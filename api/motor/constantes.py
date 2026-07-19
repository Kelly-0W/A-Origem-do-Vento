"""
Constantes fixas do sistema "A Origem do Vento".

Estas NAO dependem do catalogo carregado do Firestore/JSON -- sao regras
fixas do sistema em si (ver docs/projeto-rpg-site-documento-base.md).
"""
from typing import Dict, Optional

ATRIBUTOS_VALIDOS = ["for", "des", "con", "int", "sab", "car"]

# Versao do motor de regras, gravada em cada ficha calculada para saber
# com qual versao das regras aquele calculo foi feito (util se as regras
# mudarem no futuro e for preciso recalcular fichas antigas).
VERSAO_MOTOR = "1.0.0"

# Distribuicao de atributos na criacao (secao "Atributos e Modificadores"):
# 10 pontos, cada atributo de -1 a 3, cada ponto negativo libera +1 extra.
PONTOS_ATRIBUTOS_INICIAIS = 10
ATRIBUTO_MINIMO = -1
ATRIBUTO_MAXIMO = 3

STATUS_BASICOS = ["vida", "sanidade", "arche", "defesa"]

# Uma perícia já treinada que recebe treinamento de novo (ex.: uma
# habilidade que "torna treinado" numa perícia que o personagem já era
# treinado) ganha esse bônus FIXO, somado ao bônus normal de treinamento --
# não escala com o grau de Ascensão, ao contrário do bônus normal.
BONUS_PERICIA_RETREINADA = 2

# Quando a perícia treinada fixa da CLASSE é a mesma escolhida na ORIGEM
# (as duas fontes "colidem" na mesma perícia), o personagem receberia
# treinamento só uma vez e perderia o benefício da segunda fonte -- em vez
# disso, ganha esse bônus FIXO compensatório (ver "regra das duplicatas"
# em motor/ficha.py). Mesmo valor de BONUS_PERICIA_RETREINADA por ora
# (mesma natureza de bônus fixo); ajuste aqui se a regra da mesa definir
# um valor diferente pra esse caso especificamente.
BONUS_PERICIA_DUPLICATA = 2


def bonus_treinamento_pericia(grau_ascensao: int, marcos: Dict[str, int]) -> int:
    """
    marcos vem de constantes_ascensao.json -> bonus_treinamento_pericia.marcos,
    ex: {"1": 1, "3": 3, "5": 4, "7": 6, "10": 9}.

    Regra confirmada com o dono do sistema: os graus intermediarios usam o
    bonus do maior marco <= grau atual (grau 0 = +0).
    """
    pares = sorted((int(grau), bonus) for grau, bonus in marcos.items())
    bonus_atual = 0
    for grau_marco, bonus in pares:
        if grau_ascensao >= grau_marco:
            bonus_atual = bonus
        else:
            break
    return bonus_atual


def faixa_dificuldade_do_grau(grau: int, faixas: Dict[str, dict]) -> Optional[str]:
    """
    faixas vem de constantes_ascensao.json -> faixas_dificuldade,
    ex: {"facil": {"graus": [1,2,3,4]}, "medio": {...}, "dificil": {...}}
    """
    for nome_faixa, dados in faixas.items():
        if grau in dados.get("graus", []):
            return nome_faixa
    return None


def recompensas_do_grau(grau: int, graus_config: Dict[str, dict]) -> list:
    """
    Lista de recompensas estruturadas (`{"tipo": ..., "origem": ..., "descricao": ...}`)
    concedidas exatamente nesse grau -- graus_config vem de
    constantes_ascensao.json -> "graus".
    """
    return graus_config.get(str(grau), {}).get("recompensas", [])


def contar_habilidades_extras_ate_grau(grau_ascensao: int, graus_config: Dict[str, dict]) -> int:
    """
    Quantas recompensas de tipo "habilidade" foram concedidas do Grau 1 ate
    `grau_ascensao` (inclusive). Usado pela validacao pra saber quantas
    habilidades de raca/classe uma ficha DEVERIA ter alem das do Grau 0
    (ver validacoes.py) -- sem isso, a validacao rejeitaria como "excesso"
    as habilidades que o jogador ganhou por Ascensao.

    "Treinamento de Pericia" NAO entra nessa conta -- ao contrario de
    habilidade, perícia treinada não é validada com contagem exata em
    lugar nenhum (ver pericias_manuais em motor/pericias.py, que já
    permite o jogador treinar/destreinar perícias livremente direto na
    ficha), entao essa recompensa e' só informativa pro jogador.
    """
    total = 0
    for grau in range(1, grau_ascensao + 1):
        for recompensa in recompensas_do_grau(grau, graus_config):
            if recompensa.get("tipo") == "habilidade":
                total += 1
    return total
