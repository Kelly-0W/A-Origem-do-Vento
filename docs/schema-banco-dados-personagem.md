# Schema de Banco de Dados — Ficha de Personagem e Catálogo (Firestore)

> Projeto: Site de RPG "A Origem do Vento"
> Escopo deste documento: **Prioridade 1 — Criação de Personagem**.
> Cobre as coleções de **catálogo** (raças, classes, origens, perícias, elementos, poderes, itens) e a coleção de **fichas de personagem**. O schema de Campanha fica para depois (conforme documento-base), mas os campos que dependerão dele já estão marcados.
>
> Convenções:
> - Nomes de coleções e campos em `snake_case`, em português (consistente com o material-fonte).
> - IDs de documentos de catálogo são *slugs* legíveis (`humano`, `anao`, `bola-de-fogo`) — facilita debug, seed e referências.
> - Campos marcados como **(calculado)** nunca são escritos pelo cliente: só pela Cloud Function (Python), que é a única com permissão de escrita nesses campos via Security Rules / escrita server-side.

---

## Visão geral das coleções

```
firestore/
├── usuarios/{uid}
├── racas/{raca_id}
├── classes/{classe_id}
├── origens/{origem_id}
├── pericias/{pericia_id}
├── elementos/{elemento_id}
│     └── poderes/{poder_id}          (subcoleção)
├── itens/{item_id}
└── personagens/{personagem_id}
```

Por que os poderes são **subcoleção de elementos**? Todo poder pertence a exatamente 1 elemento, e a consulta típica é "todos os poderes do elemento X" (tela de escolha dos 2 poderes iniciais). A subcoleção dá isso de graça e mantém o caminho natural (`elementos/fogo/poderes/bola-de-fogo`). Se um dia precisar de busca global de poderes, usa-se *collection group query* (`collectionGroup('poderes')`).

---

## 1. `usuarios/{uid}`

O `uid` é o do Firebase Authentication. Guarda só perfil; personagem é documento próprio.

```jsonc
{
  "nome_exibicao": "Kelly",
  "email": "x@y.com",              // espelho do Auth, opcional
  "criado_em": Timestamp,
  "avatar_url": "https://..."      // opcional
  // futuramente: lista de campanhas como mestre/jogador (denormalização)
}
```

---

## 2. `racas/{raca_id}`

Suporta os 3 padrões mapeados no documento-base: raças simples, raças com **linhagens** e raças com **sistema racial inato** (podendo acumular).

```jsonc
{
  "nome": "Anão",
  "descricao_curta": "...",                 // resumo para a tela de seleção
  "lore_refs": {                            // opcional; links/urls dos textos de lore
    "historia": "...", "biologia": "...", "cultura": "..."
  },

  // ---- Bloco de status "default" da raça ----
  // Presente APENAS quando a raça NÃO tem linhagens (Característica C
  // e raças com sistema único mas sem linhagem: Ocularde, Astara, Fada, Kaimar).
  // Quando a raça tem linhagens, este campo é null e cada linhagem tem o seu.
  "status": StatusRacial | null,

  "modificadores_atributo": {               // idem: só quando NÃO há linhagens
    "for": 0, "des": 0, "con": 1, "int": 0, "sab": 0, "car": 0
  } | null,

  // ---- Linhagens (Característica A) ----
  // Vazio para raças sem linhagem.
  "linhagens": [
    {
      "id": "ferro",
      "nome": "Linhagem de Ferro (Fenyra)",
      "descricao_curta": "...",
      "status": StatusRacial,               // fórmula própria da linhagem
      "modificadores_atributo": { "for": 2, "des": 0, "con": 0, "int": 0, "sab": -2, "car": 0 },
      // Sistema racial no nível da LINHAGEM (caso do Selo dos Demônios).
      "sistema_racial_inato": SistemaRacial | null
    }
  ],

  // ---- Habilidades de raça ----
  // Globais: escolhíveis por qualquer personagem da raça.
  "habilidades_globais": [ HabilidadeRacial ],
  // Específicas: cada uma referencia a linhagem à qual pertence.
  "habilidades_especificas": [
    { ...HabilidadeRacial, "linhagem_id": "ferro" }
  ],
  "qtd_habilidades_iniciais": 2,            // regra: escolhe 2 no Grau 0

  // ---- Sistema racial no nível da RAÇA (Característica B) ----
  // Ocularde, Astara, Fada, Kaimar, Draconato (que TAMBÉM tem linhagens).
  "sistema_racial_inato": SistemaRacial | null
}
```

