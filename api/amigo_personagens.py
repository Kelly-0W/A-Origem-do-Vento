from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json

from api.motor.persistencia import existe_amizade_aceita, listar_personagens_visiveis_do_dono


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """
        GET /api/amigo_personagens?amigo_uid=X&uid=Y

        Devolve os personagens de `amigo_uid` marcados como visiveis --
        SE `uid` e `amigo_uid` tiverem uma amizade aceita entre si.

        Existe porque a checagem de amizade depende de outro documento (a
        colecao `amizades`), e uma consulta em LISTA no Firestore nao
        consegue provar essa condicao so olhando os filtros da query --
        Firestore recusa a lista inteira nesse caso. Abrir UM personagem
        ja visivel funciona direto pelas Rules (ver PersonagemDetalhe.jsx,
        que faz um get() de documento unico, nao uma lista); a LISTAGEM
        de varios precisa passar por aqui, com o Admin SDK.
        """
        try:
            parametros = parse_qs(urlparse(self.path).query)
            amigo_uid = (parametros.get("amigo_uid") or [None])[0]
            uid = (parametros.get("uid") or [None])[0]

            if not amigo_uid or not uid:
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["Parametros 'amigo_uid' e 'uid' sao obrigatorios."],
                })
                return

            if not existe_amizade_aceita(uid, amigo_uid):
                self._responder(403, {
                    "sucesso": False,
                    "erros": ["Voce nao tem uma amizade aceita com essa pessoa."],
                })
                return

            personagens = listar_personagens_visiveis_do_dono(amigo_uid)

            itens = []
            for p in personagens:
                escolhas = p.get("escolhas") or {}
                itens.append({
                    "id": p["id"],
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
