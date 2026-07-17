"""
Le os arquivos em seed/dados/*.json e escreve no Firestore.

STATUS ATUAL: esqueleto funcional. Os arquivos em dados/ tem so 1-2
exemplos por colecao, pra validar o pipeline (JSON -> Firestore) antes de
popular o catalogo completo (14 racas, todas as classes, etc. -- isso e a
proxima etapa).

Uso:
    cd seed
    python seed_catalogo.py

Pre-requisito: seed/serviceAccountKey.json (ver firebase_admin_init.py).
"""

import json
import os

from firebase_admin_init import get_db

PASTA_DADOS = os.path.join(os.path.dirname(__file__), "dados")

COLECOES_SIMPLES = {
    "racas.json": "racas",
    "classes.json": "classes",
    "origens.json": "origens",
    "pericias.json": "pericias",
    "itens.json": "itens",
}


def carregar_json(nome_arquivo):
    caminho = os.path.join(PASTA_DADOS, nome_arquivo)
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def seed_colecoes_simples(db):
    for arquivo, colecao in COLECOES_SIMPLES.items():
        dados = carregar_json(arquivo)
        for doc_id, conteudo in dados.items():
            db.collection(colecao).document(doc_id).set(conteudo)
            print(f"  {colecao}/{doc_id} gravado")


def seed_elementos_e_poderes(db):
    dados = carregar_json("elementos.json")
    for elemento_id, conteudo in dados.items():
        poderes = conteudo.pop("poderes", {})
        db.collection("elementos").document(elemento_id).set(conteudo)
        print(f"  elementos/{elemento_id} gravado")
        for poder_id, poder in poderes.items():
            (
                db.collection("elementos")
                .document(elemento_id)
                .collection("poderes")
                .document(poder_id)
                .set(poder)
            )
            print(f"    elementos/{elemento_id}/poderes/{poder_id} gravado")


def seed_constantes(db):
    dados = carregar_json("constantes_ascensao.json")
    db.collection("constantes").document("ascensao").set(dados)
    print("  constantes/ascensao gravado")


def main():
    db = get_db()

    print("Populando colecoes simples (racas, classes, origens, pericias, itens)...")
    seed_colecoes_simples(db)

    print("Populando elementos + subcolecao de poderes...")
    seed_elementos_e_poderes(db)

    print("Populando constantes...")
    seed_constantes(db)

    print("Seed concluido.")


if __name__ == "__main__":
    main()
