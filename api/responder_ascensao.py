from http.server import BaseHTTPRequestHandler
import json

from firebase_admin import firestore

from api.motor.catalogo import carregar_catalogo
from api.motor.ficha import calcular_ficha
from api.motor.persistencia import (
    buscar_campanha,
    buscar_personagem,
    atualizar_personagem,
)


def _ascensao_zerada(respondido_por_uid):
    """Estado 'de repouso' de ascensao_em_progresso, pronto pro próximo
    ciclo (usado tanto ao aprovar quanto, futuramente, se o jogador quiser
    recomeçar depois de uma recusa)."""
    return {
        "grau_alvo": None,
        "catalisador": False,
        "provacao": False,
        "ritual": False,
        "descricao_manifestacao": "",
        "status": "nenhuma",
        "respondido_por_uid": respondido_por_uid,
        "respondido_em": firestore.SERVER_TIMESTAMP,
    }


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

        Aprovar: recalcula a ficha no grau_alvo (via o mesmo motor Python
        usado na criacao), grava grau_ascensao + calculado + uma entrada
        nova em `manifestacoes`, e zera ascensao_em_progresso pro proximo
        ciclo. Recusar: so marca ascensao_em_progresso.status = "recusada"
        (mantem os 3 booleans como estavam, pra o jogador ver o que foi
        julgado), sem tocar em grau_ascensao/calculado.

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
                        "status": "recusada",
                        "respondido_por_uid": mestre_uid,
                        "respondido_em": firestore.SERVER_TIMESTAMP,
                    },
                    "atualizado_em": firestore.SERVER_TIMESTAMP,
                })
                self._responder(200, {"sucesso": True, "aprovado": False})
                return

            grau_alvo = ascensao.get("grau_alvo")
            if not isinstance(grau_alvo, int):
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["'grau_alvo' invalido no pedido de Ascensao deste personagem."],
                })
                return

            catalogo = carregar_catalogo()
            sucesso, resultado = calcular_ficha(
                personagem.get("escolhas", {}), catalogo, grau_ascensao=grau_alvo
            )
            if not sucesso:
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["Nao foi possivel recalcular a ficha para aprovar a Ascensao."] + resultado.get("erros", []),
                })
                return

            nova_manifestacao = {
                "grau": grau_alvo,
                "descricao": ascensao.get("descricao_manifestacao") or "",
                "imagem_url": None,
            }
            manifestacoes = list(personagem.get("manifestacoes") or []) + [nova_manifestacao]

            atualizar_personagem(personagem_id, {
                "grau_ascensao": grau_alvo,
                "calculado": resultado["calculado"],
                "manifestacoes": manifestacoes,
                "ascensao_em_progresso": _ascensao_zerada(mestre_uid),
                "atualizado_em": firestore.SERVER_TIMESTAMP,
            })

            self._responder(200, {
                "sucesso": True,
                "aprovado": True,
                "grau_ascensao": grau_alvo,
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
