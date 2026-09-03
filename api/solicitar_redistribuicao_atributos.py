from http.server import BaseHTTPRequestHandler
import json

from firebase_admin import firestore

from api.motor.atributos import validar_distribuicao_atributos
from api.motor.persistencia import buscar_personagem, atualizar_personagem


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """
        POST /api/solicitar_redistribuicao_atributos
        Corpo: {
          "personagem_id": "...",
          "dono_uid": "uid de quem esta pedindo (precisa ser o dono)",
          "atributos_propostos": {"for": 0, "des": 2, "con": 3, "int": 1, "sab": 2, "car": 2},
          "motivo": "texto livre opcional explicando o pedido pro Mestre"
        }

        Valida a proposta com a MESMA regra da criacao de personagem (soma
        exata de 10 pontos, cada atributo entre -1 e 3 -- ver
        api/motor/atributos.py) ANTES de salvar, pra dar feedback imediato
        ao jogador em vez de deixar a validacao so' pra hora do Mestre
        aprovar. Isto so' GRAVA o pedido como pendente
        (redistribuicao_atributos_em_progresso.status = "aguardando_mestre")
        -- quem de fato aplica a nova distribuicao e recalcula a ficha e'
        /api/responder_redistribuicao_atributos, quando o Mestre aprova.

        Sobrescrever um pedido anterior e' permitido quando ele NAO estiver
        mais "aguardando_mestre" (ou seja: nunca pediu, ou o pedido
        anterior ja foi recusado) -- assim o jogador pode ajustar e
        reenviar depois de uma recusa, mas nao pode "atropelar" um pedido
        que o Mestre ainda nao respondeu.
        """
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            corpo = json.loads(self.rfile.read(content_length) or b"{}")

            personagem_id = corpo.get("personagem_id")
            dono_uid = corpo.get("dono_uid")
            atributos_propostos = corpo.get("atributos_propostos")
            motivo = (corpo.get("motivo") or "").strip()

            if not personagem_id or not dono_uid or not isinstance(atributos_propostos, dict):
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["'personagem_id', 'dono_uid' e 'atributos_propostos' sao obrigatorios."],
                })
                return

            personagem = buscar_personagem(personagem_id)
            if personagem is None:
                self._responder(404, {"sucesso": False, "erros": ["Personagem nao encontrado."]})
                return
            if personagem.get("dono_uid") != dono_uid:
                self._responder(403, {
                    "sucesso": False,
                    "erros": ["Somente o dono deste personagem pode solicitar redistribuir atributos."],
                })
                return

            pedido_atual = personagem.get("redistribuicao_atributos_em_progresso") or {}
            if pedido_atual.get("status") == "aguardando_mestre":
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["Ja existe um pedido de redistribuicao aguardando resposta do Mestre."],
                })
                return

            valido, erros = validar_distribuicao_atributos(atributos_propostos)
            if not valido:
                self._responder(400, {"sucesso": False, "erros": erros})
                return

            atualizar_personagem(personagem_id, {
                "redistribuicao_atributos_em_progresso": {
                    "status": "aguardando_mestre",
                    "atributos_propostos": atributos_propostos,
                    "motivo": motivo,
                    "solicitado_em": firestore.SERVER_TIMESTAMP,
                    "respondido_por_uid": None,
                    "respondido_em": None,
                },
                "atualizado_em": firestore.SERVER_TIMESTAMP,
            })
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
