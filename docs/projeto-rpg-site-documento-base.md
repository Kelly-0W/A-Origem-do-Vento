# Documento-Base — Site de RPG "A Origem do Vento"

> Este documento existe para dar contexto completo a qualquer IA (Claude, Gemini, ChatGPT, Blackbox etc.) que venha a ajudar na construção deste projeto. Ele resume decisões já tomadas, o sistema de RPG que serve de base, e os pontos ainda em aberto. Sempre que uma decisão mudar, atualize este arquivo.

---

## 1. Visão Geral do Projeto

Um site de RPG de mesa online, inspirado em três referências:

- **CRIS** (ficha digital de RPG)
- **D&D Beyond** (gestão de personagens, campanhas e regras integradas)
- **App do Tormenta 20** (ficha oficial digital de sistema brasileiro)

### Funcionalidades principais planejadas

1. Um usuário pode **criar uma mesa (campanha)** e virar o Mestre dela, ou **entrar em uma mesa existente** como Jogador.
2. Criação de **personagens próprios**, seguindo as regras do sistema homebrew "A Origem do Vento".
3. Aba de **Homebrew** dentro de cada campanha, onde o Mestre pode criar NPCs, poderes, inimigos e itens exclusivos daquela mesa.
4. O Mestre tem **acesso total** às fichas de todos os jogadores da mesa e ao **log de rolagens** de todos eles.
5. Sistema de **combate**: o Mestre pode iniciar um combate, o sistema calcula a ordem de iniciativa (Iniciativa + regra de Velocidade), e o Mestre decide se mostra ou esconde vida/CD/status dos inimigos para os jogadores.
6. O site deve funcionar como **PWA** (Progressive Web App), instalável em smartphones direto do navegador, sem precisar de loja de aplicativos.

### Ordem de desenvolvimento

**Prioridade 1 (atual): Criação de Personagem.** É a base de tudo — sem ficha estruturada, não dá pra fazer combate nem homebrew consistente.

---

## 2. Stack Tecnológica Definida

| Camada | Tecnologia | Papel |
| --- | --- | --- |
| Frontend | HTML / CSS / JavaScript puro (com apoio de IA, já que o dono do projeto não programa em JS) | Interface do usuário, PWA |
| Backend / Regras | Python (via **Firebase Cloud Functions**) | Cálculo de status, validação de regras (ex: pontos de atributo válidos, perícia pertence à raça/classe, poder pertence ao elemento escolhido etc.) |
| Hospedagem do site | Vercel | Deploy do frontend (HTML/CSS/JS) |
| Banco de dados — conteúdo estruturado | **Firebase Firestore** | Catálogo de raças, classes, origens, perícias, poderes/manipulações, fichas de personagem, dados de campanha |
| Banco de dados — tempo real | **Firebase Realtime Database (RTDB)** | Estado ao vivo do combate (ordem de iniciativa, turno atual, visibilidade de HP/CD do inimigo) e **log de rolagens** da mesa (funciona como um feed tipo chat, ordenado por tempo) |
| Autenticação | **Firebase Authentication** | Autentica o **usuário/jogador** (não o personagem). O personagem é um documento no Firestore vinculado ao `uid` do dono. |
| App "baixável" | **PWA** (manifest.json + service worker) | Permite "instalar" o site no celular sem app store |

### Observações importantes de arquitetura

- **Por que separar Firestore de RTDB?** Firestore é melhor para dados estruturados e consultas complexas (ex: "todas as fichas da campanha X", "todos os poderes do elemento Água"). RTDB é mais barato e nativamente em tempo real para dados tipo "feed" (log de rolagens, estado ao vivo de combate).
- **Python como camada de validação:** o cliente (JS) não deve escrever direto no banco sem passar pelas regras. O Python valida antes de gravar (ex: impedir que um jogador distribua mais de 10 pontos de atributo, ou escolha um poder de um elemento que não é o seu).
- **Hospedagem do Python:** ✅ **decidido** — vai rodar como **Firebase Cloud Functions** (2ª geração, que suporta runtime Python). Isso mantém toda a lógica de backend dentro do ecossistema Firebase, sem depender de configurar serverless functions separadas no Vercel. O Vercel fica responsável só pelo frontend (HTML/CSS/JS/PWA); o frontend chama as Cloud Functions via HTTPS (ou via SDK do Firebase) para validar regras e calcular status.
  - Observação para quando formos implementar: como o dono do projeto nunca usou Cloud Functions, o primeiro passo prático vai ser um tutorial/protótipo simples (ex: uma function que recebe uma distribuição de atributos e valida se está dentro das regras) antes de partir para o motor de cálculo completo.
