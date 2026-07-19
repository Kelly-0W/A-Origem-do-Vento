from http.server import BaseHTTPRequestHandler
import json

from firebase_admin import auth as admin_auth

from api.motor.persistencia import (
    listar_personagens_do_dono,
    listar_campanhas_como_mestre,
    listar_campanhas_como_jogador,
    listar_personagens_da_campanha,
    remover_campanha_de_personagem,
    remover_jogador_da_campanha,
    excluir_personagem,
    excluir_campanha,
    excluir_doc_usuario,
)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """
        POST /api/excluir_conta
        Corpo: { "uid": "uid de quem esta se excluindo" }

        O frontend já reautenticou a pessoa (senha ou popup do Google) ANTES
        de chamar isso -- essa checagem de "login recente" é feita com o
        Firebase Auth client-side (reauthenticateWithCredential/Popup); este
        endpoint em si roda com credencial de servidor e não pede senha de
        novo, então a confirmação de identidade tem que já ter acontecido
        no navegador.

        Cascata, nessa ordem:
        1. Campanhas onde esta pessoa é MESTRE: pra cada uma, tira essa
           campanha de campanhas_ids de todo personagem vinculado a ela
           (de qualquer dono -- os jogadores são "expulsos", mas continuam
           com o personagem deles) e então apaga a campanha.
        2. Campanhas onde esta pessoa é só JOGADOR: remove o próprio uid
           de jogadores_uids (a campanha continua existindo pro mestre e
           pros outros jogadores).
        3. Personagens de que esta pessoa é dona: apaga todos.
        4. Documento usuarios/{uid}.
        5. A conta em si no Firebase Auth (admin_auth.delete_user) -- só
           o Admin SDK consegue fazer isso sem re-pedir senha de novo.
        """
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            corpo = json.loads(self.rfile.read(content_length) or b"{}")
            uid = corpo.get("uid")

            if not uid:
                self._responder(400, {"sucesso": False, "erros": ["'uid' e obrigatorio."]})
                return

            # 1. Campanhas mestradas por essa pessoa: expulsa todo mundo e apaga a campanha.
            for campanha in listar_campanhas_como_mestre(uid):
                for personagem in listar_personagens_da_campanha(campanha["id"]):
                    remover_campanha_de_personagem(personagem["id"], campanha["id"])
                excluir_campanha(campanha["id"])

            # 2. Campanhas onde essa pessoa é só jogadora: sai delas.
            for campanha in listar_campanhas_como_jogador(uid):
                remover_jogador_da_campanha(campanha["id"], uid)

            # 3. Os próprios personagens.
            for personagem in listar_personagens_do_dono(uid):
                excluir_personagem(personagem["id"])

            # 4. Perfil.
            excluir_doc_usuario(uid)

            # 5. A conta em si.
            try:
                admin_auth.delete_user(uid)
            except admin_auth.UserNotFoundError:
                # Já não existia no Auth (ex.: excluída antes, retry do
                # cliente) -- os dados do Firestore já foram limpos acima,
                # então isso não é motivo pra reportar erro.
                pass

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
