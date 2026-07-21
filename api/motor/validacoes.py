"""
Validacao das ESCOLHAS de criacao de personagem contra o catalogo de regras
de "A Origem do Vento" (racas, classes, origens, pericias, elementos).

IMPORTANTE: este motor e especifico deste sistema -- atributos sao
for/des/con/int/sab/car com 10 pontos para distribuir (nao "forca,
agilidade, intelecto, vigor, presenca" com 20 pontos), pericias sao
treinada/destreinada com bonus por Grau de Ascensao (nao "ranks"), e nao
existe atributo "mana". Ver docs/schema-banco-dados-personagem.md para o
formato completo do catalogo e das escolhas.
"""
import logging
from typing import Any, Dict, List, Tuple

from .atributos import validar_distribuicao_atributos
from .constantes import contar_habilidades_extras_ate_grau

logger = logging.getLogger(__name__)


def validar_escolhas_personagem(
    escolhas: Dict[str, Any], catalogo: Dict[str, Any], grau_ascensao: int = 0
) -> Tuple[bool, List[str]]:
    """
    escolhas: o que o jogador escolheu na criacao. Formato esperado:
        {
          "raca_id": "anao", "linhagem_id": "ferro" | None,
          "classe_id": "gladiador", "subclasse_id": None,
          "origem_id": "artista", "origem_pericia_escolhida": "enganacao",
          "elemento_id": "agua", "poderes_escolhidos": ["tiro-dagua", "bolha-dagua"],
          "confirma_elegibilidade_elemento": False,     # so importa p/ Caca
          "espiritual_escolhido": None,                  # so p/ Caca
          "sagracantico_deus_id": None,                  # opcional -- ver seed/dados/sagracanticos.json
          "atributos": {"for": 1, "des": 2, "con": 3, "int": -1, "sab": 2, "car": 3},
          "pericias_treinadas": ["enganacao", "luta"],
          "habilidades_escolhidas": {
              "raca_globais": [...], "raca_linhagem": [...], "classe": [...]
          },
        }

    catalogo: dict com as colecoes carregadas do Firestore/JSON:
        {"racas": {...}, "classes": {...}, "origens": {...}, "pericias": {...},
         "elementos": {...}, "itens": {...}, "constantes_ascensao": {...},
         "sagracanticos": {...}}

    grau_ascensao: o grau ATUAL da ficha sendo validada (0 na criacao). O
    total esperado de habilidades de raca+classe cresce com o grau -- cada
    recompensa de Ascensao de tipo "habilidade" (ver constantes_ascensao.json)
    libera mais uma escolha. Sem isso, validar uma ficha que ja passou por
    Ascensao rejeitaria como "excesso" as habilidades ganhas de recompensa.

    Retorna (valido, lista_de_erros). Lista vazia == valido.
    """
    erros: List[str] = []

    campos_obrigatorios = [
        "raca_id", "classe_id", "origem_id", "origem_pericia_escolhida",
        "elemento_id", "atributos", "pericias_treinadas", "habilidades_escolhidas",
    ]
    for campo in campos_obrigatorios:
        if campo not in escolhas:
            erros.append(f"Campo obrigatorio ausente nas escolhas: '{campo}'.")
    if erros:
        # sem os campos base nao da pra validar o resto com seguranca
        return False, erros

    racas = catalogo.get("racas", {})
    classes = catalogo.get("classes", {})
    origens = catalogo.get("origens", {})
    pericias_catalogo = catalogo.get("pericias", {})
    elementos = catalogo.get("elementos", {})

    hab_escolhidas = escolhas.get("habilidades_escolhidas", {})

    # ---- Atributos ----
    _, erros_attr = validar_distribuicao_atributos(escolhas["atributos"])
    erros.extend(erros_attr)

    # ---- Raça, Linhagem e habilidades raciais ----
    raca_id = escolhas["raca_id"]
    raca = racas.get(raca_id)
    linhagem = None
    if raca is None:
        erros.append(f"Raca '{raca_id}' nao existe no catalogo.")
    else:
        linhagens = raca.get("linhagens", [])
        linhagem_id = escolhas.get("linhagem_id")

        if linhagens:
            if not linhagem_id:
                erros.append(
                    f"A raca '{raca_id}' possui linhagens; e obrigatorio escolher uma.")
            else:
                linhagem = next(
                    (l for l in linhagens if l.get("id") == linhagem_id), None)
                if linhagem is None:
                    ids_validos = [l.get("id") for l in linhagens]
                    erros.append(
                        f"Linhagem '{linhagem_id}' nao existe para a raca '{raca_id}'. "
                        f"Opcoes: {ids_validos}."
                    )
        elif linhagem_id:
            erros.append(
                f"A raca '{raca_id}' nao possui linhagens, mas 'linhagem_id' foi enviado.")

        # habilidades de raça escolhidas (globais + especificas da linhagem)
        # -- SO a validade de cada id e checada aqui; a CONTAGEM total (que
        # depende do grau_ascensao) e checada mais abaixo, junto com a classe.
        globais_escolhidas = hab_escolhidas.get("raca_globais", [])
        especificas_escolhidas = hab_escolhidas.get("raca_linhagem", [])

        ids_globais_validos = {h["id"]
                               for h in raca.get("habilidades_globais", [])}
        for hid in globais_escolhidas:
            if hid not in ids_globais_validos:
                erros.append(
                    f"Habilidade global '{hid}' nao pertence a raca '{raca_id}'.")

        # habilidades_especificas fica achatada no nivel da RACA, cada item
        # marcado com 'linhagem_id' -- nao aninhada dentro de cada linhagem.
        if especificas_escolhidas and linhagem is None:
            erros.append(
                "Foram escolhidas habilidades especificas de linhagem, mas nenhuma "
                "linhagem valida foi selecionada."
            )
        elif especificas_escolhidas and linhagem is not None:
            ids_especificas_validos = {
                h["id"]
                for h in raca.get("habilidades_especificas", [])
                if h.get("linhagem_id") == linhagem["id"]
            }
            for hid in especificas_escolhidas:
                if hid not in ids_especificas_validos:
                    erros.append(
                        f"Habilidade especifica '{hid}' nao pertence a linhagem "
                        f"'{linhagem['id']}' da raca '{raca_id}'."
                    )

    # ---- Classe ----
    classe_id = escolhas["classe_id"]
    classe = classes.get(classe_id)
    if classe is None:
        erros.append(f"Classe '{classe_id}' nao existe no catalogo.")
    else:
        hab_classe_escolhidas = hab_escolhidas.get("classe", [])

        ids_hab_classe_validas = {h["id"]
                                  for h in classe.get("habilidades", [])}
        for hid in hab_classe_escolhidas:
            if hid not in ids_hab_classe_validas:
                erros.append(
                    f"Habilidade '{hid}' nao pertence a classe '{classe_id}'.")

        # subclasse exige 3 habilidades da classe normal ja adquiridas -- nao
        # pode ser escolhida na criacao (Grau 0).
        if escolhas.get("subclasse_id"):
            erros.append(
                "Subclasse nao pode ser escolhida na criacao do personagem "
                "(exige 3 habilidades previas da classe normal)."
            )

    # ---- Contagem total de habilidades de raça+classe (grau-aware) ----
    # Feita depois dos dois blocos acima (precisa de raca E classe resolvidas)
    # porque uma recompensa "classe_ou_raca" pode entrar em qualquer uma das
    # duas listas -- por isso o total e' checado em conjunto, nao separado
    # por raca/classe.
    #
    # Habilidades marcadas "inata": true no catalogo (ex.: Asas de Amion da
    # Fada) sao concedidas automaticamente a todo personagem da raca/
    # linhagem e NAO consomem uma das qtd_habilidades_iniciais escolhidas --
    # por isso sao excluidas da contagem abaixo, quer o frontend as envie
    # junto em habilidades_escolhidas ou nao.
    if raca is not None and classe is not None:
        ids_inatas = {
            h["id"] for h in raca.get("habilidades_globais", []) if h.get("inata")
        } | {
            h["id"] for h in raca.get("habilidades_especificas", []) if h.get("inata")
        }

        qtd_base_raca = raca.get("qtd_habilidades_iniciais", 2)
        qtd_base_classe = classe.get("qtd_habilidades_iniciais", 1)
        extras_por_ascensao = contar_habilidades_extras_ate_grau(
            grau_ascensao, catalogo.get(
                "constantes_ascensao", {}).get("graus", {})
        )
        qtd_esperada_total = qtd_base_raca + qtd_base_classe + extras_por_ascensao

        raca_globais_contaveis = [
            hid for hid in hab_escolhidas.get("raca_globais", []) if hid not in ids_inatas
        ]
        raca_linhagem_contaveis = [
            hid for hid in hab_escolhidas.get("raca_linhagem", []) if hid not in ids_inatas
        ]
        total_hab_escolhidas = (
            len(raca_globais_contaveis)
            + len(raca_linhagem_contaveis)
            + len(hab_escolhidas.get("classe", []))
        )
        if total_hab_escolhidas != qtd_esperada_total:
            erros.append(
                f"Este personagem deveria ter exatamente {qtd_esperada_total} habilidade(s) de "
                f"raca/classe no Grau {grau_ascensao} ({qtd_base_raca} da raca + {qtd_base_classe} "
                f"da classe, no Grau 0, + {extras_por_ascensao} ganha(s) em Ascensoes anteriores), "
                f"recebido: {total_hab_escolhidas} (habilidades inatas nao contam nessa conta)."
            )

    # multiclasse: no maximo 2 classes simultaneas, se o formulario usar
    # uma lista 'classes_ids' em vez de 'classe_id' unico.
    classes_ids = escolhas.get("classes_ids")
    if classes_ids is not None and len(classes_ids) > 2:
        erros.append(
            f"Multiclasse permite no maximo 2 classes simultaneas (recebido: {len(classes_ids)}).")

    # ---- Origem ----
    origem_id = escolhas["origem_id"]
    origem = origens.get(origem_id)
    if origem is None:
        erros.append(f"Origem '{origem_id}' nao existe no catalogo.")
    else:
        pericia_escolhida = escolhas["origem_pericia_escolhida"]
        opcoes_bruto = origem.get("pericias_opcoes", [])
        # cada opcao e um objeto {"pericia_id": ..., "nota": ...}, nao uma string direta
        opcoes = [o["pericia_id"] if isinstance(
            o, dict) else o for o in opcoes_bruto]
        if pericia_escolhida not in opcoes:
            erros.append(
                f"A pericia '{pericia_escolhida}' nao esta entre as opcoes da origem "
                f"'{origem_id}' ({opcoes})."
            )

    # ---- Pericias treinadas: existem no catalogo + coerentes com classe/origem ----
    pericias_treinadas = escolhas.get("pericias_treinadas", [])
    for pid in pericias_treinadas:
        if pid not in pericias_catalogo:
            erros.append(f"Pericia '{pid}' nao existe no catalogo.")

    pericias_esperadas = set()
    if classe is not None and classe.get("pericia_treinada_fixa"):
        pericias_esperadas.add(classe["pericia_treinada_fixa"])
    if origem is not None and escolhas.get("origem_pericia_escolhida"):
        pericias_esperadas.add(escolhas["origem_pericia_escolhida"])
    faltando_pericias = pericias_esperadas - set(pericias_treinadas)
    if faltando_pericias:
        erros.append(
            f"As pericias garantidas pela classe/origem precisam constar em "
            f"'pericias_treinadas' (faltando: {sorted(faltando_pericias)})."
        )

    # ---- Elemento de Manipulação (obrigatório para TODO personagem) ----
    elemento_id = escolhas["elemento_id"]
    elemento = elementos.get(elemento_id)
    if elemento is None:
        erros.append(f"Elemento '{elemento_id}' nao existe no catalogo.")
    else:
        restricao = elemento.get("restricao_elegibilidade")
        if restricao and not escolhas.get("confirma_elegibilidade_elemento"):
            erros.append(
                f"O elemento '{elemento_id}' tem restricao de elegibilidade "
                f"({restricao.get('condicao', restricao)}); marque "
                f"'confirma_elegibilidade_elemento' apos o Mestre validar a condicao."
            )

        if elemento_id == "caca":
            # Caça tem estrutura própria: poder universal + espirituais.
            espirituais_validos = set(elemento.get("espirituais", {}).keys())
            espiritual_escolhido = escolhas.get("espiritual_escolhido")
            if not espiritual_escolhido:
                erros.append(
                    "O elemento Caca exige a escolha de 1 espiritual em 'espiritual_escolhido'.")
            elif espiritual_escolhido not in espirituais_validos:
                erros.append(
                    f"Espiritual '{espiritual_escolhido}' nao existe para Caca. "
                    f"Opcoes: {sorted(espirituais_validos)}."
                )
            if escolhas.get("poderes_escolhidos"):
                erros.append(
                    "O elemento Caca nao usa 'poderes_escolhidos' -- use 'espiritual_escolhido'.")
        else:
            poderes_validos = set(elemento.get("poderes", {}).keys())
            poderes_escolhidos = escolhas.get("poderes_escolhidos", [])
            if len(poderes_escolhidos) != 2:
                erros.append(
                    f"E preciso escolher exatamente 2 poderes iniciais do elemento "
                    f"'{elemento_id}' (recebido: {len(poderes_escolhidos)})."
                )
            for pid in poderes_escolhidos:
                if pid not in poderes_validos:
                    erros.append(
                        f"Poder '{pid}' nao pertence ao elemento '{elemento_id}'.")

    # ---- Sagracântico (opcional -- None/ausente = personagem comum) ----
    # Quem e Sagracantico de um deus manipula OBRIGATORIAMENTE o elemento
    # daquele deus (nao e escolha livre), e algumas racas sao vetadas por
    # certos deuses (ex.: Nidhogg nao aceita humanos nem draconatos --
    # ver seed/dados/sagracanticos.json).
    sagracantico_deus_id = escolhas.get("sagracantico_deus_id")
    if sagracantico_deus_id:
        deuses = catalogo.get("sagracanticos", {}).get("deuses", {})
        deus = deuses.get(sagracantico_deus_id)
        if deus is None:
            erros.append(
                f"Deus '{sagracantico_deus_id}' nao existe no catalogo de Sagracanticos."
            )
        else:
            elemento_esperado = deus.get("elemento_id")
            if elemento_esperado and escolhas.get("elemento_id") != elemento_esperado:
                erros.append(
                    f"Sagracanticos de '{deus.get('nome', sagracantico_deus_id)}' manipulam "
                    f"obrigatoriamente '{elemento_esperado}' (recebido elemento: "
                    f"'{escolhas.get('elemento_id')}')."
                )
            racas_restritas = deus.get(
                "restricao_arautos", {}).get("racas_restritas", [])
            if escolhas.get("raca_id") in racas_restritas:
                erros.append(
                    f"A raca '{escolhas.get('raca_id')}' nao pode ser Sagracantica de "
                    f"'{deus.get('nome', sagracantico_deus_id)}'."
                )

    sucesso = len(erros) == 0
    if not sucesso:
        logger.info(
            "Validacao de escolhas de personagem falhou com %d erro(s).", len(erros))
    return sucesso, erros