- **Cache local do catálogo (otimização de leituras do Firestore):** ✅ **decidido** — o frontend NÃO busca o catálogo de regras (raças, classes, origens, perícias, elementos, poderes, itens) no Firestore toda vez que uma ficha é aberta. Em vez disso, o app baixa o catálogo completo **uma vez no login**, salva localmente no navegador (**IndexedDB**, preferível ao localStorage por não ter o limite de ~5MB e lidar melhor com objetos), e as fichas referenciam esses dados locais pelos IDs. Isso reduz drasticamente o consumo da cota gratuita de leituras do Firestore.
  - **Versionamento obrigatório:** o Firestore terá um documento leve de metadados (ex: `catalogo_meta/versao`) com o número da versão atual do catálogo. No login, o app compara a versão local com a remota e só rebaixa o catálogo quando houver atualização de regras — sem isso, o jogador ficaria preso a regras desatualizadas para sempre.
  - **Observação de implementação:** o SDK do Firestore já possui cache offline embutido (`persistentLocalCache`), que resolve boa parte disso automaticamente — vale começar por ele antes de escrever um sistema de cache manual.
- **Segurança / permissões:** o "acesso total do Mestre" às fichas e logs de uma campanha não vem da autenticação em si, e sim das **Security Rules** do Firestore/RTDB. A regra deve checar se o `uid` de quem pede é o `mestre_id` daquela campanha, ou se está na lista de jogadores dela, antes de liberar leitura/escrita. Isso precisa ser desenhado junto com o schema de campanhas (ainda não feito).

---

## 3. Resumo do Sistema de RPG — "A Origem do Vento"

O material completo do sistema foi extraído de um export do Notion (Livro do Jogador, Livro do Mestre, Bestiário, Mundo etc.). Abaixo, o resumo do que é relevante para a Criação de Personagem e Combate.

### 3.1 Atributos

Seis atributos: **Força (FOR), Destreza (DES), Constituição (CON), Inteligência (INT), Sabedoria (SAB), Carisma (CAR)**.

- Distribuição por pontos: **10 pontos** para distribuir.
- Valor máximo por atributo (sem modificador de raça): **3**. Valor mínimo: **-1**.
- Cada ponto negativo dá **+1 ponto extra** para redistribuir.
- Modificador = valor do atributo (1 para 1). Ex: FOR 3 → +3 no teste.

### 3.2 Perícias

29 perícias, cada uma ligada a um atributo. Algumas **exigem treinamento** para serem usadas (listado no sistema), outras podem ser usadas destreinadas.

- **Perícia não treinada** = Modificador do Atributo.
- **Perícia treinada** = Modificador do Atributo + Bônus de treinamento (por grau de Ascensão).

Tabela de bônus de treinamento por Ascensão:
```
Ascensão 1: +1
Ascensão 3: +3
Ascensão 5: +4
Ascensão 7: +6
Ascensão 10: +9
```
> ✅ **RESOLVIDO:** graus intermediários usam o bônus do grau anterior já definido na tabela (ex: Grau 2 usa o bônus do Grau 1 = +1; Grau 4 usa o bônus do Grau 3 = +3; Grau 6 e Grau 8/9 usam o bônus do Grau 5 = +4, e assim por diante). Regra de implementação: `bônus(grau) = bônus do maior marco da tabela que seja ≤ grau atual` (Grau 0 = +0, sem treinamento ainda).

Se o personagem já era treinado numa perícia e recebe treinamento de novo (por uma habilidade), ganha **+2 fixo** extra, independente do grau de Ascensão. Habilidades só podem ser usadas em perícias treinadas.

Lista completa das 29 perícias e seus atributos/necessidade de treinamento está no arquivo fonte `Criação de Personagem.md` (seção Perícias) — cada uma tem, em alguns casos, mini-habilidades associadas com CD fixa (ex: Acrobacia → "Amortecer queda", CD15).

### 3.3 Status Básicos

Cinco status, cada um calculado por **fórmula própria de cada raça** (não é universal):

