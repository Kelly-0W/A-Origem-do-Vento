"""
Teste de ponta a ponta do endpoint /api/validar_e_calcular_ficha rodando
localmente via `vercel dev`.

Uso:
    1. Num terminal: vercel dev
    2. Noutro terminal: python test_api.py
"""
import json

import requests

API_URL = "http://localhost:3000/api/validar_e_calcular_ficha"

# Mesmo personagem de exemplo do cli-teste/testar_motor.py, agora indo
# de verdade pela API (POST) em vez de chamar o motor direto em Python.
escolhas_validas = {
    "raca_id": "anao",
    "linhagem_id": "ferro",
    "classe_id": "gladiador",
    "subclasse_id": None,
    "origem_id": "artista",
    "origem_pericia_escolhida": "enganacao",
    "elemento_id": "agua",
    "poderes_escolhidos": ["tiro-dagua", "bolha-dagua"],
    "atributos": {"for": 3, "des": 2, "con": 3, "int": 1, "sab": 0, "car": 1},
    "pericias_treinadas": ["enganacao", "luta"],
    "habilidades_escolhidas": {
        "raca_globais": [],
        "raca_linhagem": ["pele-vulcanica", "sangue-em-ebulicao"],
        "classe": ["gladiador-sangue-de-arena"],
    },
}


def rodar_teste():
    print(f"Enviando escolhas de personagem para {API_URL}...\n")
    corpo = {"escolhas": escolhas_validas, "grau_ascensao": 0}

    try:
        response = requests.post(API_URL, json=corpo)
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            print("\nSucesso! Resposta do servidor:")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        else:
            print("\nErro retornado pela API (resposta ainda assim valida, ver 'erros'):")
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))

    except requests.exceptions.ConnectionError:
        print("Erro de conexao: o servidor nao esta rodando.")
        print("Rode 'vercel dev' num terminal antes de rodar este teste.")
    except Exception as e:
        print(f"Erro inesperado: {e}")


if __name__ == "__main__":
    rodar_teste()
