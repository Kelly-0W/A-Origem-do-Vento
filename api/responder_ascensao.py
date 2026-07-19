from http.server import BaseHTTPRequestHandler
import json

from firebase_admin import firestore

from api.motor.persistencia import (
    buscar_campanha,
    buscar_personagem,
    atualizar_personagem,
)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """
        POST /api/responder_ascensao
        Corpo: {
          "mestre_uid": "uid de quem esta aprovando/recusando",
          "campanha_id": "id da campanha (confirma que o mestre e dessa mesa)",
          "personagem_id": "id do personagem com o pedido pendente",
          "aprovar": true | false
        }

        Aprovar: NAO recalcula a ficha aqui -- so' muda
        ascensao_em_progresso.status para "aguardando_recompensas", que
        libera o DONO do personagem para escolher as recompensas do grau
        (habilidade(s) de raca/classe -- ver constantes_ascensao.json;
        "Treinamento de Pericia" nao precisa de escolha formal aqui porque
        ja existe o toggle livre de pericia direto na ficha, ver
        pericias_manuais em motor/pericias.py). E' so' depois que o dono
        escolhe e chama /api/aplicar_recompensas_ascensao que a ficha e'
        de fato recalculada e o grau_ascensao avanca.

        Recusar: marca ascensao_em_progresso.status = "recusada" (mantem
        os 3 booleans como estavam, pra o jogador ver o que foi julgado),
        sem tocar em grau_ascensao/calculado.

        So o mestre_id de fato dessa campanha pode chamar isto -- checado
        aqui com o Admin SDK, nao pelas Firestore Rules (ver comentario em
        api/mestre_campanha_personagens.py sobre por que essa checagem nao
        da pra fazer só com Rules).
        """
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            corpo = json.loads(self.rfile.read(content_length) or b"{}")

            mestre_uid = corpo.get("mestre_uid")
            campanha_id = corpo.get("campanha_id")
            personagem_id = corpo.get("personagem_id")
            aprovar = bool(corpo.get("aprovar"))

            if not all([mestre_uid, campanha_id, personagem_id]):
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["'mestre_uid', 'campanha_id' e 'personagem_id' sao obrigatorios."],
                })
                return

            campanha = buscar_campanha(campanha_id)
            if campanha is None:
                self._responder(404, {"sucesso": False, "erros": ["Campanha nao encontrada."]})
                return
            if campanha.get("mestre_id") != mestre_uid:
                self._responder(403, {
                    "sucesso": False,
                    "erros": ["Somente o mestre desta campanha pode responder a esta Ascensao."],
                })
                return

            personagem = buscar_personagem(personagem_id)
            if personagem is None:
                self._responder(404, {"sucesso": False, "erros": ["Personagem nao encontrado."]})
                return
            if campanha_id not in (personagem.get("campanhas_ids") or []):
                self._responder(403, {
                    "sucesso": False,
                    "erros": ["Este personagem nao pertence a essa campanha."],
                })
                return

            ascensao = personagem.get("ascensao_em_progresso") or {}
            if ascensao.get("status") != "aguardando_mestre":
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["Este personagem nao tem nenhum pedido de Ascensao aguardando resposta."],
                })
                return

            if not aprovar:
                atualizar_personagem(personagem_id, {
                    "ascensao_em_progresso": {
                        **ascensao,
                        "status": "recusada",
                        "respondido_por_uid": mestre_uid,
                        "respondido_em": firestore.SERVER_TIMESTAMP,
                    },
                    "atualizado_em": firestore.SERVER_TIMESTAMP,
                })
                self._responder(200, {"sucesso": True, "aprovado": False})
                return

            atualizar_personagem(personagem_id, {
                "ascensao_em_progresso": {
                    **ascensao,
                    "status": "aguardando_recompensas",
                    "respondido_por_uid": mestre_uid,
                    "respondido_em": firestore.SERVER_TIMESTAMP,
                },
                "atualizado_em": firestore.SERVER_TIMESTAMP,
            })
            self._responder(200, {"sucesso": True, "aprovado": True, "status": "aguardando_recompensas"})

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
