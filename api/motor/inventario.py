"""
api/motor/inventario.py

Motor de peso, capacidade de carga e durabilidade de equipamentos --
implementa a secao "3. Secao: Engine > Peso" do livro de regras (pagina
"Peso" no Notion), mais os Modificadores por Minerio descritos no
Catalogo de Itens (bonus de dano fisico ofensivo, reducao de dano
defensiva e propriedade especial de cada material).

Como o resto do motor/, isto e' Python puro, sem nenhuma dependencia de
Firestore. O inventario em si (a lista de itens que um personagem carrega,
com quantidade/minerio/durabilidade atual de CADA instancia) mora direto
no documento do personagem, num campo-irmao "inventario" -- no mesmo
espirito de vida_atual/bonus_defesa (ver comentario grande no topo de
FichaVisual.jsx): e' estado de jogo que muda toda hora em sessao (pegar um
item, gastar uma poção, a espada perder durabilidade num combate), entao
NAO mora dentro de `calculado` (que e' substituido por inteiro cada vez
que a ficha e recalculada por causa de uma mudanca estrutural -- raca,
pericia, Ascensao). Este modulo so' fornece as FORMULAS puras que
transformam essa lista crua em peso total, nivel de sobrecarga/debilidade
de movimento e estado de durabilidade; quem persiste o resultado e' o
frontend, direto via Firestore (ver frontend/src/components/PainelInventario.jsx),
espelhando estas mesmas contas em JS (frontend/src/lib/inventario.js) pra
feedback instantaneo na tela sem precisar de round-trip ao servidor.

Formato esperado de UMA entrada do inventario (um item que o personagem
carrega):
    {
        "id": "uuid-qualquer",       # identifica essa instancia especifica
        "item_id": "espada-longa",   # chave em itens.json
        "minerio": "ferro",          # sobrescreve o "cobre" padrao do catalogo
        "quantidade": 1,             # >1 so' faz sentido pra item SEM durabilidade
        "durabilidade_atual": 60,    # None se o item nao tem durabilidade
        "quebrado": False,
    }
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------
# Capacidade de Carga Maxima (Porte Biologico x Forca)
# ---------------------------------------------------------------------

PORTES_VALIDOS = ["pequeno", "medio", "grande"]

# Kg suportados continuamente nas costas/corpo, cruzando Porte Biologico
# com o valor FINAL do atributo Forca (pos modificadores raciais). So'
# definida pra Forca entre -1 e 3 -- a mesma faixa de distribuicao base de
# atributos (ver ATRIBUTO_MINIMO/ATRIBUTO_MAXIMO em constantes.py); um
# valor de Forca final fora dessa faixa (por causa de um modificador
# racial que empurre alem do intervalo) usa a coluna mais proxima, porque
# a tabela do Notion simplesmente nao define nada alem disso.
TABELA_CARGA_MAXIMA_KG: Dict[str, Dict[int, float]] = {
    "pequeno": {-1: 10, 0: 15, 1: 20, 2: 25, 3: 35},
    "medio": {-1: 20, 0: 30, 1: 40, 2: 50, 3: 65},
    "grande": {-1: 40, 0: 55, 1: 70, 2: 85, 3: 110},
}


def capacidade_carga_maxima_kg(porte_biologico: str, forca_final: int) -> float:
    tabela = TABELA_CARGA_MAXIMA_KG.get(porte_biologico)
    if tabela is None:
        raise ValueError(
            f"Porte biologico desconhecido: {porte_biologico!r}. "
            f"Esperado um de {PORTES_VALIDOS}."
        )
    forca_na_tabela = max(-1, min(3, forca_final))
    return tabela[forca_na_tabela]


def capacidade_esforco_bruto_kg(capacidade_maxima_kg: float) -> float:
    """Erguer/Empurrar/Arrastar (Notion): ate 3x a capacidade de carga
    base, sem sofrer penalidade de Sobrecarga durante o esforco -- isso
    nao e' carga continua, so' vale pro instante da acao pontual."""
    return round(capacidade_maxima_kg * 3, 3)


# ---------------------------------------------------------------------
# Kit inicial de Origem -> entradas de inventario
# ---------------------------------------------------------------------
#
# Cada Origem tem um `kit_itens` no catalogo (origens.json) com o
# equipamento narrativo de partida do personagem -- ver Catalogo de
# Origens no Notion. A maioria desses itens NAO existe no catalogo
# mecanico de equipamentos (itens.json): sao coisas como "Cachecol de
# seda" ou "Diario de campo", que carregam pouco ou nenhum peso e nunca
# tiveram durabilidade. Por isso cada entrada do kit tem um `tipo`:
#
#   - "equipamento_catalogo": tem equivalente EXATO em itens.json (ex.: a
#     "Adaga pequena (1d4+Destreza)" do kit do Criminoso e' literalmente o
#     item `adaga-pequena`) -- vira uma entrada de inventario NORMAL,
#     catalogada, com minerio/durabilidade como qualquer outro item
#     adicionado pelo jogador.
#   - "equipamento": nao tem equivalente no catalogo (ex.: "Roupas
#     coloridas", ou armas narrativas unicas como a "Faca de ossos" do
#     Orfao de Guerra) -- vira uma entrada AVULSA/narrativa (`item_id`
#     None, nome e peso morando na propria entrada). Sem minerio, sem
#     durabilidade -- nao sao forjadas de metal.
#   - "moeda": dinheiro (ex.: "1d8 de Silberstuck"). O site nao rola
#     dados sozinho, entao um valor em dado nao pode virar uma entrada
#     concreta automaticamente -- e tambem nao faz sentido pesar moeda
#     junto do equipamento. Fica de fora do inventario por completo,
#     so' serve como lembrete de que o jogador tem isso pra anotar/rolar
#     em outro lugar.
#   - "companheiro": uma criatura (ex.: o "1 animal pequeno nao
#     combatente" do Selvagem), nao e' equipamento. Tambem fica de fora.


def _entrada_de_kit_item(
    origem_id: str, indice: int, kit_item: dict, materiais: Dict[str, dict]
) -> Optional[dict]:
    """Constroi UMA entrada de inventario a partir de um item do kit de
    Origem, ou None se esse item nao deve virar entrada (moeda/companheiro).

    `origem_kit_id` marca a entrada como vinda desse kit especifico
    (`"<origem_id>:<indice>"`) -- e' o que permite kit_origem_faltando()
    detectar quais itens do kit ainda NAO foram adicionados ao inventario
    de um personagem (pra nao duplicar se o jogador clicar de novo, e pra
    conseguir "completar" o kit de personagens antigos, criados antes
    dessa funcionalidade existir)."""
    tipo = kit_item.get("tipo")
    if tipo == "moeda" or tipo == "companheiro":
        return None

    base = {
        "id": f"kit-{origem_id}-{indice}",
        "origem_kit_id": f"{origem_id}:{indice}",
        "quantidade": max(1, int(kit_item.get("quantidade", 1) or 1)),
        "quebrado": False,
    }
    if tipo == "equipamento_catalogo":
        # "O item sera, quando possivel, feito de Cobre" -- Catalogo de
        # Itens -- mesmo padrao do fluxo normal de "Adicionar item".
        minerio = "cobre"
        base.update({
            "item_id": kit_item["item_id"],
            "minerio": minerio,
            "durabilidade_atual": durabilidade_maxima_material(minerio, materiais),
        })
    else:  # "equipamento" -- avulso/narrativo, sem equivalente no catalogo
        base.update({
            "item_id": None,
            "nome_livre": kit_item["nome"],
            "peso_base_kg": kit_item.get("peso_base_kg", 0) or 0,
            "minerio": None,
            "durabilidade_atual": None,
        })
    return base


def entradas_kit_origem(origem_id: str, origem: dict, materiais: Dict[str, dict]) -> List[dict]:
    """Todas as entradas de inventario que o kit inicial dessa Origem
    produziria (ignorando o que o personagem ja tem)."""
    kit_itens = origem.get("kit_itens") or []
    entradas = []
    for indice, kit_item in enumerate(kit_itens):
        entrada = _entrada_de_kit_item(origem_id, indice, kit_item, materiais)
        if entrada is not None:
            entradas.append(entrada)
    return entradas


def kit_origem_faltando(
    origem_id: str, origem: dict, inventario_atual: List[dict], materiais: Dict[str, dict]
) -> List[dict]:
    """So' as entradas do kit que o personagem AINDA NAO tem -- compara
    pelo marcador `origem_kit_id`. Usado pelo botao "Adicionar Kit de
    Origem" (ver PainelInventario.jsx): cada clique so' preenche o que
    falta, nunca duplica o que ja foi adicionado (inclusive itens que o
    jogador tenha removido de proposito continuam removidos, a nao ser
    que ele clique no botao de novo pra readiciona-los -- e' uma acao
    explicita, nao algo que acontece sozinho)."""
    ja_tem = {e.get("origem_kit_id") for e in inventario_atual if e.get("origem_kit_id")}
    return [e for e in entradas_kit_origem(origem_id, origem, materiais) if e["origem_kit_id"] not in ja_tem]


# ---------------------------------------------------------------------
# Peso de equipamentos
# ---------------------------------------------------------------------


def peso_efetivo_item(
    peso_base_kg: float, minerio: Optional[str], materiais: Dict[str, dict]
) -> float:
    """
    Peso = Peso Base do Equipamento (Catalogo) x Multiplicador de Peso do
    Material -- formula exata da secao "Calculo de Peso de Equipamentos".
    Itens sem minerio definido (ferramentas, consumiveis, itens de
    sobrevivencia que nao sao feitos de metal) usam multiplicador 1.0.
    """
    if not minerio:
        return round(peso_base_kg, 3)
    multiplicador = materiais.get(minerio, {}).get("multiplicador_peso", 1.0)
    return round(peso_base_kg * multiplicador, 3)


def peso_total_inventario(
    inventario: List[dict], catalogo_itens: Dict[str, dict], materiais: Dict[str, dict]
) -> float:
    """Soma o peso efetivo de cada entrada do inventario, multiplicado pela
    quantidade. Cobre os DOIS formatos de entrada:
      - catalogada: `item_id` aponta pra um item real de itens.json --
        peso vem de `catalogo_itens[item_id]["peso_base_kg"]` x minerio.
      - avulsa/narrativa (ex.: itens do kit inicial de Origem que nao tem
        equivalente no catalogo mecanico -- ver entradas_kit_origem() mais
        abaixo): `item_id` e None, e o peso mora direto na propria entrada
        em `peso_base_kg` (sem multiplicador de minerio, porque esses
        itens nao tem minerio -- nao sao forjados).
    Entradas catalogadas cujo item_id nao existe mais no catalogo sao
    ignoradas silenciosamente (nao derruba o calculo do resto)."""
    total = 0.0
    for entrada in inventario:
        quantidade = max(0, int(entrada.get("quantidade", 1) or 1))
        if entrada.get("item_id"):
            item = catalogo_itens.get(entrada["item_id"])
            if item is None:
                continue
            peso_unitario = peso_efetivo_item(
                item.get("peso_base_kg", 0) or 0, entrada.get("minerio"), materiais
            )
        elif entrada.get("nome_livre"):
            peso_unitario = round(entrada.get("peso_base_kg", 0) or 0, 3)
        else:
            continue
        total += peso_unitario * quantidade
    return round(total, 3)


# ---------------------------------------------------------------------
# Sobrecarga e debilidade de movimento
# ---------------------------------------------------------------------

NIVEL_NORMAL = "normal"
NIVEL_SOBRECARREGADO = "sobrecarregado"
NIVEL_LIMITE_ABSOLUTO = "sobrecarregado_limite_absoluto"

# "Debilidade Fisica: o personagem sofre Desvantagem em todos os testes
# que envolvam as pericias de Atletismo, Acrobacia, Furtividade,
# Velocidade e Reflexo."
PERICIAS_COM_DESVANTAGEM_SOBRECARGA = [
    "atletismo", "acrobacia", "furtividade", "velocidade", "reflexo",
]


def estado_de_carga(
    peso_total_kg: float, capacidade_maxima_kg: float, deslocamento_base_m: float
) -> Dict[str, Any]:
    """
    Regras Mecanicas de Sobrecarga e Esforco Bruto (Peso, Notion):
      - Ate a capacidade maxima: sem penalidade nenhuma.
      - Acima dela ("Sobrecarregado"): -1,5m de Deslocamento pra cada 5kg
        de excesso (qualquer fracao de um bloco de 5kg ja conta o bloco
        inteiro -- a penalidade e' aplicada "imediatamente", nao so'
        quando o excesso bate um multiplo exato de 5), Desvantagem em
        Atletismo/Acrobacia/Furtividade/Velocidade/Reflexo, e essa reducao
        de Deslocamento NUNCA passa de METADE do Deslocamento original.
      - Acima do DOBRO da capacidade maxima ("Limite Absoluto"): o
        Deslocamento cai a 0 por completo -- essa condicao IGNORA o teto
        de "metade do deslocamento original" da regra anterior.

    Retorna o nivel de debilidade de movimento atual, quanto de
    Deslocamento sobra, e se ha Desvantagem em pericias.
    """
    limite_absoluto_kg = round(capacidade_maxima_kg * 2, 3)
    excesso_kg = round(peso_total_kg - capacidade_maxima_kg, 3)

    if excesso_kg <= 0:
        return {
            "nivel": NIVEL_NORMAL,
            "excesso_kg": 0.0,
            "reducao_deslocamento_m": 0.0,
            "deslocamento_final_m": deslocamento_base_m,
            "desvantagem_pericias": False,
            "pericias_afetadas": [],
            "capacidade_maxima_kg": round(capacidade_maxima_kg, 3),
            "limite_absoluto_kg": limite_absoluto_kg,
        }

    if peso_total_kg > limite_absoluto_kg:
        return {
            "nivel": NIVEL_LIMITE_ABSOLUTO,
            "excesso_kg": excesso_kg,
            "reducao_deslocamento_m": round(deslocamento_base_m, 3),
            "deslocamento_final_m": 0.0,
            "desvantagem_pericias": True,
            "pericias_afetadas": list(PERICIAS_COM_DESVANTAGEM_SOBRECARGA),
            "capacidade_maxima_kg": round(capacidade_maxima_kg, 3),
            "limite_absoluto_kg": limite_absoluto_kg,
        }

    blocos_de_5kg = math.ceil(excesso_kg / 5)
    reducao_bruta_m = 1.5 * blocos_de_5kg
    reducao_deslocamento_m = min(reducao_bruta_m, deslocamento_base_m / 2)
    return {
        "nivel": NIVEL_SOBRECARREGADO,
        "excesso_kg": excesso_kg,
        "reducao_deslocamento_m": round(reducao_deslocamento_m, 3),
        "deslocamento_final_m": round(deslocamento_base_m - reducao_deslocamento_m, 3),
        "desvantagem_pericias": True,
        "pericias_afetadas": list(PERICIAS_COM_DESVANTAGEM_SOBRECARGA),
        "capacidade_maxima_kg": round(capacidade_maxima_kg, 3),
        "limite_absoluto_kg": limite_absoluto_kg,
    }


# ---------------------------------------------------------------------
# Durabilidade
# ---------------------------------------------------------------------


def durabilidade_maxima_material(minerio: str, materiais: Dict[str, dict]) -> Optional[int]:
    """None = indestrutivel (Karnathite -- nunca perde pontos de
    durabilidade, nunca quebra)."""
    return materiais.get(minerio, {}).get("durabilidade_total")


def limiar_desgaste_material(minerio: str, materiais: Dict[str, dict]) -> Optional[int]:
    return materiais.get(minerio, {}).get("limiar_desgaste")


def registrar_acerto(
    durabilidade_atual: Optional[int],
    minerio: str,
    materiais: Dict[str, dict],
    alvo_protegido: bool = False,
) -> Dict[str, Any]:
    """
    Aplica a perda de durabilidade de UM ataque fisico bem-sucedido
    (secao "Regra de Desgaste e Quebra"): 1 ponto normalmente, 2 pontos se
    o alvo usava armadura ou tinha pele densa (`alvo_protegido=True`).
    Golpes esquivados/errados NAO consomem durabilidade -- por isso esta
    funcao so' deve ser chamada num ACERTO confirmado.

    Karnathite (material indestrutivel, durabilidade_total=None) nunca
    perde pontos e nunca quebra -- retorna a durabilidade como None,
    "quebrado" sempre False.

    O site nao rola dados por ninguem (ver nota equivalente em
    combate.js) -- entao esta funcao NAO rola o d12 de desgaste sozinha.
    Ela so' avisa (`exige_teste_d12_desgaste=True`) quando o item cruzou o
    Limiar de Desgaste: dali em diante, a cada acerto usando esse item o
    JOGADOR precisa rolar 1d12 na mesa -- um resultado "1" quebra o item
    na hora, independente de quanta durabilidade ainda reste.
    """
    maximo = durabilidade_maxima_material(minerio, materiais)
    if maximo is None:
        return {"durabilidade_atual": None, "quebrado": False, "exige_teste_d12_desgaste": False}

    atual = durabilidade_atual if durabilidade_atual is not None else maximo
    perda = 2 if alvo_protegido else 1
    novo = max(0, atual - perda)
    limiar = limiar_desgaste_material(minerio, materiais)
    quebrado = novo <= 0
    exige_teste = (not quebrado) and limiar is not None and novo <= limiar
    return {
        "durabilidade_atual": novo,
        "quebrado": quebrado,
        "exige_teste_d12_desgaste": exige_teste,
    }


def reparar_item(minerio: str, materiais: Dict[str, dict]) -> Dict[str, Any]:
    """Restaura a durabilidade cheia -- usada apos a habilidade Criar e
    Reparar da pericia Oficio numa cena de descanso (ver
    ferramentas-de-oficio no catalogo). Karnathite nao precisa disso
    (nunca perde durabilidade), mas a funcao responde de forma consistente
    mesmo assim."""
    maximo = durabilidade_maxima_material(minerio, materiais)
    return {"durabilidade_atual": maximo, "quebrado": False, "exige_teste_d12_desgaste": False}


if __name__ == "__main__":
    # Auto-teste simples: roda com `python -m api.motor.inventario` ou
    # `python inventario.py` a partir desta pasta.

    materiais = {
        "cobre": {"multiplicador_peso": 1.0, "durabilidade_total": 20, "limiar_desgaste": 2},
        "ferro": {"multiplicador_peso": 1.0, "durabilidade_total": 60, "limiar_desgaste": 6},
        "azurita": {"multiplicador_peso": 0.6, "durabilidade_total": 80, "limiar_desgaste": 8},
        "karnathite": {"multiplicador_peso": 1.3, "durabilidade_total": None, "limiar_desgaste": None},
    }

    # --- Capacidade de carga: bate exatamente com a tabela do Notion ---
    assert capacidade_carga_maxima_kg("medio", 0) == 30
    assert capacidade_carga_maxima_kg("pequeno", 3) == 35
    assert capacidade_carga_maxima_kg("grande", -1) == 40
    assert capacidade_carga_maxima_kg("medio", 2) == 50
    # Forca fora da faixa da tabela (ex.: +1 racial levando pra 4) usa a
    # coluna mais proxima (clamp), nao quebra nem extrapola.
    assert capacidade_carga_maxima_kg("medio", 4) == 65
    assert capacidade_carga_maxima_kg("medio", -3) == 20
    assert capacidade_esforco_bruto_kg(30) == 90

    # --- Peso efetivo: Peso Base x Multiplicador do Material ---
    assert peso_efetivo_item(2.0, "cobre", materiais) == 2.0
    assert peso_efetivo_item(2.0, "azurita", materiais) == 1.2
    assert peso_efetivo_item(1.0, None, materiais) == 1.0  # sem minerio -> so' o peso base

    catalogo_itens = {
        "espada-longa": {"peso_base_kg": 2.0},
        "gambeson": {"peso_base_kg": 4.0},
        "adaga-pequena": {"peso_base_kg": 0.4},
        "kit-de-arrombamento": {"peso_base_kg": 0.5},
    }
    inv = [
        {"item_id": "espada-longa", "minerio": "ferro", "quantidade": 1},
        {"item_id": "gambeson", "minerio": "cobre", "quantidade": 1},
        {"item_id": "item-que-nao-existe-mais", "minerio": "ferro", "quantidade": 5},
    ]
    # espada-longa em ferro (x1.0) = 2.0kg + gambeson em cobre (x1.0) = 4.0kg
    # o item inexistente eh ignorado silenciosamente
    assert peso_total_inventario(inv, catalogo_itens, materiais) == 6.0

    # Entrada avulsa/narrativa (sem item_id, peso na propria entrada) --
    # ex.: itens do kit de Origem sem equivalente no catalogo mecanico.
    inv_avulso = [
        {"item_id": None, "nome_livre": "Cachecol de seda", "peso_base_kg": 0.1, "quantidade": 1},
        {"item_id": None, "nome_livre": "Roupas coloridas", "peso_base_kg": 1.0, "quantidade": 1},
    ]
    assert peso_total_inventario(inv_avulso, catalogo_itens, materiais) == 1.1

    # --- Kit inicial de Origem -> entradas de inventario ---
    origem_criminoso = {
        "kit_itens": [
            {"nome": "Conjunto de gazuas", "tipo": "equipamento_catalogo", "item_id": "kit-de-arrombamento", "quantidade": 1},
            {"nome": "Adaga pequena (1d4+Destreza)", "tipo": "equipamento_catalogo", "item_id": "adaga-pequena", "quantidade": 1},
            {"nome": "Baralho marcado", "tipo": "equipamento", "peso_base_kg": 0.1, "quantidade": 1},
        ]
    }
    entradas = entradas_kit_origem("criminoso", origem_criminoso, materiais)
    assert len(entradas) == 3
    assert entradas[0]["item_id"] == "kit-de-arrombamento"
    assert entradas[0]["minerio"] == "cobre"
    assert entradas[0]["durabilidade_atual"] == 20  # maximo do cobre
    assert entradas[2]["item_id"] is None
    assert entradas[2]["nome_livre"] == "Baralho marcado"
    assert entradas[2]["peso_base_kg"] == 0.1
    assert entradas[2]["durabilidade_atual"] is None  # avulso, sem minerio, sem durabilidade

    # Moeda e companheiro nunca viram entrada de inventario.
    origem_mercador = {
        "kit_itens": [
            {"nome": "Balanca de precisão", "tipo": "equipamento", "peso_base_kg": 0.5, "quantidade": 1},
            {"nome": "Bolsa de moedas com 1d8 de Silberstuck", "tipo": "moeda"},
        ]
    }
    entradas_mercador = entradas_kit_origem("mercador", origem_mercador, materiais)
    assert len(entradas_mercador) == 1
    assert entradas_mercador[0]["nome_livre"] == "Balanca de precisão"

    origem_selvagem = {
        "kit_itens": [
            {"nome": "Colar de ossos", "tipo": "equipamento", "peso_base_kg": 0.1, "quantidade": 1},
            {"nome": "1 animal pequeno não combatente", "tipo": "companheiro"},
        ]
    }
    assert len(entradas_kit_origem("selvagem", origem_selvagem, materiais)) == 1

    # kit_origem_faltando: so' devolve o que ainda nao esta no inventario,
    # nunca duplica o que ja foi adicionado (comparando por origem_kit_id).
    faltando = kit_origem_faltando("criminoso", origem_criminoso, [], materiais)
    assert len(faltando) == 3
    inventario_parcial = [{"origem_kit_id": "criminoso:0"}]  # ja tem as gazuas
    faltando = kit_origem_faltando("criminoso", origem_criminoso, inventario_parcial, materiais)
    assert len(faltando) == 2
    assert all(e["origem_kit_id"] != "criminoso:0" for e in faltando)
    # item removido de proposito pelo jogador (sem origem_kit_id igual)
    # continua contando como "faltando" -- readicionar e' uma acao
    # explicita do jogador, nao acontece sozinho.
    faltando_tudo_de_novo = kit_origem_faltando("criminoso", origem_criminoso, [], materiais)
    assert len(faltando_tudo_de_novo) == 3

    # --- Estado de carga ---
    # Exatamente na capacidade -> normal, sem penalidade.
    r = estado_de_carga(30, 30, deslocamento_base_m=9)
    assert r["nivel"] == NIVEL_NORMAL
    assert r["deslocamento_final_m"] == 9

    # 4kg acima -> ja conta 1 bloco de 5kg (arredonda pra cima) -> -1,5m.
    r = estado_de_carga(34, 30, deslocamento_base_m=9)
    assert r["nivel"] == NIVEL_SOBRECARREGADO
    assert r["reducao_deslocamento_m"] == 1.5
    assert r["deslocamento_final_m"] == 7.5
    assert r["desvantagem_pericias"] is True

    # 12kg acima -> 3 blocos de 5kg -> -4,5m.
    r = estado_de_carga(42, 30, deslocamento_base_m=9)
    assert r["reducao_deslocamento_m"] == 4.5
    assert r["deslocamento_final_m"] == 4.5

    # Reducao nunca passa de metade do deslocamento original -- aqui 6
    # blocos de 5kg pediriam -9m, mas o teto trava em 4,5m (metade de 9).
    # peso_total=59 ainda fica ABAIXO do limite absoluto (60 = dobro de 30).
    r = estado_de_carga(59, 30, deslocamento_base_m=9)
    assert r["nivel"] == NIVEL_SOBRECARREGADO  # ainda nao passou do dobro (60)
    assert r["reducao_deslocamento_m"] == 4.5
    assert r["deslocamento_final_m"] == 4.5

    # Acima do dobro da capacidade -> Limite Absoluto, deslocamento ZERADO
    # por completo (ignora o teto de metade da regra anterior).
    r = estado_de_carga(61, 30, deslocamento_base_m=9)
    assert r["nivel"] == NIVEL_LIMITE_ABSOLUTO
    assert r["deslocamento_final_m"] == 0
    assert r["reducao_deslocamento_m"] == 9

    # --- Durabilidade ---
    # Acerto normal: -1 ponto.
    r = registrar_acerto(60, "ferro", materiais)
    assert r == {"durabilidade_atual": 59, "quebrado": False, "exige_teste_d12_desgaste": False}

    # Acerto em alvo protegido (armadura/pele densa): -2 pontos.
    r = registrar_acerto(60, "ferro", materiais, alvo_protegido=True)
    assert r["durabilidade_atual"] == 58

    # Cruzando o limiar de desgaste (ferro: limiar 6) -> passa a exigir
    # o teste de d12 nos proximos acertos.
    r = registrar_acerto(7, "ferro", materiais)
    assert r["durabilidade_atual"] == 6
    assert r["exige_teste_d12_desgaste"] is True
    assert r["quebrado"] is False

    # Durabilidade chegando a 0 -> quebra automaticamente, sem depender
    # do teste de d12 (ver regra: "Se a durabilidade do item chegar a 0
    # por qualquer motivo, ele quebra automaticamente").
    r = registrar_acerto(1, "ferro", materiais)
    assert r["durabilidade_atual"] == 0
    assert r["quebrado"] is True
    assert r["exige_teste_d12_desgaste"] is False  # ja quebrou, nao ha mais o que testar

    # durabilidade_atual=None (item novo, ainda nao usado) -> comeca do
    # maximo do material antes de aplicar a perda.
    r = registrar_acerto(None, "cobre", materiais)
    assert r["durabilidade_atual"] == 19  # 20 (max do cobre) - 1

    # Karnathite: indestrutivel, nunca perde durabilidade nem quebra.
    r = registrar_acerto(9999, "karnathite", materiais, alvo_protegido=True)
    assert r == {"durabilidade_atual": None, "quebrado": False, "exige_teste_d12_desgaste": False}

    # Reparar: volta pro maximo do material.
    r = reparar_item("azurita", materiais)
    assert r["durabilidade_atual"] == 80
    assert r["quebrado"] is False

    print("inventario.py: todos os auto-testes passaram.")
