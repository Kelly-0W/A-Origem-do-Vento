from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import os

PASTA_DADOS = os.path.join(os.path.dirname(__file__), "..", "seed", "dados")

ARQUIVO_POR_COLECAO = {
    "racas": "racas.json",
    "classes": "classes.json",
    "origens": "origens.json",
    "pericias": "pericias.json",
    "elementos": "elementos.json",
    "itens": "itens.json",
    "bestiario": "bestiario.json",
    "sagracanticos": "sagracanticos.json",
    # Usada pelo frontend pra saber em qual faixa de dificuldade
    # (facil/medio/dificil) cai o grau-alvo de uma Ascensao, e assim
    # mostrar a Provacao/Ritual certos (ver PainelAscensao.jsx).
    "constantes_ascensao": "constantes_ascensao.json",
}


def _ler(nome_arquivo):
    with open(os.path.join(PASTA_DADOS, nome_arquivo), encoding="utf-8") as f:
        return json.load(f)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        colecao = (query.get("colecao") or [None])[0]

        if colecao not in ARQUIVO_POR_COLECAO:
            resposta = {
                "sucesso": False,
                "erros": [
                    f"Colecao '{colecao}' invalida. Opcoes: {list(ARQUIVO_POR_COLECAO.keys())}."
                ],
            }
            status_code = 400
        else:
            itens = _ler(ARQUIVO_POR_COLECAO[colecao])
            resposta = {"sucesso": True, "colecao": colecao, "itens": itens}
            status_code = 200

        self.send_response(status_code)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(resposta, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
