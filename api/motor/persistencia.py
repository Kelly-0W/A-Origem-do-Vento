"""
Persistencia da ficha calculada no Cloud Firestore.

Usa o Firebase Admin SDK com credencial vinda de uma VARIAVEL DE AMBIENTE
(FIREBASE_SERVICE_ACCOUNT_JSON) -- nunca de um arquivo commitado no repo.

Isso e' diferente de seed/firebase_admin_init.py: aquele le' um arquivo
local (serviceAccountKey.json), o que so' funciona rodando na maquina do
desenvolvedor. O endpoint da Vercel nao tem esse arquivo no deploy, entao
precisa da credencial via variavel de ambiente -- configure em:
  - Vercel: Project Settings -> Environment Variables -> FIREBASE_SERVICE_ACCOUNT_JSON
    (cole o conteudo INTEIRO do JSON da service account)
  - Local (vercel dev): arquivo .env.local na raiz do projeto, mesma variavel
"""
import json
import os
from typing import Any, Dict, Optional

import firebase_admin
from firebase_admin import credentials, firestore

NOME_COLECAO = "personagens"


def obter_cliente_firestore():
    """
    Inicializa (uma vez) e devolve o cliente do Firestore via Admin SDK.

    Publica (sem "_" na frente) porque, alem de salvar_ficha_calculada
    aqui embaixo, tambem e usada por api/mestre_campanha_personagens.py e
    api/responder_ascensao.py -- qualquer endpoint que precise ler/escrever
    no Firestore com privilegio de servidor (ignorando as Security Rules).
    """
    if not firebase_admin._apps:
        credencial_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        if not credencial_json:
            raise RuntimeError(
                "Variavel de ambiente FIREBASE_SERVICE_ACCOUNT_JSON nao "
                "configurada. Ver comentario no topo de "
                "api/motor/persistencia.py para instrucoes."
            )
        cred = credentials.Certificate(json.loads(credencial_json))
        firebase_admin.initialize_app(cred)
    return firestore.client()


def buscar_campanha(campanha_id: str) -> Optional[Dict[str, Any]]:
    """Retorna o documento da campanha (com `id`), ou None se não existir."""
    db = obter_cliente_firestore()
    snap = db.collection("campanhas").document(campanha_id).get()
    if not snap.exists:
        return None
    return {"id": snap.id, **snap.to_dict()}


def buscar_personagem(personagem_id: str) -> Optional[Dict[str, Any]]:
    """Retorna o documento do personagem (com `id`), ou None se não existir."""
    db = obter_cliente_firestore()
    snap = db.collection(NOME_COLECAO).document(personagem_id).get()
    if not snap.exists:
        return None
    return {"id": snap.id, **snap.to_dict()}


def listar_personagens_da_campanha(campanha_id: str) -> list:
    """
    Todos os personagens (de qualquer dono) vinculados a essa campanha --
    usado pelo Painel do Mestre, que precisa ver a mesa inteira, não só os
    próprios personagens de quem está logado.
    """
    db = obter_cliente_firestore()
    docs = db.collection(NOME_COLECAO).where(
        "campanhas_ids", "array_contains", campanha_id
    ).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


def buscar_nomes_usuarios(uids) -> Dict[str, Optional[str]]:
    """dict uid -> nome de exibição, pra rotular 'personagem de Fulano'."""
    db = obter_cliente_firestore()
    nomes: Dict[str, Optional[str]] = {}
    for uid in set(u for u in uids if u):
        snap = db.collection("usuarios").document(uid).get()
        nomes[uid] = snap.to_dict().get("nome") if snap.exists else None
    return nomes


def atualizar_personagem(personagem_id: str, dados: Dict[str, Any]) -> None:
    """Merge parcial no documento do personagem (ex.: resolver Ascensão)."""
    db = obter_cliente_firestore()
    db.collection(NOME_COLECAO).document(personagem_id).set(dados, merge=True)


def salvar_ficha_calculada(
    escolhas: Dict[str, Any],
    calculado: Dict[str, Any],
    dono_uid: Optional[str] = None,
    personagem_id: Optional[str] = None,
    campanha_id: Optional[str] = None,
) -> str:
    """
    Salva a ficha calculada no Firestore, na colecao `personagens`.

    - `escolhas`: exatamente o que o jogador enviou (o input de calcular_ficha).
    - `calculado`: exatamente o que calcular_ficha() devolveu em sucesso.
    - `dono_uid`: uid do usuario dono do personagem, se disponivel (usado
      pelas Security Rules para restringir quem le/edita depois).
    - `personagem_id`: se informado, ATUALIZA o documento existente
      (mantendo o `criado_em` original). Se omitido, CRIA um documento novo.
    - `campanha_id`: SO' tem efeito na CRIACAO (personagem_id omitido).
      Um personagem pode pertencer a varias campanhas ao mesmo tempo (nunca
      e' obrigatorio no Wizard), entao isso vira o primeiro elemento do
      array `campanhas_ids` -- adicionar/remover campanhas depois de criado
      e' feito directo no Firestore (arrayUnion/arrayRemove), nao por aqui,
      pra nao arriscar sobrescrever vinculos existentes numa atualizacao de
      ficha que nao tem nada a ver com campanha.

    Retorna o id do documento salvo.
    """
    db = obter_cliente_firestore()
    colecao = db.collection(NOME_COLECAO)
    agora = firestore.SERVER_TIMESTAMP

    dados: Dict[str, Any] = {
        "escolhas": escolhas,
        "calculado": calculado,
        "atualizado_em": agora,
    }
    if dono_uid is not None:
        dados["dono_uid"] = dono_uid

    if personagem_id:
        # Atualiza um personagem existente. merge=True preserva campos que
        # nao estao em `dados` (ex: criado_em original, campanhas_ids, etc.)
        doc_ref = colecao.document(personagem_id)
        doc_ref.set(dados, merge=True)
        return personagem_id

    dados["criado_em"] = agora
    dados["campanhas_ids"] = [campanha_id] if campanha_id else []
    doc_ref = colecao.document()
    doc_ref.set(dados)
    return doc_ref.id
