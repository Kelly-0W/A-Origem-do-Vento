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
        GET /api/mestre_campanha_personagens?campanha_id=X&mestre_uid=Y

        Devolve todos os personagens vinculados à campanha `campanha_id`
        (de qualquer dono), pra alimentar o Painel do Mestre: a lista
        completa da mesa + os pedidos de Ascensão pendentes em destaque.

        So funciona se `mestre_uid` for de fato o mestre_id dessa
        campanha -- é essa checagem (feita aqui, com o Admin SDK, que
        ignora as Firestore Rules) que garante que só o mestre vê as
        fichas de personagens que não são dele. As Rules do cliente não
        conseguem expressar essa checagem sozinhas (teriam que percorrer
        um array de ids de campanha fazendo um `get()` por item, o que o
        Firestore Rules não suporta) -- por isso esse acesso passa por
        aqui, com uma credencial de servidor, em vez de leitura direta.
        """
        try:
            query = parse_qs(urlparse(self.path).query)
            campanha_id = (query.get("campanha_id") or [None])[0]
            mestre_uid = (query.get("mestre_uid") or [None])[0]

            if not campanha_id or not mestre_uid:
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["Parametros 'campanha_id' e 'mestre_uid' sao obrigatorios."],
                })
                return

            campanha = buscar_campanha(campanha_id)
            if campanha is None:
                self._responder(404, {"sucesso": False, "erros": ["Campanha nao encontrada."]})
                return

            if campanha.get("mestre_id") != mestre_uid:
                self._responder(403, {
                    "sucesso": False,
                    "erros": ["Somente o mestre desta campanha pode ver os personagens da mesa."],
                })
                return

            personagens = listar_personagens_da_campanha(campanha_id)
            nomes_uid = buscar_nomes_usuarios(p.get("dono_uid") for p in personagens)

            itens = []
            for p in personagens:
                itens.append({
                    "id": p["id"],
                    "dono_uid": p.get("dono_uid"),
                    "dono_nome": nomes_uid.get(p.get("dono_uid")),
                    "nome_personagem": (p.get("escolhas") or {}).get("nome_personagem"),
                    "imagem_base64": p.get("imagem_base64"),
                    "escolhas": p.get("escolhas"),
                    "calculado": p.get("calculado"),
                    "grau_ascensao": p.get("grau_ascensao", 0),
                    "ascensao_em_progresso": p.get("ascensao_em_progresso"),
                    # Estado de jogo (ver FichaVisual.jsx) -- útil pro mestre
                    # acompanhar vida/sanidade/arché atuais da mesa sem
                    # precisar perguntar. Só leitura aqui: quem edita é
                    # sempre o próprio dono, na tela do personagem.
                    "vida_atual": p.get("vida_atual"),
                    "sanidade_atual": p.get("sanidade_atual"),
                    "arche_atual": p.get("arche_atual"),
                    "bonus_defesa": p.get("bonus_defesa"),
                    "bonus_deslocamento": p.get("bonus_deslocamento"),
                })

            self._responder(200, {"sucesso": True, "campanha": {"id": campanha["id"], "nome": campanha.get("nome")}, "itens": itens})

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