### Objeto `StatusRacial`

As fórmulas variam por raça/linhagem, mas todas seguem o padrão
`base + atributo + (multiplicador × grau_ascensao)`. Guardamos os coeficientes,
não texto — assim o motor Python calcula sem parsear string:

```jsonc
{
  "vida":     { "base": 10, "atributo": "con", "mult_ascensao": 4 },
  "sanidade": { "base": 8,  "atributo": "sab", "mult_ascensao": 3 },
  "arche":    { "base": 8,  "atributo": "int", "mult_ascensao": 2 },
  "defesa":   { "base": 7,  "atributo": "des", "mult_ascensao": 1 },
  "deslocamento_m": 9,                       // fixo, em metros
  "ataque_desarmado": {                      // "Soco/Chute" das tabelas de raça
    "dano": "1d4", "atributo": "for", "tipo_dano": "impacto"
  }
}
```

> Observação: algumas linhagens usam atributos diferentes na mesma fórmula
> (ex. Defesa dos Asmodianos usa Carisma; Arché dos Demônios usa Sabedoria em
> vez de Inteligência) — por isso o `atributo` é campo, não convenção.

### Objeto `SistemaRacial`

Objeto descritivo + parâmetros mecânicos opcionais. A mecânica de cada sistema é
única demais para um schema rígido; o motor Python trata cada `tipo` como um caso:

```jsonc
{
  "tipo": "tormento_do_tirano",     // chave estável usada pelo motor de regras
  "nome": "Tormento do Tirano",
  "descricao": "...",
  "parametros": {                   // livre, por tipo. Exemplos:
    // Draconato: { "loucura_max": 30, "turnos_metamorfose": 7 }
    // Ocularde:  { "acao": "padrao", "custo_arche": 4 }
    // Astara:    { "acao": "bonus", "custo_arche_por_turno": 1 }
    // Demônio (Selo): { "bonus": "...", "restricao": "...", "idade_minima": 20 }
  }
}
```

### Objeto `HabilidadeRacial` (e habilidades em geral)

```jsonc
{
  "id": "pele-vulcanica",
  "nome": "Pele Vulcânica",
  "descricao": "...",
  "tipo": "passiva" | "ativa",
  "efeitos": [ Efeito ]             // opcional, ver §9 — para automação futura
}
```

---

## 3. `classes/{classe_id}`

```jsonc
{
  "nome": "Gladiador",
  "descricao_curta": "...",
  "pericia_treinada_fixa": "luta",          // pericia_id concedida no Grau 0
  "qtd_habilidades_iniciais": 1,
  "habilidades": [
    {
      "id": "...", "nome": "...", "descricao": "...",
      "tipo": "passiva" | "ativa",
      "requisitos": { "grau_ascensao_min": 0 },   // opcional
      "efeitos": [ Efeito ]
    }
  ],
  "subclasses": [
    {
      "id": "...", "nome": "...", "descricao": "...",
      // regra: exige >= 3 habilidades da classe normal
      "requisito_habilidades_classe": 3,
      "habilidades": [ Habilidade ]
    }
  ],
  // Provações por grau (pilar de Ascensão da classe) — texto por grau
  "provacoes": { "1": "...", "2": "...", "...": "...", "10": "..." }
}
```

Regras de multiclasse (máx. 2 classes) ficam no motor Python, não no schema.

---

## 4. `origens/{origem_id}`

```jsonc
{
  "nome": "Criminoso",
  "descricao": "...",
  "pericias_opcoes": ["furtividade", "ladinagem", "enganacao"],  // escolhe 1
  "kit_itens": ["adaga-pequena", "kit-ladrao"],                  // item_ids (ver §7)
  "habilidade_passiva": { "nome": "...", "descricao": "...", "efeitos": [ Efeito ] },
  // Rituais por grau (pilar de Ascensão da origem)
  "rituais": { "1": "...", "...": "...", "10": "..." }
}
```

---

## 5. `pericias/{pericia_id}`

As 29 perícias, catálogo global.

```jsonc
{
  "nome": "Acrobacia",
  "atributo": "des",
  "requer_treinamento": true,
  "descricao": "...",
  "mini_habilidades": [                     // "Amortecer queda", etc.
    { "nome": "Amortecer queda", "cd": 15, "descricao": "..." },
    { "nome": "Palco de circo", "cd": 25, "descricao": "...", "usos_por": "combate" }
  ]
}
```

