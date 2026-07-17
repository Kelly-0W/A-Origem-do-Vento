"""
Cloud Functions (Python) do site "A Origem do Vento".

Por enquanto só existe uma function de teste (hello_mundo), pra confirmar
que o ambiente de deploy (Python + Firebase Functions 2ª geração) está
funcionando de ponta a ponta antes de implementar as regras de verdade.

Próximas functions a implementar aqui (ver docs/schema-banco-dados-personagem.md,
seção "Fluxo de escrita"):
  - validar_e_calcular_ficha: recebe as `escolhas` de criação de personagem,
    valida contra o catálogo (racas/classes/origens/pericias/elementos/poderes/itens)
    e grava `escolhas` + `calculado` na ficha.
  - responder_ascensao: chamada pelo Mestre para aprovar/recusar um pedido
    de Ascensão pendente.

A lógica de cálculo em si (fórmulas de status, validação de escolhas) deve
morar em motor/, não aqui — main.py só expõe as functions e chama o motor.
"""

from firebase_admin import initialize_app
from firebase_functions import https_fn

initialize_app()


@https_fn.on_call()
def hello_mundo(req: https_fn.CallableRequest) -> dict:
    """Function de teste simples. Chame via Firebase Emulator local ou já
    deployada para confirmar que o ambiente está de pé."""
    nome = "aventureiro"
    if req.data and isinstance(req.data, dict):
        nome = req.data.get("nome", nome)
    return {"mensagem": f"Ola, {nome}! As Cloud Functions estao de pe."}
