from http.server import BaseHTTPRequestHandler
import json

from firebase_admin import firestore

from api.motor.catalogo import carregar_catalogo
from api.motor.ficha import calcular_ficha
from api.motor.persistencia import buscar_campanha, buscar_personagem, atualizar_personagem


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """
        POST /api/responder_redistribuicao_atributos
        Corpo: {
          "mestre_uid": "uid de quem esta aprovando/recusando",
          "campanha_id": "id da campanha (confirma que o mestre e dessa mesa)",
          "personagem_id": "id do personagem com o pedido pendente",
          "aprovar": true | false
        }

        Diferente da Ascensao (que tem uma etapa extra de "escolher
        recompensas" depois da aprovacao), redistribuir atributos nao tem
        mais nenhuma escolha pendente depois do aprovar -- a proposta
        inteira ja' veio pronta no pedido (ver
        /api/solicitar_redistribuicao_atributos). Por isso aprovar aqui
        JA' aplica a nova distribuicao em escolhas["atributos"] e
        recalcula a ficha inteira (atributos_finais, status, pericias --
        tudo que depende de atributo), na mesma passada.

        Recusar: marca redistribuicao_atributos_em_progresso.status =
        "recusada" (mantem os atributos_propostos, pra o jogador ver o
        que foi julgado e poder reenviar ajustado), sem tocar em
        escolhas/calculado.

        So o mestre_id de fato dessa campanha pode chamar isto -- checado
        aqui com o Admin SDK, nao pelas Firestore Rules (mesmo motivo
        documentado em api/mestre_campanha_personagens.py).
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
                    "erros": ["Somente o mestre desta campanha pode responder a este pedido."],
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

            pedido = personagem.get("redistribuicao_atributos_em_progresso") or {}
            if pedido.get("status") != "aguardando_mestre":
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["Este personagem nao tem nenhum pedido de redistribuicao aguardando resposta."],
                })
                return

            if not aprovar:
                atualizar_personagem(personagem_id, {
                    "redistribuicao_atributos_em_progresso": {
                        **pedido,
                        "status": "recusada",
                        "respondido_por_uid": mestre_uid,
                        "respondido_em": firestore.SERVER_TIMESTAMP,
                    },
                    "atualizado_em": firestore.SERVER_TIMESTAMP,
                })
                self._responder(200, {"sucesso": True, "aprovado": False})
                return

            escolhas_atualizadas = dict(personagem.get("escolhas") or {})
            escolhas_atualizadas["atributos"] = pedido["atributos_propostos"]

            catalogo = carregar_catalogo()
            sucesso, resultado = calcular_ficha(
                escolhas_atualizadas, catalogo, grau_ascensao=personagem.get("grau_ascensao", 0)
            )
            if not sucesso:
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["Nao foi possivel recalcular a ficha com esses atributos."] + resultado.get("erros", []),
                })
                return

            atualizar_personagem(personagem_id, {
                "escolhas": escolhas_atualizadas,
                "calculado": resultado["calculado"],
                "redistribuicao_atributos_em_progresso": {
                    "status": "nenhuma",
                    "atributos_propostos": None,
                    "motivo": "",
                    "solicitado_em": None,
                    "respondido_por_uid": mestre_uid,
                    "respondido_em": firestore.SERVER_TIMESTAMP,
                },
                "atualizado_em": firestore.SERVER_TIMESTAMP,
            })

            self._responder(200, {
                "sucesso": True,
                "aprovado": True,
                "escolhas": escolhas_atualizadas,
                "calculado": resultado["calculado"],
            })

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
