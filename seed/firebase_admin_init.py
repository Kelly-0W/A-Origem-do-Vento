"""
Inicializa o Firebase Admin SDK para os scripts de seed rodarem localmente
(fora do ambiente das Cloud Functions).

Antes de usar:
1. No Firebase Console -> Configuracoes do Projeto -> Contas de servico,
   gere uma nova chave privada (JSON).
2. Salve o arquivo baixado como "seed/serviceAccountKey.json" (esse nome
   exato). Ele NAO deve ir para o Git -- ja esta listado no .gitignore.
"""

import os

import firebase_admin
from firebase_admin import credentials, firestore

_CRED_PATH = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")


def get_db():
    if not firebase_admin._apps:
        if not os.path.exists(_CRED_PATH):
            raise FileNotFoundError(
                "seed/serviceAccountKey.json nao encontrado. Veja as "
                "instrucoes no topo deste arquivo."
            )
        cred = credentials.Certificate(_CRED_PATH)
        firebase_admin.initialize_app(cred)
    return firestore.client()
