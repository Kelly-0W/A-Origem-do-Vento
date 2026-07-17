# motor/

Aqui vai morar o motor de cálculo e validação de regras — a parte "cérebro"
do backend, separada da casca das Cloud Functions (main.py). A separação é
proposital: o motor deve ser um pacote Python puro, importável e testável
sozinho (inclusive pelo script em `cli-teste/`), sem depender de estar
rodando dentro de uma Cloud Function.

Módulos previstos (a implementar na próxima etapa, ainda não agora):

- `constantes.py` — tabela global de Ascensão (pontos de status e
  recompensas por grau), bônus de treinamento de perícia por grau.
- `status.py` — calcula Vida/Sanidade/Arché/Defesa/Deslocamento a partir da
  fórmula de coeficientes (`base + atributo + mult_ascensao * grau`) de
  uma raça ou linhagem.
- `atributos.py` — valida a distribuição de pontos de atributo (10 pontos,
  min -1, max 3, ponto negativo libera +1 extra).
- `pericias.py` — calcula o bônus final de cada perícia (treinada ou não).
- `validacao.py` — valida o conjunto de `escolhas` de um personagem contra
  o catálogo (habilidade pertence à raça/linhagem, poder pertence ao
  elemento e à submanipulação, elegibilidade do elemento Caça, etc.).

Ver `docs/schema-banco-dados-personagem.md` para o formato exato dos dados
que esse motor vai consumir.
