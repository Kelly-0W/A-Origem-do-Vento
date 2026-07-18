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

---

Versionamento do catalogo (docs/projeto-rpg-site-documento-base.md,
secao "Cache local do catalogo"): apos popular as colecoes, este script
grava (ou atualiza) o documento `catalogo_meta/versao`, que o frontend
consulta no login para decidir se precisa rebaixar o catalogo do cache
local (IndexedDB).

A versao NAO e um numero escolhido a mao -- e calculada a partir de um
hash SHA-256 determinístico de todo o conteudo de seed/dados/. Isso evita
o erro humano de esquecer de bumpar um contador manualmente: se o
conteudo dos JSONs nao mudou desde o ultimo seed, o hash bate e a versao
nao avanca; se mudou qualquer coisa (uma virgula que seja), o hash muda e
a versao e incrementada automaticamente.
"""

import hashlib
import json
import os

from firebase_admin import firestore
from firebase_admin_init import get_db

PASTA_DADOS = os.path.join(os.path.dirname(__file__), "dados")

COLECOES_SIMPLES = {
    "racas.json": "racas",
    "classes.json": "classes",
    "origens.json": "origens",
    "pericias.json": "pericias",
    "itens.json": "itens",
}

CATALOGO_META_COLECAO = "catalogo_meta"
CATALOGO_META_DOC = "versao"


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


def calcular_hash_catalogo():
    """Calcula um hash SHA-256 determinístico de TODO o conteúdo de
    seed/dados/ (na ordem fixa abaixo, cada JSON serializado com chaves
    ordenadas). Dois runs com o mesmo conteúdo sempre produzem o mesmo
    hash, independente de reordenação de chaves nos arquivos ou da ordem
    do dicionário do Python.
    """
    arquivos_em_ordem = [
        "racas.json",
        "classes.json",
        "origens.json",
        "pericias.json",
        "itens.json",
        "elementos.json",
        "constantes_ascensao.json",
    ]

    hasher = hashlib.sha256()
    for nome_arquivo in arquivos_em_ordem:
        dados = carregar_json(nome_arquivo)
        # sort_keys garante que a ordem das chaves no JSON de origem nao
        # influencia o hash; separators sem espaco deixa o resultado
        # compacto e estavel entre plataformas.
        bloco = json.dumps(dados, sort_keys=True, ensure_ascii=True, separators=(",", ":"))
        hasher.update(nome_arquivo.encode("utf-8"))
        hasher.update(b"\0")
        hasher.update(bloco.encode("utf-8"))
        hasher.update(b"\0")

    return hasher.hexdigest()


def seed_catalogo_meta(db):
    """Grava/atualiza `catalogo_meta/versao`.

    - Se o documento nao existe ainda: cria com versao=1.
    - Se existe e o hash bate com o hash atual dos dados: nao mexe em
      nada (evita escrita desnecessaria no Firestore).
    - Se existe e o hash mudou: incrementa `versao` em +1.
    """
    hash_atual = calcular_hash_catalogo()

    doc_ref = db.collection(CATALOGO_META_COLECAO).document(CATALOGO_META_DOC)
    doc_atual = doc_ref.get()

    if not doc_atual.exists:
        versao_nova = 1
        doc_ref.set(
            {
                "versao": versao_nova,
                "hash": hash_atual,
                "atualizado_em": firestore.SERVER_TIMESTAMP,
            }
        )
        print(f"  catalogo_meta/versao criado (versao={versao_nova}, hash={hash_atual[:12]}...)")
        return

    dados_atuais = doc_atual.to_dict()
    hash_anterior = dados_atuais.get("hash")
    versao_anterior = dados_atuais.get("versao", 0)

    if hash_anterior == hash_atual:
        print(
            f"  catalogo_meta/versao inalterado (versao={versao_anterior}) "
            "-- conteudo de seed/dados/ nao mudou desde o ultimo seed."
        )
        return

    versao_nova = versao_anterior + 1
    doc_ref.set(
        {
            "versao": versao_nova,
            "hash": hash_atual,
            "atualizado_em": firestore.SERVER_TIMESTAMP,
        }
    )
    print(
        f"  catalogo_meta/versao atualizado: versao {versao_anterior} -> {versao_nova} "
        f"(hash={hash_atual[:12]}...)"
    )


def main():
    db = get_db()

    print("Populando colecoes simples (racas, classes, origens, pericias, itens)...")
    seed_colecoes_simples(db)

    print("Populando elementos + subcolecao de poderes...")
    seed_elementos_e_poderes(db)

    print("Populando constantes...")
    seed_constantes(db)

    print("Atualizando catalogo_meta/versao...")
    seed_catalogo_meta(db)

    print("Seed concluido.")


if __name__ == "__main__":
    main()

