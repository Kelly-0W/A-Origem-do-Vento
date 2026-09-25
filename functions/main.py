"""
Cloud Functions (Python) do site "A Origem do Vento".

`gerenciar_homebrew` usa o UID verificado pelo Firebase Callable Auth para
guardar criações privadas e mediar sua aprovação por campanha. O conteúdo
aprovado é publicado numa coleção própria da campanha.
"""

from firebase_admin import initialize_app, firestore
from firebase_functions import https_fn
from datetime import date, datetime

initialize_app()


def _json_seguro(valor):
    if isinstance(valor, dict):
        return {k: _json_seguro(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [_json_seguro(v) for v in valor]
    if isinstance(valor, (datetime, date)):
        return valor.isoformat()
    return valor


@https_fn.on_call()
def hello_mundo(req: https_fn.CallableRequest) -> dict:
    """Function de teste simples. Chame via Firebase Emulator local ou já
    deployada para confirmar que o ambiente está de pé."""
    nome = "aventureiro"
    if req.data and isinstance(req.data, dict):
        nome = req.data.get("nome", nome)
    return {"mensagem": f"Ola, {nome}! As Cloud Functions estao de pe."}


@https_fn.on_call()
def gerenciar_homebrew(req: https_fn.CallableRequest) -> dict:
    """Cria homebrew, solicita aprovação e lista/responde itens de campanha."""
    if not req.auth:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.UNAUTHENTICATED, message="Autenticação obrigatória.")
    uid = req.auth.uid
    data = req.data or {}
    db = firestore.client()
    acao = data.get("acao")

    if acao == "listar_proprios":
        docs = db.collection("usuarios").document(uid).collection("homebrew").stream()
        return _json_seguro({"itens": [{"id": d.id, **d.to_dict()} for d in docs]})

    if acao == "salvar":
        habilidade = data.get("habilidade") or {}
        if habilidade.get("tipo") not in ("poder_elemental", "habilidade_personagem") or not isinstance(habilidade.get("nome"), str) or not habilidade["nome"].strip() or not isinstance(habilidade.get("descricao"), str) or not habilidade["descricao"].strip():
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Tipo, nome e descrição são obrigatórios.")
        permitidos = {"tipo", "nome", "descricao", "efeito", "execucao", "alcance", "pericia", "alvo", "duracao", "custo_arche", "dano", "grau_minimo"}
        habilidade = {k: v for k, v in habilidade.items() if k in permitidos}
        if data.get("id"):
            ref = db.collection("usuarios").document(uid).collection("homebrew").document(data["id"])
            if not ref.get().exists:
                raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.NOT_FOUND, message="Criação não encontrada.")
        else:
            ref = db.collection("usuarios").document(uid).collection("homebrew").document()
        habilidade.update({"criador_uid": uid, "atualizado_em": firestore.SERVER_TIMESTAMP})
        ref.set(habilidade, merge=True)
        return {"sucesso": True, "id": ref.id}

    if acao == "solicitar":
        campanha_id, skill_id = data.get("campanha_id"), data.get("skill_id")
        if not campanha_id or not skill_id:
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Campanha e habilidade são obrigatórias.")
        campanha_ref = db.collection("campanhas").document(campanha_id)
        campanha = campanha_ref.get()
        skill = db.collection("usuarios").document(uid).collection("homebrew").document(skill_id).get()
        if not campanha.exists or not skill.exists or uid not in (campanha.to_dict().get("jogadores_uids") or []):
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.PERMISSION_DENIED, message="Habilidade própria e participação como jogador são necessárias.")
        pendentes = [d for d in campanha_ref.collection("homebrewRequests").where("owner_uid", "==", uid).stream() if d.to_dict().get("skill_id") == skill_id and d.to_dict().get("status") == "pendente"]
        if pendentes:
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.ALREADY_EXISTS, message="Já existe um pedido pendente para esta habilidade.")
        campanha_ref.collection("homebrewRequests").add({"owner_uid": uid, "skill_id": skill_id, "conteudo": skill.to_dict(), "status": "pendente", "solicitado_em": firestore.SERVER_TIMESTAMP})
        return {"sucesso": True}

    if acao == "listar_campanha":
        campanha_id = data.get("campanha_id")
        campanha_ref = db.collection("campanhas").document(campanha_id or "")
        campanha = campanha_ref.get()
        if not campanha.exists:
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.NOT_FOUND, message="Campanha não encontrada.")
        c = campanha.to_dict()
        mestre = c.get("mestre_id") == uid
        if not mestre and uid not in (c.get("jogadores_uids") or []):
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.PERMISSION_DENIED, message="Você não faz parte desta campanha.")
        aprovados = [{"id": d.id, **d.to_dict()} for d in campanha_ref.collection("approvedHomebrew").stream()]
        pedidos = []
        biblioteca_jogadores = []
        if mestre:
            pedidos = [{"id": d.id, **d.to_dict()} for d in campanha_ref.collection("homebrewRequests").where("status", "==", "pendente").stream()]
            for pedido in pedidos:
                src = db.collection("usuarios").document(pedido["owner_uid"]).collection("homebrew").document(pedido["skill_id"]).get()
                pedido["conteudo"] = src.to_dict() if src.exists else None
            # Subcoleções Firestore não permitem uma query cruzada por uid.
            # O callable verifica a campanha e lê as criações dos seus jogadores.
            for jogador_uid in c.get("jogadores_uids", []):
                docs = db.collection("usuarios").document(jogador_uid).collection("homebrew").stream()
                biblioteca_jogadores.extend({"id": d.id, "owner_uid": jogador_uid, **d.to_dict()} for d in docs)
        else:
            pedidos = [{"id": d.id, **d.to_dict()} for d in campanha_ref.collection("homebrewRequests").where("owner_uid", "==", uid).stream()]
        return _json_seguro({"sucesso": True, "aprovados": aprovados, "pedidos": pedidos, "biblioteca_jogadores": biblioteca_jogadores, "eh_mestre": mestre})

    if acao == "responder":
        campanha_id, pedido_id = data.get("campanha_id"), data.get("pedido_id")
        campanha_ref = db.collection("campanhas").document(campanha_id or "")
        campanha = campanha_ref.get()
        if not campanha.exists or campanha.to_dict().get("mestre_id") != uid:
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.PERMISSION_DENIED, message="Somente o mestre pode responder.")
        pedido_ref = campanha_ref.collection("homebrewRequests").document(pedido_id or "")
        pedido = pedido_ref.get()
        if not pedido.exists or pedido.to_dict().get("status") != "pendente":
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.NOT_FOUND, message="Pedido pendente não encontrado.")
        p = pedido.to_dict()
        aprovado = data.get("aprovar") is True
        transacao = db.transaction()

        @firestore.transactional
        def finalizar(tx):
            atual = pedido_ref.get(transaction=tx)
            if not atual.exists or atual.to_dict().get("status") != "pendente":
                raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION, message="Este pedido já foi respondido.")
            tx.update(pedido_ref, {"status": "aprovada" if aprovado else "rejeitada", "respondido_em": firestore.SERVER_TIMESTAMP, "respondido_por_uid": uid})
            if aprovado:
                tx.set(campanha_ref.collection("approvedHomebrew").document(f"{p['owner_uid']}_{p['skill_id']}"), {**p["conteudo"], "owner_uid": p["owner_uid"], "skill_id": p["skill_id"], "aprovado_por_uid": uid, "aprovado_em": firestore.SERVER_TIMESTAMP})

        finalizar(transacao)
        return {"sucesso": True, "aprovado": aprovado}

    raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Ação inválida.")
