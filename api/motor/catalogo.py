"""
api/motor/catalogo.py

Carregamento do catalogo de regras a partir dos JSONs em seed/dados/.

Extraido de api/validar_e_calcular_ficha.py pra ser reaproveitado tambem
por api/responder_ascensao.py (que precisa recalcular a ficha no mesmo
formato, no grau de Ascensao aprovado pelo Mestre).

NOTA: isso le os arquivos locais empacotados no deploy da Vercel, NAO o
Firestore. E uma solucao valida por enquanto (o catalogo muda pouco, e
assim fica rapido e sem custo de leitura no Firestore a cada requisicao),
mas se no futuro o catalogo passar a ser editado direto no Firestore (fora
do Git), esta funcao precisa trocar para ler de la via Firebase Admin SDK.
"""
import json
import os

# Este arquivo mora em api/motor/catalogo.py, entao a raiz do projeto (onde
# fica seed/) esta dois niveis acima.
PASTA_DADOS = os.path.join(os.path.dirname(
    __file__), "..", "..", "seed", "dados")


def carregar_catalogo():
    def ler(nome):
        caminho = os.path.join(PASTA_DADOS, nome)
        with open(caminho, encoding="utf-8") as f:
            return json.load(f)

    return {
        "racas": ler("racas.json"),
        "classes": ler("classes.json"),
        "origens": ler("origens.json"),
        "pericias": ler("pericias.json"),
        "elementos": ler("elementos.json"),
        "itens": ler("itens.json"),
        "constantes_ascensao": ler("constantes_ascensao.json"),
        "sagracanticos": ler("sagracanticos.json"),
    }
