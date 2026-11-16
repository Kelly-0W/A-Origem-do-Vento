"""Única Function Vercel para todas as rotas da API.

Os módulos de cada operação vivem em ``backend.handlers``. O ``vercel.json``
reescreve as URLs públicas (por exemplo, ``/api/biblioteca``) para esta
Function e informa o destino em ``endpoint``. Assim, o plano Hobby conta só
uma Serverless Function sem alterar o contrato usado pelo frontend.
"""
from http.server import BaseHTTPRequestHandler
import json
import logging
from urllib.parse import parse_qs, urlparse

from backend.handlers.amigo_personagens import handler as AmigoPersonagensHandler
from backend.handlers.aplicar_recompensas_ascensao import handler as AplicarRecompensasAscensaoHandler
from backend.handlers.biblioteca import handler as BibliotecaHandler
from backend.handlers.campanha_participantes import handler as CampanhaParticipantesHandler
from backend.handlers.excluir_campanha import handler as ExcluirCampanhaHandler
from backend.handlers.excluir_conta import handler as ExcluirContaHandler
from backend.handlers.mestre_ajustar_recurso_personagem import handler as MestreAjustarRecursoHandler
from backend.handlers.mestre_campanha_personagens import handler as MestreCampanhaPersonagensHandler
from backend.handlers.mestre_remover_da_campanha import handler as MestreRemoverDaCampanhaHandler
from backend.handlers.responder_ascensao import handler as ResponderAscensaoHandler
from backend.handlers.responder_redistribuicao_atributos import handler as ResponderRedistribuicaoHandler
from backend.handlers.solicitar_redistribuicao_atributos import handler as SolicitarRedistribuicaoHandler
from backend.handlers.validar_e_calcular_ficha import handler as ValidarECalcularFichaHandler

HANDLERS = {
    "amigo_personagens": AmigoPersonagensHandler,
    "aplicar_recompensas_ascensao": AplicarRecompensasAscensaoHandler,
    "biblioteca": BibliotecaHandler,
    "campanha_participantes": CampanhaParticipantesHandler,
    "excluir_campanha": ExcluirCampanhaHandler,
    "excluir_conta": ExcluirContaHandler,
    "mestre_ajustar_recurso_personagem": MestreAjustarRecursoHandler,
    "mestre_campanha_personagens": MestreCampanhaPersonagensHandler,
    "mestre_remover_da_campanha": MestreRemoverDaCampanhaHandler,
    "responder_ascensao": ResponderAscensaoHandler,
    "responder_redistribuicao_atributos": ResponderRedistribuicaoHandler,
    "solicitar_redistribuicao_atributos": SolicitarRedistribuicaoHandler,
    "validar_e_calcular_ficha": ValidarECalcularFichaHandler,
}


class handler(BaseHTTPRequestHandler):
    def _encaminhar(self, metodo):
        parametros = parse_qs(urlparse(self.path).query)
        endpoint = (parametros.get("endpoint") or [None])[0]
        classe = HANDLERS.get(endpoint)
        if classe is None:
            self._responder(404, {"sucesso": False, "erros": ["Endpoint não encontrado."]})
            return

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
        # Serializa ANTES de começar a resposta HTTP. Se algum dado vindo do
        # Firestore não puder ser convertido em JSON, o handler conseguirá
        # devolver um único erro 500 válido, em vez de enviar 200 e 500 na
        # mesma conexão (o que fazia o navegador falhar ao ler o JSON).
        corpo = json.dumps(resposta, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(corpo)
