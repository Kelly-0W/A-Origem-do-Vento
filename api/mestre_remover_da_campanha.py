from http.server import BaseHTTPRequestHandler
import json

from firebase_admin import auth

from api.motor.persistencia import (
    obter_cliente_firestore,
    buscar_campanha,
    buscar_personagem,
    listar_personagens_da_campanha,
    remover_campanha_de_personagem,
    remover_jogador_da_campanha,
)


class handler(BaseHTTPRequestHandler):
    """Remove vínculos de uma mesa, sempre a pedido do mestre autenticado."""

    def do_POST(self):
        try:
            token = self.headers.get("Authorization", "").removeprefix("Bearer ").strip()
            if not token:
                self._responder(401, {"sucesso": False, "erros": ["Faça login novamente para gerenciar a mesa."]})
                return

            # Garante que o Admin SDK foi inicializado com a credencial do
            # servidor antes de validar o token recebido do navegador.
            obter_cliente_firestore()
            mestre_autenticado = auth.verify_id_token(token).get("uid")
            tamanho = int(self.headers.get("Content-Length", 0))
            corpo = json.loads(self.rfile.read(tamanho) or b"{}")
            campanha_id = corpo.get("campanha_id")
            acao = corpo.get("acao")

            if not campanha_id or acao not in {"jogador", "personagem"}:
                self._responder(400, {"sucesso": False, "erros": ["'campanha_id' e uma ação válida são obrigatórios."]})
                return

            campanha = buscar_campanha(campanha_id)
            if campanha is None:
                self._responder(404, {"sucesso": False, "erros": ["Campanha não encontrada."]})
                return
            if campanha.get("mestre_id") != mestre_autenticado:
                self._responder(403, {"sucesso": False, "erros": ["Somente o mestre desta campanha pode remover participantes."]})
                return

            if acao == "personagem":
                personagem_id = corpo.get("personagem_id")
                personagem = buscar_personagem(personagem_id) if personagem_id else None
                if personagem is None:
                    self._responder(404, {"sucesso": False, "erros": ["Personagem não encontrado."]})
                    return
                if campanha_id not in (personagem.get("campanhas_ids") or []):
                    self._responder(400, {"sucesso": False, "erros": ["Esse personagem não faz parte desta campanha."]})
                    return

                remover_campanha_de_personagem(personagem_id, campanha_id)
                self._responder(200, {"sucesso": True, "acao": "personagem"})
                return

            jogador_uid = corpo.get("jogador_uid")
            if not jogador_uid:
                self._responder(400, {"sucesso": False, "erros": ["'jogador_uid' é obrigatório."]})
                return
            if jogador_uid == mestre_autenticado:
                self._responder(400, {"sucesso": False, "erros": ["O mestre não pode remover a si mesmo da campanha."]})
                return
            if jogador_uid not in (campanha.get("jogadores_uids") or []):
                self._responder(400, {"sucesso": False, "erros": ["Essa pessoa não faz parte da campanha."]})
                return

            # Expulsar uma pessoa também desvincula todos os seus personagens
            # desta mesa, sem apagar nenhuma ficha.
            for personagem in listar_personagens_da_campanha(campanha_id):
                if personagem.get("dono_uid") == jogador_uid:
                    remover_campanha_de_personagem(personagem["id"], campanha_id)
            remover_jogador_da_campanha(campanha_id, jogador_uid)
            self._responder(200, {"sucesso": True, "acao": "jogador"})

        except auth.InvalidIdTokenError:
            self._responder(401, {"sucesso": False, "erros": ["Sua sessão expirou. Entre novamente."]})
        except Exception as e:
            self._responder(500, {"sucesso": False, "erros": [f"Erro interno no servidor: {str(e)}"]})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def _responder(self, status_code, resposta):
        self.send_response(status_code)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(resposta, ensure_ascii=False, default=str).encode("utf-8"))