- **Vida**: ex. Humano = `10 + Constituição + (4 × Grau de Ascensão)`
- **Sanidade**: ex. Humano = `8 + Sabedoria + (3 × Grau de Ascensão)`
- **Arché**: ex. Humano = `8 + Inteligência + (2 × Grau de Ascensão)` (é a "mana"/fonte dos poderes)
- **Defesa**: ex. Humano = `7 + Destreza + Grau de Ascensão`
- **Deslocamento**: fixo por raça (ex. Humano = 9m)

Regras adicionais importantes:
- **Vida a 0** → estado "Limiar" (não é morte imediata). Pode rolar 1d20 por até 3 turnos, CD `22 - Constituição`, para voltar com 1 de vida. Morre no 4º turno em Limiar.
- **Sanidade abaixo de 5** → penalidades de controle. **Sanidade a 0** → estado "Armagedom" (o Mestre assume o personagem); morte se não for revertido em 3 turnos ou 15 minutos reais.
- **Arché** é gasto ao usar poderes; abaixo de 50% do máximo, começam efeitos colaterais (positivos e negativos) — ver seção de Manipulação abaixo.
- **Defesa** não vale contra ataques em área (usa-se Reflexos ou Acrobacia nesses casos).

### 3.4 Raças

14 raças disponíveis: Anão, Astara, Bathari, Demônio, Draconato, Elfo, Fada, Goblin, Humano, Kaimar, Melanthae, Merith, Ocularde, Orc.

Cada raça tem seu próprio subconjunto de arquivos-fonte:
- História, Biologia, Cultura (lore, não afeta mecânica)
- **Status** (fórmulas de Vida/Sanidade/Arché/Defesa/Deslocamento + modificadores fixos de atributo)
- **Nome** (gerador de nomes por raça, lore)
- **Habilidades de Raça** (lista de habilidades exclusivas; no Grau de Ascensão 0, o jogador escolhe **2** para começar)

> ✅ **RESOLVIDO — análise completa das 14 raças feita.** O sistema é mais variado do que parecia inicialmente: existem **3 características independentes** que uma raça pode ou não ter, e algumas raças acumulam mais de uma ao mesmo tempo. Segue o mapeamento completo:

**Característica A — Linhagens** (sub-raças com fórmula de status própria, modificadores de atributo próprios e, em alguns casos, **lista de habilidades exclusiva daquela linhagem**, além das habilidades "Globais" da raça):

| Raça | Linhagens | Observação |
| --- | --- | --- |
| **Anão** | Ferro (Fenyra), Prata (Karnath), Aço (Velmor) — 3 linhagens | Tem habilidades **Globais** + habilidades **específicas por linhagem** (ex: "Pele Vulcânica" só para Linhagem de Ferro) |
| **Elfo** | Solar, Lunar — 2 linhagens | Mesmo padrão: habilidades Globais + específicas por linhagem |
| **Draconato** | Couraço, Sutil — 2 linhagens | Diferença de status e dano de soco/chute (Couraço = Corte/Perfuração, Sutil = Impacto). Também tem habilidades Globais + Específicas por subgrupo |
| **Demônio** | Areianos, Asmodianos, Lokianos, Midasianos, Panianos, Sethitas, Zebubitas — **7 linhagens** | O caso mais extremo: cada uma tem status, modificadores de atributo, **um "Selo" próprio** (ver Característica C) e uma lista de habilidades específicas só daquela linhagem |

**Característica B — Sistema Racial Único** (mecânica especial que **toda a raça** possui, independente de linhagem — geralmente uma habilidade "ativa" com custo de recurso, ou uma barra/estado especial):

