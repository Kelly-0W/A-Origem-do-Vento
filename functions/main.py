"""Cloud Functions de exemplo do site; homebrew roda pela API Vercel."""

from firebase_admin import initialize_app
from firebase_functions import https_fn

initialize_app()


@https_fn.on_call()
def hello_mundo(req: https_fn.CallableRequest) -> dict:
    """Confirma que o runtime de Cloud Functions está ativo."""
    nome = "aventureiro"
    if req.data and isinstance(req.data, dict):
        nome = req.data.get("nome", nome)
    return {"mensagem": f"Ola, {nome}! As Cloud Functions estao de pe."}