A tabela de bônus de treinamento por Ascensão é **regra global**, não dado por
perícia — vive no motor Python como constante:
`bonus(grau) = maior marco ≤ grau` com marcos `{1:+1, 3:+3, 5:+4, 7:+6, 10:+9}` e grau 0 = +0.
Bônus de "treinado duas vezes" = +2 fixo (também regra do motor).

---

## 6. `elementos/{elemento_id}` + subcoleção `poderes`

### Documento de elemento

```jsonc
{
  "nome": "Fogo",
  "descricao": "...",
  "submanipulacoes": [
    { "id": "combustao", "nome": "Combustão", "descricao": "..." },
    { "id": "eletricidade", "nome": "Eletricidade", "descricao": "..." }
  ],
  // Elegibilidade (caso "Caça": só quem nasceu/foi criado em Oruqai)
  "restricao_elegibilidade": null | {
    "descricao": "Exige ter nascido ou sido criado em Oruqai.",
    "tipo": "confirmacao_narrativa"   // v1: checkbox confirmado pelo jogador/mestre;
                                      // futuramente pode checar origem/raça
  },
  // Efeitos de Arché baixo ("Corrosão do Arché"), cumulativos
  "estagios_arche_baixo": [
    { "limiar_pct": 50, "descricao": "...", "efeitos": [ Efeito ] },
    { "limiar_pct": 25, "descricao": "...", "efeitos": [ Efeito ] },
    { "limiar_pct": 0,  "descricao": "Colapso. Morte imediata.", "efeitos": [] }
  ]
}
```

### `elementos/{elemento_id}/poderes/{poder_id}`

Ficha padronizada dos poderes (espelha o formato do material-fonte):

```jsonc
{
  "nome": "Bola de Fogo",
  "descricao": "...",
  "execucao": "padrao" | "movimento" | "bonus" | "reacao" | "livre" | "completa",
  "alcance": "pessoal" | "corpo_a_corpo" | "curto" | "medio" | "longo",
  "dano": { "dados": "2d6", "pericia_mod": "misticismo", "tipo_dano": "fogo" } | null,
  "pericia": "misticismo" | "luta",         // define também a CD: 12 + mod(perícia)
  "alvo": "1 alvo (e área adjacente de 3m de raio)",
  "duracao": "instantaneo" | "X rodadas" | "cena" | "sustentado",
  "custo_arche": 1,
  "suprema": false,                         // true => exige Grau 4+, 1x por cena
  "grau_minimo": 0,
  "variacoes": [                            // por submanipulação
    { "submanipulacao_id": "combustao", "descricao": "..." },
    { "submanipulacao_id": "eletricidade", "descricao": "..." }
  ]
}
```

---

## 7. `itens/{item_id}`

Catálogo único de itens mundanos (inclui os itens dos kits de Origem, conforme decisão do documento-base).

```jsonc
{
  "nome": "Adaga Pequena",
  "categoria": "arma" | "armadura" | "escudo" | "consumivel" | "sobrevivencia" | "ferramenta" | "kit",
  "descricao": "...",

  // ---- só para armas ----
  "arma": {
    "dano": { "dados": "1d4", "atributo": "des", "tipo_dano": "perfuracao" },
    "empunhadura": "uma_mao" | "duas_maos" | "disparo" | "arremesso",
    "alcance_m": 1.5,
    "kit_de_combate": false,       // arcos/bestas: true (consomem 2 escolhas)
    "minerio": "cobre"             // ver tabela de minérios abaixo
  } | null,

  // ---- só para armaduras/escudos ----
  "defesa": {
    "bonus_defesa": 2,
    "peso": "leve" | "pesada",
    "minerio": "cobre"
  } | null,

  // ---- kits (agrupadores) ----
  "conteudo": ["item_id", "..."] | null
}
```

Tabela de **minérios** (bônus de dano / redução de dano / propriedade especial)
é pequena e global → constante no motor Python (ou coleção `minerios` se o
Mestre quiser homebrewar minérios no futuro).

---

## 8. `personagens/{personagem_id}`

A ficha. ID auto-gerado pelo Firestore.

Princípio central: a ficha guarda **escolhas** (inputs do jogador) separadas de
**valores calculados** (outputs do motor Python). O cliente nunca escreve no bloco
`calculado`; a Cloud Function valida as escolhas, recalcula e grava tudo junto.

