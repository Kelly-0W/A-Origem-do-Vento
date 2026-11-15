"""Única Function Vercel para todas as rotas da API.

Os módulos de cada operação vivem em ``backend.handlers``. O ``vercel.json``
reescreve as URLs públicas (por exemplo, ``/api/biblioteca``) para esta
Function e informa o destino em ``endpoint``. Assim, o plano Hobby conta só
uma Serverless Function sem alterar o contrato usado pelo frontend.
"""
from http.server import BaseHTTPRequestHandler
from importlib import import_module
import json
from urllib.parse import parse_qs, urlparse


HANDLERS = {
    "amigo_personagens": "amigo_personagens",
    "aplicar_recompensas_ascensao": "aplicar_recompensas_ascensao",
    "biblioteca": "biblioteca",
    "campanha_participantes": "campanha_participantes",
    "excluir_campanha": "excluir_campanha",
    "excluir_conta": "excluir_conta",
    "mestre_ajustar_recurso_personagem": "mestre_ajustar_recurso_personagem",
    "mestre_campanha_personagens": "mestre_campanha_personagens",
    "mestre_remover_da_campanha": "mestre_remover_da_campanha",
    "responder_ascensao": "responder_ascensao",
    "responder_redistribuicao_atributos": "responder_redistribuicao_atributos",
    "solicitar_redistribuicao_atributos": "solicitar_redistribuicao_atributos",
    "validar_e_calcular_ficha": "validar_e_calcular_ficha",
}


class handler(BaseHTTPRequestHandler):
    def _encaminhar(self, metodo):
        parametros = parse_qs(urlparse(self.path).query)
        endpoint = (parametros.get("endpoint") or [None])[0]
        modulo = HANDLERS.get(endpoint)
        if modulo is None:
            self._responder(404, {"sucesso": False, "erros": ["Endpoint não encontrado."]})
            return

        classe = import_module(f"backend.handlers.{modulo}").handler
        funcao = getattr(classe, metodo, None)
        if funcao is None:
            self._responder(405, {"sucesso": False, "erros": ["Método não permitido."]})
            return
        funcao(self)

    def do_GET(self):
        self._encaminhar("do_GET")

    def do_POST(self):
        self._encaminhar("do_POST")

    def do_OPTIONS(self):
        self._encaminhar("do_OPTIONS")

    def _responder(self, status_code, resposta):
        self.send_response(status_code)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(json.dumps(resposta, ensure_ascii=False).encode("utf-8"))
