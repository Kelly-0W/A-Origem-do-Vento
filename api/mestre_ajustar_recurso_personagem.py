from http.server import BaseHTTPRequestHandler
import json

from api.motor.persistencia import (
    buscar_campanha,
    buscar_personagem,
    ajustar_recurso_personagem,
    CAMPOS_RECURSO_PERMITIDOS,
)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """
        POST /api/mestre_ajustar_recurso_personagem
        body: {"personagem_id": str, "mestre_uid": str, "campo": str, "novo_valor": number}

        Deixa o Mestre ajustar vida/sanidade/arché atuais (ou bônus de
        defesa/deslocamento) de um personagem de outro dono -- DESDE QUE
        esse personagem esteja numa campanha onde `mestre_uid` é de fato o
        mestre_id (checado aqui, com o Admin SDK, que ignora as Firestore
        Rules -- mesmo motivo de mestre_campanha_personagens.py). Usado só
        pelo rastreador de Combate (ver Combate.jsx). Fora daqui, essa
        edição continua sendo sempre exclusiva do próprio dono; ver o
        comentário em persistencia.ajustar_recurso_personagem.
        """
        try:
            tamanho = int(self.headers.get("Content-Length", 0))
            corpo = json.loads(self.rfile.read(tamanho) or b"{}")

            personagem_id = corpo.get("personagem_id")
            mestre_uid = corpo.get("mestre_uid")
            campo = corpo.get("campo")
            novo_valor = corpo.get("novo_valor")

            if not personagem_id or not mestre_uid or not campo or novo_valor is None:
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["'personagem_id', 'mestre_uid', 'campo' e 'novo_valor' sao obrigatorios."],
                })
                return

            if campo not in CAMPOS_RECURSO_PERMITIDOS:
                self._responder(400, {
                    "sucesso": False,
                    "erros": [f"Campo '{campo}' nao pode ser ajustado por aqui."],
                })
                return

            if not isinstance(novo_valor, (int, float)):
                self._responder(400, {"sucesso": False, "erros": ["'novo_valor' deve ser numerico."]})
                return

            personagem = buscar_personagem(personagem_id)
            if personagem is None:
                self._responder(404, {"sucesso": False, "erros": ["Personagem nao encontrado."]})
                return

            campanhas_ids = personagem.get("campanhas_ids") or []
            autorizado = any(
                (buscar_campanha(cid) or {}).get("mestre_id") == mestre_uid
                for cid in campanhas_ids
            )
            if not autorizado:
                self._responder(403, {
                    "sucesso": False,
                    "erros": ["Voce so pode ajustar personagens de campanhas que voce mestra."],
                })
                return

            ajustar_recurso_personagem(personagem_id, campo, novo_valor)
            self._responder(200, {"sucesso": True, "campo": campo, "novo_valor": novo_valor})

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
