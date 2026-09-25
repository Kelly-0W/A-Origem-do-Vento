"""Operações autenticadas de homebrew, executadas pela API Python da Vercel."""
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
import logging

from firebase_admin import auth, firestore

from api.motor.persistencia import obter_cliente_firestore


class ErroAutenticacao(Exception):
    pass


def uid_autenticado(headers):
    valor = headers.get("Authorization", "")
    if not valor.startswith("Bearer ") or not valor[7:].strip():
        raise ErroAutenticacao("Autenticação obrigatória.")
    # Inicializa o Admin SDK com a mesma service account usada pelas
    # outras APIs antes de verificar o token Firebase.
    obter_cliente_firestore()
    try:
        return auth.verify_id_token(valor[7:].strip())["uid"]
    except Exception as erro:
        raise ErroAutenticacao("Token Firebase inválido ou expirado.") from erro


def resposta_json(handler, status, dados):
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
    handler.end_headers()
    handler.wfile.write(json.dumps(dados, ensure_ascii=False, default=str).encode("utf-8"))


def membro(campanha, uid):
    return campanha.get("mestre_id") == uid or uid in (campanha.get("jogadores_uids") or [])


def docs_lista(referencia):
    return [{"id": d.id, **d.to_dict()} for d in referencia.stream()]


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            uid = uid_autenticado(self.headers)
            params = parse_qs(urlparse(self.path).query)
            campanha_id = (params.get("campanha_id") or [None])[0]
            db = obter_cliente_firestore()
            if not campanha_id:
                itens = docs_lista(db.collection("usuarios").document(uid).collection("homebrew"))
                return resposta_json(self, 200, {"sucesso": True, "itens": itens})

            campanha_ref = db.collection("campanhas").document(campanha_id)
            campanha_snap = campanha_ref.get()
            if not campanha_snap.exists:
                return resposta_json(self, 404, {"sucesso": False, "erros": ["Campanha não encontrada."]})
            campanha = campanha_snap.to_dict()
            if not membro(campanha, uid):
                return resposta_json(self, 403, {"sucesso": False, "erros": ["Você não faz parte desta campanha."]})

            eh_mestre = campanha.get("mestre_id") == uid
            aprovados = docs_lista(campanha_ref.collection("approvedHomebrew"))
            biblioteca = []
            if eh_mestre:
                pedidos = docs_lista(campanha_ref.collection("homebrewRequests").where("status", "==", "pendente"))
                for pedido in pedidos:
                    original = db.collection("usuarios").document(pedido["owner_uid"]).collection("homebrew").document(pedido["skill_id"]).get()
                    pedido["conteudo"] = original.to_dict() if original.exists else pedido.get("conteudo")
                for jogador_uid in campanha.get("jogadores_uids", []):
                    criações = docs_lista(db.collection("usuarios").document(jogador_uid).collection("homebrew"))
                    biblioteca.extend({**item, "owner_uid": jogador_uid} for item in criações)
            else:
                pedidos = docs_lista(campanha_ref.collection("homebrewRequests").where("owner_uid", "==", uid))
            return resposta_json(self, 200, {
                "sucesso": True,
                "aprovados": aprovados,
                "pedidos": pedidos,
                "biblioteca_jogadores": biblioteca,
                "eh_mestre": eh_mestre,
            })
        except ErroAutenticacao as erro:
            resposta_json(self, 401, {"sucesso": False, "erros": [str(erro)]})
        except Exception as erro:
            logging.exception("Falha ao consultar conteúdo homebrew")
            resposta_json(self, 500, {"sucesso": False, "erros": ["Não foi possível carregar o conteúdo agora. Tente novamente."]})

    def do_POST(self):
        try:
            uid = uid_autenticado(self.headers)
            try:
                corpo = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            except (ValueError, json.JSONDecodeError):
                return resposta_json(self, 400, {"sucesso": False, "erros": ["Corpo JSON inválido."]})
            if not isinstance(corpo, dict):
                return resposta_json(self, 400, {"sucesso": False, "erros": ["Corpo da solicitação inválido."]})
            db = obter_cliente_firestore()
            acao = corpo.get("acao")

            if acao == "salvar":
                habilidade = corpo.get("habilidade") or {}
                if not isinstance(habilidade, dict) or habilidade.get("tipo") not in ("poder_elemental", "habilidade_personagem"):
                    return resposta_json(self, 400, {"sucesso": False, "erros": ["Tipo de criação inválido."]})
                nome, descricao = habilidade.get("nome"), habilidade.get("descricao")
                if not isinstance(nome, str) or not nome.strip() or len(nome) > 100 or not isinstance(descricao, str) or not descricao.strip() or len(descricao) > 3000:
                    return resposta_json(self, 400, {"sucesso": False, "erros": ["Nome (até 100 caracteres) e descrição (até 3000) são obrigatórios."]})
                permitidos = {"tipo", "nome", "descricao", "efeito", "execucao", "alcance", "pericia", "alvo", "duracao", "custo_arche", "dano", "grau_minimo"}
                salvo = {k: v for k, v in habilidade.items() if k in permitidos}
                for campo in ("custo_arche", "grau_minimo"):
                    valor = salvo.get(campo, 0)
                    if isinstance(valor, bool) or not isinstance(valor, (int, float)) or valor < 0 or valor > 99:
                        return resposta_json(self, 400, {"sucesso": False, "erros": [f"Campo {campo} deve ser um número entre 0 e 99."]})
                dano = salvo.get("dano")
                if dano is not None and not isinstance(dano, dict):
                    return resposta_json(self, 400, {"sucesso": False, "erros": ["Formato de dano inválido."]})
                salvo.update({"criador_uid": uid, "atualizado_em": firestore.SERVER_TIMESTAMP})
                colecao = db.collection("usuarios").document(uid).collection("homebrew")
                skill_id = corpo.get("id")
                referencia = colecao.document(skill_id) if isinstance(skill_id, str) and skill_id and "/" not in skill_id else None
                if skill_id and referencia is None:
                    return resposta_json(self, 400, {"sucesso": False, "erros": ["Identificador inválido."]})
                if referencia:
                    if not referencia.get().exists:
                        return resposta_json(self, 404, {"sucesso": False, "erros": ["Criação não encontrada."]})
                else:
                    referencia = colecao.document()
                referencia.set(salvo, merge=True)
                return resposta_json(self, 200, {"sucesso": True, "id": referencia.id})

            if acao == "solicitar":
                campanha_id, skill_id = corpo.get("campanha_id"), corpo.get("skill_id")
                if not isinstance(campanha_id, str) or not campanha_id or not isinstance(skill_id, str) or not skill_id:
                    return resposta_json(self, 400, {"sucesso": False, "erros": ["Campanha e habilidade são obrigatórias."]})
                campanha_ref = db.collection("campanhas").document(campanha_id)
                campanha_snap = campanha_ref.get()
                habilidade_snap = db.collection("usuarios").document(uid).collection("homebrew").document(skill_id).get()
                if not campanha_snap.exists or not habilidade_snap.exists or uid not in (campanha_snap.to_dict().get("jogadores_uids") or []):
                    return resposta_json(self, 403, {"sucesso": False, "erros": ["É necessário ser jogador da campanha e dono da habilidade."]})
                pendentes = [d for d in campanha_ref.collection("homebrewRequests").where("owner_uid", "==", uid).stream() if d.to_dict().get("skill_id") == skill_id and d.to_dict().get("status") == "pendente"]
                if pendentes:
                    return resposta_json(self, 409, {"sucesso": False, "erros": ["Já existe um pedido pendente para esta habilidade."]})
                conteudo = habilidade_snap.to_dict()
                conteudo.pop("atualizado_em", None)
                campanha_ref.collection("homebrewRequests").add({"owner_uid": uid, "skill_id": skill_id, "conteudo": conteudo, "status": "pendente", "solicitado_em": firestore.SERVER_TIMESTAMP})
                return resposta_json(self, 200, {"sucesso": True})

            if acao == "responder":
                campanha_id, pedido_id = corpo.get("campanha_id"), corpo.get("pedido_id")
                if not isinstance(campanha_id, str) or not isinstance(pedido_id, str):
                    return resposta_json(self, 400, {"sucesso": False, "erros": ["Campanha e pedido são obrigatórios."]})
                campanha_ref = db.collection("campanhas").document(campanha_id)
                campanha_snap = campanha_ref.get()
                if not campanha_snap.exists or campanha_snap.to_dict().get("mestre_id") != uid:
                    return resposta_json(self, 403, {"sucesso": False, "erros": ["Somente o mestre desta campanha pode responder."]})
                pedido_ref = campanha_ref.collection("homebrewRequests").document(pedido_id)
                pedido_snap = pedido_ref.get()
                if not pedido_snap.exists or pedido_snap.to_dict().get("status") != "pendente":
                    return resposta_json(self, 404, {"sucesso": False, "erros": ["Pedido pendente não encontrado."]})
                pedido = pedido_snap.to_dict()
                aprovado = corpo.get("aprovar") is True
                transacao = db.transaction()

                @firestore.transactional
                def finalizar(tx):
                    atual = pedido_ref.get(transaction=tx)
                    if not atual.exists or atual.to_dict().get("status") != "pendente":
                        raise ValueError("Este pedido já foi respondido.")
                    tx.update(pedido_ref, {"status": "aprovada" if aprovado else "rejeitada", "respondido_em": firestore.SERVER_TIMESTAMP, "respondido_por_uid": uid})
                    if aprovado:
                        conteudo = pedido.get("conteudo") or {}
                        destino_id = f"{pedido['owner_uid']}_{pedido['skill_id']}"
                        tx.set(campanha_ref.collection("approvedHomebrew").document(destino_id), {**conteudo, "owner_uid": pedido["owner_uid"], "skill_id": pedido["skill_id"], "aprovado_por_uid": uid, "aprovado_em": firestore.SERVER_TIMESTAMP})

                try:
                    finalizar(transacao)
                except ValueError as erro:
                    return resposta_json(self, 409, {"sucesso": False, "erros": [str(erro)]})
                return resposta_json(self, 200, {"sucesso": True, "aprovado": aprovado})

            return resposta_json(self, 400, {"sucesso": False, "erros": ["Ação inválida."]})
        except ErroAutenticacao as erro:
            resposta_json(self, 401, {"sucesso": False, "erros": [str(erro)]})
        except Exception as erro:
            logging.exception("Falha ao salvar ou responder solicitação homebrew")
            resposta_json(self, 500, {"sucesso": False, "erros": ["Não foi possível concluir a operação agora. Tente novamente."]})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.end_headers()
