# 🌪️ A Origem do Vento — Sistema Integrado de RPG & Plataforma Digital

> **"No princípio, o mundo não possuía forma, regido apenas pelas marés sutis e correntes invisíveis. Do encontro dos elementos nasceu a primeira brisa — e com ela, o destino de todos os reinos."**

---

## 📌 Sobre o Projeto

**A Origem do Vento** é um sistema completo de **Tabletop RPG (TTRPG)** próprio, acompanhado por uma **plataforma web completa** desenvolvida para automatizar a criação de fichas, a gestão de campanhas, a mecânica de combate e o processo de evolução de personagens (*Ascensão*).

O objetivo principal do projeto é eliminar a burocracia das planilhas manuais e o cálculo mecânico repetitivo durante as sessões, permitindo que jogadores e Mestres fiquem 100% imersos na narrativa, na estratégia e na interpretação.

---

## 💡 Por Que Este Sistema Existe?

1. **Automação das Regras Complexas**: O sistema possui mecânicas de atributos, perícias derivadas, afinidades elementais, Sagracânticos e sistemas de recompensa dinâmicos. Gerenciar isso no papel gera erros de cálculo e lentidão. O motor em Python centraliza todas as validações e regras de negócio.
2. **Experiência Fluida para Jogadores e Mestres**:
   - **Jogadores**: Contam com um assistente passo a passo (*Character Wizard*) para criação de fichas sem violar os limites do sistema, além de um painel dinâmico para acompanhamento de vida, mana, inventário e habilidades em tempo real.
   - **Mestres**: Possuem controle total da mesa, podendo gerenciar múltiplos participantes, ajustar recursos ao vivo, consultar o catálogo de bestiários/itens e supervisionar os testes de *Ascensão*.
3. **Plataforma Centralizada e Acessível**: Com backend serverless e frontend moderno em React, o sistema permite jogar presencialmente ou à distância com sincronização instantânea via Firebase.

---

## 🏗️ Arquitetura e Estrutura do Sistema

O repositório é organizado em uma arquitetura modular composta por três pilares principais:

```text
A-Origem-do-Vento/
├── api/                   # Engine/Motor de Regras em Python
│   ├── motor/             # Módulos do motor (atributos, perícias, fichas, validações, catálogos)
│   └── *.py               # Serverless Cloud Functions (Endpoints de integração)
├── frontend/              # Interface Web do Usuário (React + Vite + Tailwind CSS)
│   └── src/
│       ├── components/    # Componentes modulares (FichaVisual, PainelMestre, PainelAscensao, etc.)
│       ├── pages/         # Páginas (Dashboard, Personagens, Campanhas, Combate, Biblioteca)
│       └── lib/           # Integrações com API e Firebase Authentication
├── seed/                  # Dados base do sistema (JSONs de Raças, Classes, Itens, Elementos, Bestiário)
├── functions/             # Firebase Cloud Functions (Integração com backend Python)
└── docs/                  # Documentação técnica e esquemas de banco de dados
```

---

## ⚙️ Principais Funcionalidades

- 🧙‍♂️ **Character Wizard**:
  - Criação guiada de personagens com distribuição de pontos de atributos.
  - Seleção de Raças, Classes, Origens e Afinidades Elementais.
  - Validação rigorosa para impedir fichas com distribuições inválidas.

- 📜 **Ficha Dinâmica & Interativa**:
  - Cálculo automático de atributos secundários (Vida, Mana, Defesa, Iniciativa, Carga).
  - Gestão de inventário e equipamentos com limites de peso/capacidade.
  - Consulta detalhada de habilidades, feitiços e Sagracânticos.

- 🎲 **Painel do Mestre & Gestão de Campanhas**:
  - Controle de múltiplas campanhas ativas e códigos de convite para jogadores.
  - Visão geral das fichas de todos os participantes em tempo real.
  - Ajuste direto de recursos (PV, PM, Sanidade, Experiência).

- ⚡ **Mecânica de Ascensão & Recompensas**:
  - Módulo interativo para evolução de nível e ascensão dos personagens.
  - Escolha de bônus, novos poderes e recompensas geridas pela mesa.

- 📚 **Biblioteca Eletrônica / Compêndio**:
  - Consulta rápida a todo o ecossistema do jogo: Classes, Raças, Itens, Efeitos de Status, Elementos e Bestiário.

---

## 🛠️ Tecnologias Utilizadas

### Frontend
- **React.js** + **Vite** (Build ultra-rápido e reatividade)
- **Tailwind CSS** (Design moderno, responsivo e estilizado)
- **Lucide React** (Iconografia consistente)
- **Firebase Auth** (Autenticação segura de usuários)

### Backend & Engine de RPG
- **Python 3.x** (Motor de validação, cálculos de regras e regras de negócio)
- **Firebase Firestore / Admin SDK** (Banco de dados em tempo real e persistência)
- **Serverless Cloud Functions** (Vercel / Firebase Functions)

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
- **Node.js** (v18 ou superior)
- **Python** (v3.10 ou superior)

### 1. Clonar o repositório
```bash
git clone https://github.com/seu-usuario/A-Origem-do-Vento.git
cd A-Origem-do-Vento
```

### 2. Configurar e Executar o Frontend
```bash
cd frontend
npm install
npm run dev
```
Acesse a aplicação em `http://localhost:5173`.

### 3. Testar o Motor em Python (CLI Local)
Para testar a validação de fichas e cálculos das regras diretamente no Python:
```bash
python testar_motor.py
```

---

## 📑 Licença e Direitos Autorais

Desenvolvido para o universo do RPG **A Origem do Vento**. Todos os direitos narrativos, regras de sistema e código-fonte são mantidos pelos criadores originais do projeto.