| Raça | Sistema | Resumo |
| --- | --- | --- |
| **Ocularde** | Olhar da Verdade | Ação Padrão + 4 Arché para abrir um terceiro olho: leitura de mente, vantagem em perícias mentais; ao fechar, causa "Tonto" + perda fixa de Sanidade |
| **Astara** | Toca do Coelho | Alterna entre Plano Físico e Plano Espiritual (Ação Bônus, custa 1 Arché/turno); fica invisível/inalcançável para quem está no outro plano |
| **Fada** | Sinfonia das Estações | O personagem assume passivamente uma de 4 "Formas" (Primavera/Verão/Outono/Inverno) conforme a estação do mundo no momento, cada uma com um efeito passivo mecânico diferente (regeneração, buff de escudo, resistência a controle mental, resistência a dano de água/frio) |
| **Kaimar** | Frenesi do Luar | Maldição de transformação forçada em lua cheia (ou voluntária, 1x por combate): vira "Forma Bestial" com status alterados, bônus de combate, mas ataca sempre o alvo mais próximo; requer teste de Vontade para manter consciência |
| **Draconato** | Tormento do Tirano *(além das linhagens acima)* | Barra especial "Loucura" (0–30) que sobe a cada ponto de Sanidade perdido e **não abaixa mesmo curando a Sanidade**. Ao chegar a 30, o personagem entra em "Metamorfose" (casulo por 7 turnos) e, se não for revertido a tempo, vira um dragão puro incontrolável — só reversível por um ritual específico de clérigos de Nidhogg |
| **Demônio** | Regras de Selo *(uma por linhagem, ver tabela acima)* | Cada uma das 7 linhagens tem um "Selo" opcional do seu Daemon padroeiro — dá um bônus mecânico com uma restrição/penalidade acoplada (ex: Selo de Loki dá +2 em poderes mas proíbe repetir a mesma ação em turnos seguidos). Demônios com menos de 20 anos ainda não têm Selo, mas em compensação todo dano de Sanidade que recebem é considerado crítico |

**Característica C — Raças "simples"** (sem linhagem e sem sistema racial único — só status unificado, modificadores fixos e uma lista normal de habilidades escolhíveis): **Bathari, Goblin, Humano, Melanthae, Merith, Orc**.

**Implicação para o schema (Firestore):** o documento de "raça" no catálogo precisa suportar, todos como campos **opcionais**:
- `linhagens[]` — cada item com sua própria fórmula de status, modificadores de atributo, e opcionalmente sua própria `habilidades_especificas[]` (além das `habilidades_globais[]` da raça-mãe).
- `sistema_racial_inato` — objeto livre descrevendo a mecânica especial (nome, custo, efeito, gatilho), aplicável no nível da raça inteira (ex: Ocularde, Astara, Fada, Kaimar) **ou**, quando a raça tiver linhagens, no nível de cada linhagem individualmente (caso do Selo dos Demônios) **ou** em ambos os níveis simultaneamente (caso do Draconato, que tem linhagem E um sistema único que se aplica a todas as linhagens igualmente).
- Raças da Característica C simplesmente não preenchem `linhagens[]` nem `sistema_racial_inato`.

### 3.5 Classes

Definem o papel tático em combate. Regras gerais:

- Multiclasse permitida, até **2 classes simultâneas**.
- Subclasse exige já ter pelo menos **3 habilidades** da classe normal.
- No Grau de Ascensão 0: personagem recebe automaticamente **1 perícia treinada fixa da classe** + escolhe **1 habilidade** da classe.

Classes existentes no material: Alquimista, Assassino, Bárbaro, Bardo, Bobo da Corte, Caçador, Clérigo, Feiticeiro, Gladiador, Monge, Oráculo, Pirata, Sentinela (cada uma com 3 subclasses temáticas e sua própria lista de habilidades em arquivo separado).

### 3.6 Origens

Representam o passado do personagem. Catálogo fixo e simples de modelar — cada origem dá:
- Escolha de **1 entre 3 perícias** (fica treinada).
- **1 kit de itens** inicial (lista de texto na fonte original; alguns itens têm dano de arma, ex: "adaga pequena 1d4+Destreza").

> ✅ **RESOLVIDO:** os itens dos kits de Origem serão modelados como **entradas próprias no catálogo de Itens** do Firestore (não como texto livre solto na ficha), cada um com seus atributos estruturados (nome, tipo, dano se for arma, descrição etc.). A Origem apenas referencia os `item_id`s do seu kit. Isso deixa mais organizado e facilita adicionar novas Origens no futuro sem duplicar definição de item.
- **1 habilidade passiva fixa** (geralmente um bônus numérico simples).

Origens catalogadas: Artista, Arqueólogo, Criminoso, Escravo, Estudioso, Exilado, Mercador, Militar, Nobre, Orfão de Guerra, Peregrino, Selvagem.

### 3.7 Manipulação (Poderes Elementais) — **OBRIGATÓRIA para todo personagem**

> **Decisão confirmada pelo dono do projeto:** manipulação **não é opcional**. Todo personagem manipula um elemento — pensar nisso como "as dobras" (bending) do *Avatar: A Lenda de Aang*: todo mundo pertence a um elemento, é parte inerente do personagem, não uma escolha de build separada.

