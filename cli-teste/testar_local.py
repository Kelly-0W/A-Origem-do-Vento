"""
Teste local rapido -- sem Firebase, sem frontend, sem internet.

Carrega o exemplo de raca em seed/dados/racas.json e calcula os status
usando a formula de coeficientes definida no schema
(base + atributo + mult_ascensao * grau), so pra confirmar que a
estrutura de dados faz sentido antes de conectar qualquer coisa no
Firebase de verdade.

Uso:
    cd cli-teste
    python testar_local.py
"""

import json
import os

CAMINHO_RACAS = os.path.join(
    os.path.dirname(__file__), "..", "seed", "dados", "racas.json"
)


def calcular_status(formula, atributos, grau_ascensao):
    return (
        formula["base"]
        + atributos[formula["atributo"]]
        + formula["mult_ascensao"] * grau_ascensao
    )


def main():
    with open(CAMINHO_RACAS, encoding="utf-8") as f:
        racas = json.load(f)

    humano = racas["humano"]

    # Atributos de exemplo (10 pontos distribuidos, dentro das regras:
    # min -1, max 3)
    atributos_exemplo = {"for": 1, "des": 2, "con": 3, "int": -1, "sab": 1, "car": 2}
    grau = 0

    print(f"Testando raca: {humano['nome']}")
    print(f"Atributos de exemplo: {atributos_exemplo}")
    print(f"Grau de Ascensao: {grau}")
    print()

    for status_nome in ["vida", "sanidade", "arche", "defesa"]:
        formula = humano["status"][status_nome]
        valor = calcular_status(formula, atributos_exemplo, grau)
        print(f"  {status_nome}: {valor}")

    print(f"  deslocamento_m: {humano['status']['deslocamento_m']}")
    print()
    print("Se os numeros acima fazem sentido, a estrutura de dados esta ok.")
    print("Ex: vida = 10 (base) + 3 (constituicao) + 4*0 (grau) = 13")


if __name__ == "__main__":
    main()
