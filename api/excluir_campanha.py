from http.server import BaseHTTPRequestHandler
import json

from api.motor.persistencia import (
    buscar_campanha,
    listar_personagens_da_campanha,
    remover_campanha_de_personagem,
    excluir_campanha,
)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """
        POST /api/excluir_campanha
        Corpo: { "mestre_uid": "...", "campanha_id": "..." }

        Mesma cascata usada em excluir_conta.py pra campanhas mestradas,
        só que disparada aqui por escolha do mestre (apagar só a mesa),
        não como consequência de apagar a conta inteira: desvincula
        (arrayRemove) essa campanha de campanhas_ids de TODO personagem
        ligado a ela -- de qualquer dono, os personagens continuam
        existindo -- e só então apaga o documento da campanha.

        O motivo de isso passar por aqui (Admin SDK) e não ser feito
        direto no cliente: mesmo com `allow delete` liberado pro mestre
        nas Rules, ele não tem permissão de escrever em personagens que
        não são dele -- e desvincular a campanha desses personagens é
        exatamente isso.
        """
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            corpo = json.loads(self.rfile.read(content_length) or b"{}")
            mestre_uid = corpo.get("mestre_uid")
            campanha_id = corpo.get("campanha_id")

            if not mestre_uid or not campanha_id:
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["'mestre_uid' e 'campanha_id' sao obrigatorios."],
                })
                return

            campanha = buscar_campanha(campanha_id)
            if campanha is None:
                self._responder(404, {"sucesso": False, "erros": ["Campanha nao encontrada."]})
                return
            if campanha.get("mestre_id") != mestre_uid:
                self._responder(403, {
                    "sucesso": False,
                    "erros": ["Somente o mestre desta campanha pode apaga-la."],
                })
                return

            for personagem in listar_personagens_da_campanha(campanha_id):
                remover_campanha_de_personagem(personagem["id"], campanha_id)

            excluir_campanha(campanha_id)

            self._responder(200, {"sucesso": True})

        except Exception as e:
            self._responder(500, {"sucesso": False, "erros": [f"Erro interno no servidor: {str(e)}"]})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _responder(self, status_code, resposta):
        self.send_response(status_code)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(resposta, ensure_ascii=False, default=str).encode("utf-8"))