- 8 elementos: **Água, Alma, Caça, Fogo, Natureza, Terra, Trevas, Vento**.
- Cada elemento tem **submanipulações** (ramificações que alteram tipo de dano/efeito de um poder base). Ex: Água → Gelo ou Sangue.
- **Caça é um caso especial**: exige que o personagem tenha nascido ou sido criado em Oruqai (é *gated* por lore/origem, diferente dos outros 7 elementos que são de escolha livre). Isso precisa virar uma regra de elegibilidade no formulário (bloquear "Caça" a menos que uma condição de origem/raça seja satisfeita).
- Toda pessoa só pode escolher **1 elemento**.
- Na criação (Grau de Ascensão 0): escolhe **2 poderes iniciais** do elemento escolhido.
- Cada poder tem ficha padronizada: descrição, tipo de ação (Padrão/Movimento/etc.), alcance, fórmula de dano (ex: `2d6 + mod. Misticismo`), perícia usada, alvo, duração, custo de Arché, variações por submanipulação.
- Perícia usada no acerto/dano depende do tipo de poder:
  - **Impacto corporal / armas** → perícia **Luta**.
  - **Arcano / puro** → perícia **Misticismo**.
- CD de resistência de qualquer poder = `12 + modificador da perícia usada`.
- **Habilidades Supremas** só desbloqueiam a partir do Grau de Ascensão 4+, com recarga de 1x por cena.
- Efeito de Arché baixo (abaixo de 50%): cada elemento tem estágios próprios de transformação/penalidade/bônus conforme o Arché cai (ex: Água < 50% = cura +1d6 mas vulnerabilidade a choque elétrico; < 25% = imunidade a agarrão mas -2 em testes de Força; 0 = "Colapso", morte).

### 3.8 Progressão — Ascensão (substitui XP/Nível)

O sistema **não usa XP nem level tradicional**. A progressão é por **Ascensão**, até **10 Graus**.

Cada novo grau exige cumprir **3 pilares simultaneamente**:
1. **Catalisador** — material raro específico da raça, consumido no ritual.
2. **Provação** — desafio específico da classe (prova de força de vontade, não pode ser comprado).
3. **Ritual** — condição específica da origem (viagem a um templo, mestre antigo, estação do ano etc.).

> ✅ **RESOLVIDO (fluxo de produto confirmado):**
> 1. Na ficha do personagem, cada um dos 3 pilares (Catalisador, Provação, Ritual) do próximo Grau de Ascensão aparece como um **checkbox individual** que o jogador marca conforme vai cumprindo.
> 2. Quando os **3 checks estiverem marcados**, o sistema dispara automaticamente uma **requisição de Ascensão** para o Mestre da campanha.
> 3. O Mestre recebe essa requisição (provavelmente como uma notificação/lista de pendências dentro da própria interface de mestre) e decide **aprovar ou recusar**.
> 4. Só quando o Mestre aprova, o Grau de Ascensão do personagem sobe de fato e os novos status/bônus são recalculados.
>
> **Implicação para o schema:** a ficha do personagem precisa de um objeto tipo `ascensao_em_progresso` com os 3 booleans (`catalisador`, `provacao`, `ritual`) + um campo de status (`nenhuma` / `aguardando_mestre` / `aprovada` / `recusada`). Esse dado deve ser visível e editável pelo Mestre via Security Rules (ele precisa poder aprovar/recusar), mas os 3 checkboxes só devem ser marcáveis pelo próprio jogador dono da ficha.

Cada Ascensão também causa uma "Manifestação" — alteração física/espiritual sem efeito mecânico, é só representação visual da evolução (pode virar um campo de texto/imagem na ficha, sem impacto em cálculo).

### 3.9 Combate (para a fase 2 do projeto, depois da criação de personagem)

- Combate ocorre em **Rodadas**; cada Rodada tem um **Turno** por criatura, seguindo a **Ordem de Combate** definida por teste de **Iniciativa** no início.
- **Velocidade** é uma segunda métrica: no início do combate, o jogador decide se rola Velocidade (soma 1d6+Velocidade na iniciativa) ou usa Velocidade para aumentar Reflexos.
- 6 tipos de ação por turno: **Padrão, Movimento, Reação, Livre, Bônus, Completa** (cada uma com regra própria de uso).
- Turno segue 4 passos: (1) recuperar reação, (2) resolver efeitos de início de turno, (3) realizar ações, (4) encerrar turno/resolver efeitos finais.
- Dano se divide em **Físico** e **Mágico** (mágico se ramifica pelos 8 elementos de manipulação).
- Resistências possíveis: **Resistência** (metade do dano), **Vulnerabilidade** (+50% dano), **Imunidade** (ignora completamente), **Absorção**. Se a criatura tiver mais de um efeito pro mesmo tipo de dano, usa-se só o mais vantajoso.
- Requisito do produto: o Mestre pode escolher mostrar ou esconder vida/CD do inimigo para os jogadores durante o combate.

