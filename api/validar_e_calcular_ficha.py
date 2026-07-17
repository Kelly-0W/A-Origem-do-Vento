from http.server import BaseHTTPRequestHandler
import json
import os

# Import relativo ao pacote "api" (e assim que o Vercel Python Functions
# resolve os modulos quando o handler fica em api/*.py e importa de api/motor/).
from api.motor.ficha import calcular_ficha

PASTA_DADOS = os.path.join(os.path.dirname(__file__), "..", "seed", "dados")


def carregar_catalogo():
    """
    Carrega o catalogo de regras a partir dos JSONs em seed/dados/.

    NOTA: isso le os arquivos locais empacotados no deploy da Vercel, NAO
    o Firestore. E uma solucao valida por enquanto (o catalogo muda pouco,
    e assim fica rapido e sem custo de leitura no Firestore a cada
    requisicao), mas se no futuro o catalogo passar a ser editado direto
    no Firestore (fora do Git), essa funcao precisa trocar para ler de la
    via Firebase Admin SDK.
    """
    def ler(nome):
        caminho = os.path.join(PASTA_DADOS, nome)
        with open(caminho, encoding="utf-8") as f:
            return json.load(f)

    return {
        "racas": ler("racas.json"),
        "classes": ler("classes.json"),
        "origens": ler("origens.json"),
        "pericias": ler("pericias.json"),
        "elementos": ler("elementos.json"),
        "itens": ler("itens.json"),
        "constantes_ascensao": ler("constantes_ascensao.json"),
    }


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """
        Espera um corpo JSON no formato:
            {
              "escolhas": { ...ver docs/schema-banco-dados-personagem.md... },
              "grau_ascensao": 0
            }
        (aceita tambem o objeto de escolhas direto na raiz, sem a chave
        "escolhas", para facilitar testes rapidos).
        """
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            corpo = json.loads(post_data)

            escolhas = corpo.get("escolhas", corpo)
            grau_ascensao = corpo.get("grau_ascensao", 0)

            catalogo = carregar_catalogo()
            sucesso, resultado = calcular_ficha(escolhas, catalogo, grau_ascensao=grau_ascensao)

            if sucesso:
                resposta = {"sucesso": True, **resultado}
                status_code = 200
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
