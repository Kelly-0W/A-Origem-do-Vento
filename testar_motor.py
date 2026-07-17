"""
Teste local do motor de regras -- sem Firebase, sem frontend, sem Vercel.
Carrega o catalogo real de seed/dados/*.json e roda o motor (api/motor)
contra um personagem valido e um invalido, pra provar que a validacao e o
calculo batem com as regras de "A Origem do Vento".

Uso:
    cd cli-teste
    python3 testar_motor.py

Este arquivo precisa estar dentro da pasta cli-teste/ do projeto (nao na
raiz) -- ele localiza a raiz do projeto sozinho, subindo pastas ate achar
"seed/dados".
"""
import json
import os
import sys


def encontrar_raiz_do_projeto(a_partir_de):
    """Sobe diretorios a partir de `a_partir_de` ate achar uma pasta que
    contenha seed/dados -- assim o script funciona seja qual for a pasta
    onde ele estiver, sem depender de um numero fixo de ".." """
    atual = os.path.abspath(a_partir_de)
    while True:
        if os.path.isdir(os.path.join(atual, "seed", "dados")):
            return atual
        pai = os.path.dirname(atual)
        if pai == atual:
            raise FileNotFoundError(
                "Nao encontrei a pasta 'seed/dados' subindo a partir de "
                f"'{a_partir_de}'. Confirme que este arquivo esta dentro "
                "do projeto origem-do-vento (idealmente em cli-teste/)."
            )
        atual = pai


RAIZ = encontrar_raiz_do_projeto(os.path.dirname(__file__))
sys.path.insert(0, RAIZ)

from api.motor.ficha import calcular_ficha  # noqa: E402

PASTA_DADOS = os.path.join(RAIZ, "seed", "dados")


def carregar_catalogo():
    def ler(nome):
        with open(os.path.join(PASTA_DADOS, nome), encoding="utf-8") as f:
            return json.load(f)

    return {
        "racas": ler("racas.json"),
        "classes": ler("classes.json"),
        "origens": ler("origens.json"),
        "pericias": ler("pericias.json"),
        "elementos": ler("elementos.json"),
        "itens": ler("itens.json"),
        "constantes_ascensao": ler("constantes_ascensao.json"),
    }


def main():
    print(f"Raiz do projeto detectada em: {RAIZ}\n")
    catalogo = carregar_catalogo()

    print("=" * 60)
    print(" TESTE 1: personagem VALIDO (Anao Linhagem de Ferro, Gladiador, Artista, Agua)")
    print("=" * 60)
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
    sucesso, resultado = calcular_ficha(escolhas_validas, catalogo, grau_ascensao=0)
    if sucesso:
        print("-> SUCESSO: ficha calculada sem erros.\n")
        calc = resultado["calculado"]
        print("Atributos finais (com modificador racial):", calc["atributos_finais"])
        print("Status:", calc["status"])
        print("Pericia 'luta' calculada:", calc["pericias"]["luta"])
        print("Pericia 'enganacao' calculada:", calc["pericias"]["enganacao"])
    else:
        print("-> FALHA INESPERADA. Erros:")
        for e in resultado["erros"]:
            print("   [!]", e)

    print()
    print("=" * 60)
    print(" TESTE 2: personagem INVALIDO (varias regras quebradas de proposito)")
    print("=" * 60)
    escolhas_invalidas = {
        "raca_id": "anao",
        "linhagem_id": None,
        "classe_id": "gladiador",
        "origem_id": "artista",
        "origem_pericia_escolhida": "furtividade",
        "elemento_id": "fogo",
        "poderes_escolhidos": ["bola-de-fogo"],
        "atributos": {"for": 12, "des": 5, "con": 5, "int": 5, "sab": -2, "car": 1},
        "pericias_treinadas": ["armas_de_fogo"],
        "habilidades_escolhidas": {"raca_globais": [], "raca_linhagem": [], "classe": []},
    }
    sucesso, resultado = calcular_ficha(escolhas_invalidas, catalogo, grau_ascensao=0)
    if not sucesso:
        print(f"-> SUCESSO NO TESTE: o motor pegou {len(resultado['erros'])} erro(s):")
        for e in resultado["erros"]:
            print("   [-]", e)
    else:
        print("-> FALHA CRITICA: o motor aceitou um personagem invalido.")

    print()
    print("=" * 60)
    print(" TESTE 3: personagem VALIDO usando o elemento Caça (estrutura própria)")
    print("=" * 60)
    pericia_origem_id = catalogo["origens"]["selvagem"]["pericias_opcoes"][0]["pericia_id"]
    escolhas_caca = {
        "raca_id": "humano",
        "linhagem_id": None,
        "classe_id": "cacador",
        "origem_id": "selvagem",
        "origem_pericia_escolhida": pericia_origem_id,
        "elemento_id": "caca",
        "confirma_elegibilidade_elemento": True,
        "espiritual_escolhido": "ignarok",
        "poderes_escolhidos": [],
        "atributos": {"for": 3, "des": 3, "con": 2, "int": -1, "sab": 2, "car": 1},
        "pericias_treinadas": [
            pericia_origem_id,
            catalogo["classes"]["cacador"]["pericia_treinada_fixa"],
        ],
        "habilidades_escolhidas": {
            "raca_globais": [
                h["id"] for h in catalogo["racas"]["humano"]["habilidades_globais"][:2]
            ],
            "raca_linhagem": [],
            "classe": [h["id"] for h in catalogo["classes"]["cacador"]["habilidades"][:1]],
        },
    }
    sucesso, resultado = calcular_ficha(escolhas_caca, catalogo, grau_ascensao=0)
    if sucesso:
        print("-> SUCESSO: personagem de Caca calculado sem erros.\n")
        print("Status:", resultado["calculado"]["status"])
    else:
        print("-> Erros (revisar escolhas de exemplo):")
        for e in resultado["erros"]:
            print("   [!]", e)


if __name__ == "__main__":
    main()