```jsonc
{
  // ---- Vínculos ----
  "dono_uid": "abc123",                 // uid do Firebase Auth (jogador dono)
  "campanha_id": null,                  // preenchido quando entrar numa mesa (schema futuro)
  "criado_em": Timestamp,
  "atualizado_em": Timestamp,

  // ---- Identidade / narrativa ----
  "nome": "Tharion",
  "avatar_url": null,
  "historia": "...",                    // texto livre
  "anotacoes": "...",                   // texto livre do jogador

  // ---- Escolhas de criação (inputs) ----
  "escolhas": {
    "raca_id": "anao",
    "linhagem_id": "ferro",             // null se a raça não tem linhagens
    "habilidades_raca_ids": ["pele-vulcanica", "nascido-na-forja"],   // 2 no Grau 0

    "classes": [                        // 1 ou 2 (multiclasse)
      {
        "classe_id": "gladiador",
        "subclasse_id": null,           // exige >= 3 habilidades da classe
        "habilidades_ids": ["..."]      // 1 no Grau 0
      }
    ],

    "origem_id": "criminoso",
    "origem_pericia_id": "furtividade", // 1 dentre as 3 opções da origem

    "atributos_base": {                 // ANTES dos modificadores de raça
      "for": 3, "des": 2, "con": 2, "int": 1, "sab": 1, "car": 1
    },                                  // motor valida: 10 pts, min -1, max 3,
                                        // negativo dá +1 extra

    "elemento_id": "fogo",              // obrigatório para todo personagem
    "submanipulacao_id": "combustao",   // se aplicável
    "poderes_ids": ["bola-de-fogo", "rastro-de-chamas"],   // 2 no Grau 0

    "itens_ids": ["adaga-pequena", "kit-ladrao"],  // kit de origem + 2 seleções do catálogo
    "pericias_treinadas_extras": []     // treinamentos ganhos por habilidades
  },

  // ---- Progressão ----
  "grau_ascensao": 0,
  "manifestacoes": [                    // 1 entrada por Ascensão concluída (visual, sem mecânica)
    { "grau": 1, "descricao": "...", "imagem_url": null }
  ],
  "ascensao_em_progresso": {
    "grau_alvo": 1,
    "catalisador": false,               // 3 checkboxes: só o DONO marca
    "provacao": false,
    "ritual": false,
    "status": "nenhuma" | "aguardando_mestre" | "aprovada" | "recusada",
    // status muda p/ aguardando_mestre automaticamente quando os 3 = true;
    // aprovada/recusada: só o MESTRE da campanha escreve (Security Rules)
    "respondido_por_uid": null,
    "respondido_em": null
  },

  // ---- Estado atual (mutável em jogo) ----
  "estado": {
    "vida_atual": 17,
    "sanidade_atual": 11,
    "arche_atual": 10,
    "condicoes": [],                    // ["tonto", "queimadura", ...]
    "recursos_raciais": {},             // ex.: { "loucura": 4 } (Draconato),
                                        //      { "plano": "fisico" } (Astara)
    "inventario": [                     // itens ganhos em jogo além dos iniciais
      { "item_id": "...", "quantidade": 1, "anotacao": null }
    ]
  },

  // ---- Bloco calculado (escrito SOMENTE pela Cloud Function) ----
  "calculado": {
    "versao_motor": 1,                  // versão do motor de regras que calculou
    "atributos_finais": {               // base + modificadores de raça/linhagem
      "for": 5, "des": 2, "con": 2, "int": 1, "sab": -1, "car": 1
    },
    "status_max": {
      "vida": 20, "sanidade": 10, "arche": 10, "defesa": 10, "deslocamento_m": 7.5
    },
    "ataque_desarmado": { "dano": "1d4", "bonus": 5, "tipo_dano": "impacto" },
    "pericias": {                       // as 29, já resolvidas
      "acrobacia": { "treinada": false, "bonus_total": 2 },
      "furtividade": { "treinada": true, "bonus_total": 3 },
      "...": {}
    },
    "poderes": [                        // CDs resolvidas: 12 + mod da perícia
      { "poder_id": "bola-de-fogo", "cd": 15, "bonus_ataque": 3, "custo_arche": 1 }
    ],
    "valido": true,
    "erros_validacao": []               // preenchido quando a última validação falhou
  }
}
```

### Fluxo de escrita (contrato com o motor Python)

1. O cliente monta/edita apenas `nome`, campos narrativos, `escolhas` e `estado`
   (este último com regras próprias — ver Security Rules abaixo).