---

## 4. Fluxo de Criação de Personagem (ordem recomendada, não obrigatória)

1. **Raça** → aplica modificadores fixos de atributo, define fórmulas de Vida/Sanidade/Arché/Defesa/Deslocamento, jogador escolhe 2 habilidades de raça.
2. **Classe** → concede 1 perícia treinada fixa, jogador escolhe 1 habilidade de classe.
3. **Origem** → jogador escolhe 1 de 3 perícias (treinada), recebe kit de itens fixo e 1 habilidade passiva fixa.
4. **Distribuição de Atributos** → 10 pontos, min -1, max 3, cada ponto negativo libera +1 extra.
5. **Manipulação (obrigatória)** → jogador escolhe 1 elemento (checar elegibilidade se for "Caça"), depois escolhe 2 poderes iniciais desse elemento.
6. **Cálculo automático** → o sistema (motor Python) calcula: modificadores de atributo, perícias treinadas/destreinadas, status finais (Vida/Sanidade/Arché/Defesa/Deslocamento), CDs dos poderes escolhidos.

---

## 5. Perguntas em Aberto (revisar antes de avançar)

- [x] Confirmar regra da tabela de bônus de treinamento de perícia nos graus intermediários de Ascensão → resolvido, ver seção 3.2.
- [x] Ler e modelar os sistemas próprios de **todas as 14 raças** (não só Draconato, Demônio e Ocularde) → resolvido, ver seção 3.4. Encontradas mais 3 raças com sistema único (Astara, Fada, Kaimar) e 2 raças com linhagens que não tinham sido checadas (Anão, Elfo). Draconato acumula linhagem + sistema único; Demônio acumula linhagem + um sistema (Selo) específico por linhagem.
- [x] Definir o fluxo de aprovação de Ascensão pelo Mestre → resolvido, ver seção 3.8 (fluxo de 3 checkboxes + requisição ao Mestre).
- [x] Decidir entre Cloud Functions ou serverless do Vercel para o Python → resolvido, será **Firebase Cloud Functions**.
- [x] Modelar os itens dos kits iniciais de Origem → resolvido, viram entradas estruturadas no catálogo de Itens.
- [ ] Desenhar o schema de "Campanha" (mestre_id, lista de players, homebrew da campanha) — **ainda pendente, fica para depois** (dono do projeto confirmou que vai tratar disso mais adiante). É pré-requisito para as Security Rules de acesso do Mestre.

---

## 6. Status Atual do Projeto

- [x] Brainstorm inicial e validação da viabilidade técnica.
- [x] Leitura do sistema de regras (Criação de Personagem, Raças, Classes, Origens, Manipulações/Poderes, Combate).
- [x] Definição da stack (Firestore + RTDB + Firebase Auth + Python + Vercel + PWA).
- [x] Confirmação: manipulação elemental é obrigatória para todo personagem (comparável às "dobras" do Avatar — todo mundo pertence a um elemento).
- [x] Todas as pendências de regras resolvidas (treinamento por Ascensão, linhagens especiais, fluxo de aprovação de Ascensão, Cloud Functions, catálogo de itens).
- [x] Análise completa de sistemas únicos/linhagens nas 14 raças (não só as 3 iniciais).
- [x] **Schema de dados (Firestore) da ficha de personagem** — feito, ver arquivo separado `schema-banco-dados-personagem.md`.
- [ ] Popular o Firestore com os dados reais do catálogo (raças, classes, origens, perícias, elementos, poderes, itens) — **próximo passo**.
- [ ] Primeira Cloud Function em Python (cálculo de status a partir de raça+linhagem+atributos).
- [ ] Protótipo do formulário de criação de personagem (frontend).
- [ ] Security Rules do Firestore/RTDB.
- [ ] Sistema de campanhas/mesas.
- [ ] Sistema de combate (fase 2).
- [ ] Homebrew (fase 3).
