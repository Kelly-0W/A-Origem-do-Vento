from http.server import BaseHTTPRequestHandler
import json

# Import relativo ao pacote "api" (e assim que o Vercel Python Functions
# resolve os modulos quando o handler fica em api/*.py e importa de api/motor/).
from api.motor.ficha import calcular_ficha
from api.motor.persistencia import salvar_ficha_calculada
from api.motor.catalogo import carregar_catalogo


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """
        Espera um corpo JSON no formato:
            {
              "escolhas": { ...ver docs/schema-banco-dados-personagem.md... },
              "grau_ascensao": 0,
              "dono_uid": "uid-do-usuario-autenticado",   // opcional
              "personagem_id": "id-do-documento-existente", // opcional, so' para ATUALIZAR
              "campanha_id": "id-da-campanha"              // opcional, so' na CRIACAO
            }
        (aceita tambem o objeto de escolhas direto na raiz, sem a chave
        "escolhas", para facilitar testes rapidos).

        Quando o calculo tem sucesso, a ficha e' salva automaticamente no
        Firestore (colecao `personagens`), com escolhas + calculado +
        criado_em/atualizado_em. Se a gravacao falhar (ex: variavel de
        ambiente da credencial nao configurada), a resposta AINDA retorna
        200 com a ficha calculada -- so' marca "ficha_salva": false e
        inclui o motivo em "aviso", porque o calculo em si funcionou; nao
        faz sentido derrubar a resposta inteira por causa da persistencia.
        """
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            corpo = json.loads(post_data)

            escolhas = corpo.get("escolhas", corpo)
            grau_ascensao = corpo.get("grau_ascensao", 0)
            dono_uid = corpo.get("dono_uid")
            personagem_id = corpo.get("personagem_id")
            campanha_id = corpo.get("campanha_id")

            catalogo = carregar_catalogo()
            sucesso, resultado = calcular_ficha(escolhas, catalogo, grau_ascensao=grau_ascensao)

            if sucesso:
                resposta = {"sucesso": True, **resultado}
                status_code = 200

                try:
                    id_salvo = salvar_ficha_calculada(
                        escolhas=escolhas,
                        calculado=resultado["calculado"],
                        dono_uid=dono_uid,
                        personagem_id=personagem_id,
                        campanha_id=campanha_id,
                    )
                    resposta["ficha_salva"] = True
                    resposta["personagem_id"] = id_salvo
                except Exception as erro_persistencia:
                    resposta["ficha_salva"] = False
                    resposta["aviso"] = f"Ficha calculada, mas nao foi salva: {erro_persistencia}"
            else:
                resposta = {"sucesso": False, "erros": resultado["erros"]}
                status_code = 400

        except Exception as e:
            resposta = {"sucesso": False, "erros": [f"Erro interno no servidor: {str(e)}"]}
            status_code = 500

        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        # Permite que o frontend (outro dominio, em dev) acesse essa funcao (CORS)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(resposta, ensure_ascii=False).encode('utf-8'))

    def do_OPTIONS(self):
        """Resposta ao preflight de CORS que o navegador manda antes do POST real."""
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