2. Ao criar/editar a ficha, o cliente chama a Cloud Function `validar_e_calcular_ficha`
   passando as `escolhas`.
3. A função valida (pontos de atributo; habilidade pertence à raça/linhagem;
   perícia pertence à origem; poder pertence ao elemento e à submanipulação;
   elegibilidade de Caça; limites de quantidade por Grau 0; multiclasse ≤ 2;
   subclasse exige 3 habilidades; itens dentro das regras de seleção do catálogo)
   e grava `escolhas` + `calculado` numa única escrita server-side.
4. Aprovação de Ascensão: função própria (`responder_ascensao`) chamada pelo
   Mestre; ao aprovar, incrementa `grau_ascensao`, recalcula `calculado`,
   reseta `ascensao_em_progresso` para o próximo grau.

### Esboço de Security Rules (a detalhar junto com o schema de Campanha)

| Caminho | Leitura | Escrita |
| --- | --- | --- |
| catálogo (`racas`, `classes`, `origens`, `pericias`, `elementos`, `poderes`, `itens`) | qualquer usuário autenticado | ninguém (só seed/admin via console ou script) |
| `personagens/{id}` | dono (`dono_uid == request.auth.uid`); depois: mestre e colegas da campanha | dono: campos narrativos, `estado.*` e os 3 booleans de `ascensao_em_progresso`; Cloud Function: `escolhas` + `calculado`; mestre: `ascensao_em_progresso.status` (+ acesso total futuro) |
| `usuarios/{uid}` | o próprio usuário | o próprio usuário |

---

## 9. Objeto `Efeito` (opcional, para automação incremental)

Habilidades e estágios de Arché têm efeitos mecânicos muito variados. Para não
travar o projeto tentando estruturar tudo de uma vez, cada habilidade tem
`descricao` (fonte da verdade, sempre presente) e opcionalmente `efeitos[]`
estruturados que o motor consegue aplicar automaticamente. Começa-se
estruturando só os efeitos simples e frequentes:

```jsonc
{ "tipo": "bonus_pericia",   "pericia_id": "vontade", "valor": 2, "condicao": "..." }
{ "tipo": "bonus_defesa",    "valor": 1 }
{ "tipo": "treina_pericia",  "pericia_id": "conhecimento" }
{ "tipo": "resistencia",     "tipo_dano": "terra" }
{ "tipo": "imunidade",       "tipo_dano": "..." | "condicao": "..." }
{ "tipo": "visao_no_escuro" }
{ "tipo": "dano_adicional",  "dados": "1d6", "tipo_dano": "fogo" }
{ "tipo": "outro" }          // fallback: só a descrição textual vale
```

O que não couber nos tipos estruturados fica como `"outro"` e é aplicado
manualmente na mesa — automatiza-se depois, sem migração de schema.

---

## 10. Decisões e justificativas

1. **Fórmulas como coeficientes, não strings** — evita parser de texto no motor
   Python; adicionar raça nova = adicionar documento, sem código novo.
2. **Catálogo separado da ficha** — a ficha guarda só IDs + escolhas; mudanças
   de balanceamento no catálogo se propagam recalculando as fichas (o campo
   `versao_motor` permite recálculo em lote quando as regras mudarem).
3. **`escolhas` vs `calculado`** — fronteira clara de permissão de escrita e o
   contrato natural da Cloud Function de validação (a primeira function a
   implementar, conforme o documento-base).
4. **Homebrew (fase 3) já encaixa**: os schemas de catálogo poderão ser
   replicados em subcoleções da campanha (`campanhas/{id}/homebrew_poderes`
   etc.) usando exatamente os mesmos formatos de documento.
5. **RTDB não aparece aqui** de propósito: log de rolagens e estado de combate
   são schema da fase 2, junto com Campanha.

## 11. Próximos passos sugeridos

1. Validar este schema com 2–3 casos extremos reais: Demônio Lokiano (linhagem
   + Selo), Draconato Sutil (linhagem + Tormento do Tirano), Humano (simples).
2. Escrever o script de *seed* que converte os `.md` do export do Notion em
   documentos do Firestore (começando por `pericias`, `racas`, `origens`).
3. Implementar a Cloud Function `validar_e_calcular_ficha` (o "tutorial
   prático" citado no documento-base: começar validando só atributos).
4. Desenhar o schema de Campanha + Security Rules completas.