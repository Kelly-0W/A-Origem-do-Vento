# A Origem do Vento — Site de RPG

Estrutura inicial do projeto. Este README cobre: (1) o que cada pasta faz,
e (2) o passo a passo pra configurar o Firebase do zero.

## Estrutura de pastas

```
origem-do-vento/
├── docs/               Documentação do projeto (documento-base e schema do banco)
├── firebase.json        Configuração raiz do Firebase (Firestore + Functions)
├── .firebaserc.example   Modelo -- copie para .firebaserc e coloque o ID do seu projeto
├── firestore.rules      Regras de segurança do Firestore
├── firestore.indexes.json  Índices do Firestore (vazio por enquanto)
├── functions/           Cloud Functions em Python (regras, cálculo, validação)
│   ├── main.py           Ponto de entrada das functions
│   ├── requirements.txt  Dependências Python
│   ├── motor/            Motor de regras puro (a implementar na próxima etapa)
│   └── tests/            Testes automatizados do motor (a implementar depois)
├── seed/                 Scripts que populam o Firestore com o catálogo de regras
│   ├── dados/             Os dados em si, como JSON (fonte da verdade editável)
│   └── seed_catalogo.py   Script que sobe os JSONs pro Firestore
├── cli-teste/            Scripts de teste local, sem Firebase e sem frontend
│   └── testar_local.py
└── frontend/             Vazia por enquanto -- entra quando chegarmos no Vercel
```

## O que já está pronto vs. o que falta

- ✅ Estrutura de pastas e arquivos de configuração do Firebase.
- ✅ Regras de segurança (`firestore.rules`) na primeira versão.
- ✅ Pipeline de seed testado ponta a ponta com dados de exemplo (1 raça, 1
  classe, 1 origem, 2 perícias, 1 item, 1 elemento com 1 poder, e a tabela
  completa de Ascensão).
- ✅ `cli-teste/testar_local.py` já roda e calcula status corretamente a
  partir do JSON de exemplo — testado nesta própria configuração.
- ⏳ Popular o catálogo completo (14 raças, todas as classes, origens,
  perícias, elementos/poderes, itens) — próxima etapa.
- ⏳ Implementar o motor de regras de verdade (`functions/motor/`).
- ⏳ Frontend / Vercel — só depois que o motor + Firestore estiverem
  funcionando via terminal.

---

## Passo a passo: configurando o Firebase (lado do console)

Isso aqui só dá pra fazer manualmente, no navegador, com a conta Google que
você quer usar pro projeto.

1. Acesse **console.firebase.google.com** e clique em **"Adicionar
   projeto"**. Dê um nome (ex: `origem-do-vento`) e siga o assistente
   (pode desativar o Google Analytics, não é necessário).
2. Dentro do projeto, no menu lateral, vá em **Build → Firestore Database**
   e clique em **"Criar banco de dados"**. Escolha o modo de produção
   (production mode) e a região mais próxima de vocês (ex: `southamerica-east1`
   se estiverem no Brasil).
3. Ainda no menu lateral, vá em **Build → Authentication → Sign-in method**
   e ative pelo menos um provedor (o mais simples pra começar é
   **E-mail/senha**; dá pra adicionar Google depois).
4. Vá em **Configurações do Projeto** (ícone de engrenagem, no topo do menu
   lateral) → aba **Contas de serviço** → botão **"Gerar nova chave
   privada"**. Isso baixa um arquivo `.json` — salve-o como
   `seed/serviceAccountKey.json` dentro deste projeto (esse arquivo é
   secreto, nunca vai pro Git — já está no `.gitignore`).
5. Anote o **ID do projeto** (aparece em Configurações do Projeto, logo no
   topo). Você vai precisar dele no próximo bloco.

## Passo a passo: configurando o ambiente local

Isso já é no terminal de vocês.

```bash
# 1. Instalar o Firebase CLI (precisa de Node.js instalado)
npm install -g firebase-tools

# 2. Fazer login (abre o navegador pra autenticar com a conta Google
#    que criou o projeto)
firebase login

# 3. Dentro da pasta do projeto, ligar esta pasta ao projeto do Firebase
cp .firebaserc.example .firebaserc
# edite o .firebaserc e troque SUBSTITUA-PELO-ID-DO-SEU-PROJETO-FIREBASE
# pelo ID que você anotou no passo 5 acima

# 4. Confirmar que está tudo linkado corretamente
firebase projects:list

# 5. Publicar as regras de segurança do Firestore
firebase deploy --only firestore:rules

# 6. Preparar o ambiente Python das Cloud Functions
cd functions
python3 -m venv venv
source venv/bin/activate   # no Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..

# 7. Testar as Cloud Functions localmente (emulador, não gasta cota)
firebase emulators:start --only functions

# 8. (Opcional, só quando quiser subir de verdade) fazer o deploy
firebase deploy --only functions
```

## Rodando o teste local (sem Firebase nenhum)

Pra validar que a estrutura de dados e o motor de cálculo fazem sentido,
sem precisar de conta Firebase, internet ou frontend:

```bash
cd cli-teste
python3 testar_local.py
```

Isso já roda hoje e imprime os status calculados de um Humano de exemplo.

## Rodando o seed (depois que o Firebase estiver configurado)

```bash
cd seed
pip install firebase-admin
python3 seed_catalogo.py
```

Isso sobe os dados de exemplo de `seed/dados/*.json` pro Firestore. Depois
dá pra conferir no Console do Firebase, em Firestore Database, se as
coleções `racas`, `classes`, `origens`, `pericias`, `itens`, `elementos`
(com a subcoleção `poderes`) e `constantes` apareceram certinho.

---

## Próximos passos (depois que o Firebase estiver configurado e testado)

1. Popular `seed/dados/*.json` com o catálogo completo de verdade (14
   raças, todas as classes, origens, as 29 perícias, os 8 elementos e
   todos os poderes).
2. Implementar o motor de regras em `functions/motor/`.
3. Escrever a Cloud Function `validar_e_calcular_ficha` de verdade.
4. Só então: começar o frontend (`frontend/`) e o deploy no Vercel.
