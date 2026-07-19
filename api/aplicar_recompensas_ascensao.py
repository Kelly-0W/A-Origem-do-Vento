from http.server import BaseHTTPRequestHandler
import json

from firebase_admin import firestore

from api.motor.catalogo import carregar_catalogo
from api.motor.constantes import recompensas_do_grau
from api.motor.ficha import calcular_ficha
from api.motor.persistencia import buscar_personagem, atualizar_personagem


def _origem_pertence_ao_pool(origem_pick: str, origem_exigida: str) -> bool:
    """
    `origem_pick` e' de onde o JOGADOR diz que tirou a habilidade
    ("classe", "raca_global" ou "raca_linhagem"). `origem_exigida' e' o que
    a RECOMPENSA desse grau pede ("classe", "raca" ou "classe_ou_raca").
    "raca_global" e "raca_linhagem" contam igual pra fins de "raca".
    """
    pool = "raca" if origem_pick in ("raca_global", "raca_linhagem") else "classe"
    if origem_exigida == "classe_ou_raca":
        return True
    return pool == origem_exigida


def _casar_picks_de_habilidade(exigidos, picks):
    """
    Casa cada recompensa de habilidade exigida nesse grau (`exigidos`, uma
    lista de {"origem": "classe"|"raca"|"classe_ou_raca"}) com uma escolha
    do jogador (`picks`, lista de {"origem": "classe"|"raca_global"|
    "raca_linhagem", "id": ...}).

    Processa as exigencias mais restritivas primeiro (origem fixa) e deixa
    "classe_ou_raca" (mais flexivel) por ultimo, pra nao "gastar" um pick
    de classe/raca fixo numa exigencia flexivel por acaso de ordenacao.

    Retorna (pares, erros) onde pares e' uma lista de (exigido, pick).
    """
    erros = []
    pares = []
    restantes = list(picks)

    exigidos_ordenados = sorted(
        exigidos, key=lambda r: 0 if r.get("origem") != "classe_ou_raca" else 1
    )
    for exigido in exigidos_ordenados:
        origem_exigida = exigido.get("origem")
        candidato = next(
            (p for p in restantes if _origem_pertence_ao_pool(p.get("origem"), origem_exigida)),
            None,
        )
        if candidato is None:
            erros.append(
                f"Falta escolher 1 habilidade de origem '{origem_exigida}' pra completar "
                "as recompensas deste grau."
            )
            continue
        restantes.remove(candidato)
        pares.append((exigido, candidato))

    return pares, erros


