# seed/

Scripts que populam o Firestore com o catalogo de regras (racas, classes,
origens, pericias, elementos+poderes, itens, constantes).

## Fluxo de trabalho

1. Os dados "de verdade" vivem primeiro em `dados/*.json` -- editar esses
   arquivos e mais facil e seguro do que digitar direto no Console do
   Firebase, e fica versionado no Git.
2. Rodar `python seed_catalogo.py` sobe o conteudo desses JSONs pro
   Firestore.
3. Se editar um JSON depois, rodar o script de novo simplesmente sobrescreve
   o documento (nao duplica).

## Estado atual

Cada arquivo em `dados/` tem so 1-2 entradas de exemplo -- o suficiente pra
testar se o pipeline inteiro funciona (JSON valido -> Firestore populado
corretamente, incluindo a subcolecao de poderes dentro de elementos).
Popular o catalogo completo com os dados reais das 14 racas, todas as
classes, origens, as 29 pericias, os 8 elementos e todos os poderes e a
proxima etapa do projeto -- ainda nao feita.

## Antes de rodar

Precisa de `seed/serviceAccountKey.json` (chave de conta de servico gerada
no Console do Firebase). Ver instrucoes em `firebase_admin_init.py`.

```
pip install firebase-admin
python seed_catalogo.py
```
