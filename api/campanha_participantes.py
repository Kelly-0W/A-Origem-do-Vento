from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json

from api.motor.persistencia import (
    buscar_campanha,
    listar_personagens_da_campanha,
    buscar_nomes_usuarios,
)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """
        GET /api/campanha_participantes?campanha_id=X&uid=Y

        Devolve um resumo LEVE de todos os personagens vinculados à
        campanha `campanha_id` (de qualquer dono) -- só o suficiente pra
        montar um "quem está na mesa": nome do personagem, retrato, raça,
        classe e nome de quem joga. NÃO inclui `calculado` nem `escolhas`
        completos, nem estado de jogo (vida/sanidade/arché atuais) -- a
        ficha inteira continua exclusiva do próprio dono (tela do
        personagem) ou do Mestre (Painel do Mestre, ver
        api/mestre_campanha_personagens.py). Este endpoint existe
        justamente pra dar o "quem está participando" pro jogador comum
        SEM abrir a ficha completa dos outros -- por isso filtra os campos
        aqui no servidor, e não só esconde um botão no frontend.

        Funciona pra qualquer MEMBRO da campanha (mestre OU jogador) --
        diferente do endpoint do mestre, que só ele pode chamar.
        """
        try:
            query = parse_qs(urlparse(self.path).query)
            campanha_id = (query.get("campanha_id") or [None])[0]
            uid = (query.get("uid") or [None])[0]

            if not campanha_id or not uid:
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["Parametros 'campanha_id' e 'uid' sao obrigatorios."],
                })
                return

            campanha = buscar_campanha(campanha_id)
            if campanha is None:
                self._responder(404, {"sucesso": False, "erros": ["Campanha nao encontrada."]})
                return

            eh_membro = campanha.get("mestre_id") == uid or uid in (campanha.get("jogadores_uids") or [])
            if not eh_membro:
                self._responder(403, {
                    "sucesso": False,
                    "erros": ["Voce nao faz parte dessa campanha."],
                })
                return

            personagens = listar_personagens_da_campanha(campanha_id)
            nomes_uid = buscar_nomes_usuarios(p.get("dono_uid") for p in personagens)

            itens = []
            for p in personagens:
                escolhas = p.get("escolhas") or {}
                itens.append({
                    "id": p["id"],
                    "dono_uid": p.get("dono_uid"),
                    "dono_nome": nomes_uid.get(p.get("dono_uid")),
                    "nome_personagem": escolhas.get("nome_personagem"),
                    "imagem_base64": p.get("imagem_base64"),
                    "raca_id": escolhas.get("raca_id"),
                    "classe_id": escolhas.get("classe_id"),
                })

            self._responder(200, {"sucesso": True, "itens": itens})

        except Exception as e:
            self._responder(500, {"sucesso": False, "erros": [f"Erro interno no servidor: {str(e)}"]})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _responder(self, status_code, resposta):
        self.send_response(status_code)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(resposta, ensure_ascii=False, default=str).encode("utf-8"))