def _aplicar_recompensas(personagem, escolhas_recompensa, grau_alvo, catalogo):
    """
    Valida e mescla as habilidades escolhidas em `escolhas_recompensa` nas
    `escolhas` salvas do personagem, seguindo exatamente as recompensas de
    tipo "habilidade" definidas pra `grau_alvo` em constantes_ascensao.json.

    "Treinamento de Pericia" nao entra aqui: essa recompensa e' so'
    informativa (ver PainelAscensao.jsx) porque o jogador ja pode
    treinar/destreinar pericias livremente na propria ficha (pericias_manuais,
    ver motor/pericias.py) -- nao ha' o que "aplicar" formalmente pra ela.

    Retorna (escolhas_atualizadas, erros). erros vazio == pode prosseguir.
    """
    erros = []
    escolhas = dict(personagem.get("escolhas") or {})
    hab_escolhidas_atual = escolhas.get("habilidades_escolhidas") or {}
    hab_atualizadas = {
        "raca_globais": list(hab_escolhidas_atual.get("raca_globais", [])),
        "raca_linhagem": list(hab_escolhidas_atual.get("raca_linhagem", [])),
        "classe": list(hab_escolhidas_atual.get("classe", [])),
    }

    graus_config = catalogo.get("constantes_ascensao", {}).get("graus", {})
    exigidos_habilidade = [
        r for r in recompensas_do_grau(grau_alvo, graus_config) if r.get("tipo") == "habilidade"
    ]

    picks_habilidade = escolhas_recompensa.get("habilidades", [])

    if len(picks_habilidade) != len(exigidos_habilidade):
        erros.append(
            f"Este grau concede {len(exigidos_habilidade)} habilidade(s) de recompensa "
            f"(recebido: {len(picks_habilidade)})."
        )
        return None, erros

    raca = catalogo.get("racas", {}).get(escolhas.get("raca_id"))
    classe = catalogo.get("classes", {}).get(escolhas.get("classe_id"))
    linhagem_id = escolhas.get("linhagem_id")

    ids_globais_validos = {h["id"] for h in (raca or {}).get("habilidades_globais", [])}
    ids_especificas_validos = {
        h["id"] for h in (raca or {}).get("habilidades_especificas", [])
        if h.get("linhagem_id") == linhagem_id
    }
    ids_classe_validos = {h["id"] for h in (classe or {}).get("habilidades", [])}

    ja_escolhidas = set(hab_atualizadas["raca_globais"]) | set(hab_atualizadas["raca_linhagem"]) | set(hab_atualizadas["classe"])

    pares, erros_pareamento = _casar_picks_de_habilidade(exigidos_habilidade, picks_habilidade)
    erros.extend(erros_pareamento)

    for exigido, pick in pares:
        pick_id = pick.get("id")
        pick_origem = pick.get("origem")

        if pick_id in ja_escolhidas:
            erros.append(f"Habilidade '{pick_id}' ja foi escolhida antes por este personagem.")
            continue

        if pick_origem == "classe":
            if pick_id not in ids_classe_validos:
                erros.append(f"Habilidade '{pick_id}' nao pertence a classe deste personagem.")
                continue
            hab_atualizadas["classe"].append(pick_id)
        elif pick_origem == "raca_global":
            if pick_id not in ids_globais_validos:
                erros.append(f"Habilidade '{pick_id}' nao pertence as habilidades globais da raca.")
                continue
            hab_atualizadas["raca_globais"].append(pick_id)
        elif pick_origem == "raca_linhagem":
            if pick_id not in ids_especificas_validos:
                erros.append(f"Habilidade '{pick_id}' nao pertence a linhagem deste personagem.")
                continue
            hab_atualizadas["raca_linhagem"].append(pick_id)
        else:
            erros.append(f"Origem de habilidade invalida: '{pick_origem}' (use classe, raca_global ou raca_linhagem).")
            continue

        ja_escolhidas.add(pick_id)

    if erros:
        return None, erros

    escolhas["habilidades_escolhidas"] = hab_atualizadas
    return escolhas, []


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """
        POST /api/aplicar_recompensas_ascensao
        Corpo: {
          "personagem_id": "...",
          "dono_uid": "uid de quem esta pedindo (precisa ser o dono)",
          "escolhas_recompensa": {
            "habilidades": [ { "origem": "classe"|"raca_global"|"raca_linhagem", "id": "..." }, ... ]
          }
        }

        So funciona quando ascensao_em_progresso.status == "aguardando_recompensas"
        (ou seja: ou o personagem nao esta em nenhuma campanha e os 3 pilares
        ja foram marcados, ou esta numa campanha e o Mestre ja aprovou pelo
        Painel do Mestre). Mescla as habilidades escolhidas nas `escolhas`
        salvas, recalcula a ficha inteira no novo grau (reusando o mesmo
        motor da criacao) e so' entao efetiva: grava grau_ascensao,
        calculado, uma entrada nova em `manifestacoes`, e zera
        ascensao_em_progresso pro proximo ciclo.
        """
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            corpo = json.loads(self.rfile.read(content_length) or b"{}")

            personagem_id = corpo.get("personagem_id")
            dono_uid = corpo.get("dono_uid")
            escolhas_recompensa = corpo.get("escolhas_recompensa") or {}

            if not personagem_id or not dono_uid:
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["'personagem_id' e 'dono_uid' sao obrigatorios."],
                })
                return

            personagem = buscar_personagem(personagem_id)
            if personagem is None:
                self._responder(404, {"sucesso": False, "erros": ["Personagem nao encontrado."]})
                return
            if personagem.get("dono_uid") != dono_uid:
                self._responder(403, {
                    "sucesso": False,
                    "erros": ["Somente o dono deste personagem pode aplicar recompensas de Ascensao."],
                })
                return

            ascensao = personagem.get("ascensao_em_progresso") or {}
            if ascensao.get("status") != "aguardando_recompensas":
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["Este personagem nao tem recompensas de Ascensao aguardando escolha."],
                })
                return

            grau_alvo = ascensao.get("grau_alvo")
            if not isinstance(grau_alvo, int):
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["'grau_alvo' invalido no pedido de Ascensao deste personagem."],
                })
                return

            catalogo = carregar_catalogo()

            escolhas_atualizadas, erros_recompensa = _aplicar_recompensas(
                personagem, escolhas_recompensa, grau_alvo, catalogo
            )
            if erros_recompensa:
                self._responder(400, {"sucesso": False, "erros": erros_recompensa})
                return

            sucesso, resultado = calcular_ficha(escolhas_atualizadas, catalogo, grau_ascensao=grau_alvo)
            if not sucesso:
                self._responder(400, {
                    "sucesso": False,
                    "erros": ["Nao foi possivel recalcular a ficha com essas recompensas."] + resultado.get("erros", []),
                })
                return

            nova_manifestacao = {
                "grau": grau_alvo,
                "descricao": ascensao.get("descricao_manifestacao") or "",
                "imagem_url": None,
            }
            manifestacoes = list(personagem.get("manifestacoes") or []) + [nova_manifestacao]

            atualizar_personagem(personagem_id, {
                "escolhas": escolhas_atualizadas,
                "calculado": resultado["calculado"],
                "grau_ascensao": grau_alvo,
                "manifestacoes": manifestacoes,
                "ascensao_em_progresso": {
                    "grau_alvo": None,
                    "catalisador": False,
                    "provacao": False,
                    "ritual": False,
                    "descricao_manifestacao": "",
                    "status": "nenhuma",
                    "respondido_por_uid": ascensao.get("respondido_por_uid"),
                    "respondido_em": firestore.SERVER_TIMESTAMP,
                },
                "atualizado_em": firestore.SERVER_TIMESTAMP,
            })

            self._responder(200, {
                "sucesso": True,
                "grau_ascensao": grau_alvo,
                "escolhas": escolhas_atualizadas,
                "calculado": resultado["calculado"],
            })

        except Exception as e:
            self._responder(500, {"sucesso": False, "erros": [f"Erro interno no servidor: {str(e)}"]})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _responder(self, status_code, resposta):
        self.send_response(status_code)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(resposta, ensure_ascii=False, default=str).encode("utf-8"))
