/**
 * frontend/src/lib/inventario.js
 *
 * Espelho em JS de api/motor/inventario.py -- as MESMAS contas de peso,
 * capacidade de carga, sobrecarga/debilidade de movimento e durabilidade,
 * pra dar feedback instantâneo na tela (PainelInventario.jsx) sem
 * precisar de um round-trip ao servidor pra cada item adicionado/removido.
 *
 * Fonte das regras: Seção 3 (Engine) > página "Peso" no Notion, mais os
 * Modificadores por Minério do Catálogo de Itens. Se as regras do Notion
 * mudarem, atualize os DOIS lados (aqui e o .py) juntos.
 */

export const PORTES_VALIDOS = ['pequeno', 'medio', 'grande'];

// Kg suportados continuamente, cruzando Porte Biológico x Força final.
// Só definida pra Força entre -1 e 3 -- fora dessa faixa, usa a coluna
// mais próxima (clamp), porque a tabela do Notion não define nada além.
const TABELA_CARGA_MAXIMA_KG = {
  pequeno: { '-1': 10, 0: 15, 1: 20, 2: 25, 3: 35 },
  medio: { '-1': 20, 0: 30, 1: 40, 2: 50, 3: 65 },
  grande: { '-1': 40, 0: 55, 1: 70, 2: 85, 3: 110 },
};

export function capacidadeCargaMaximaKg(porteBiologico, forcaFinal) {
  const tabela = TABELA_CARGA_MAXIMA_KG[porteBiologico];
  if (!tabela) {
    throw new Error(
      `Porte biológico desconhecido: ${porteBiologico}. Esperado um de ${PORTES_VALIDOS.join(', ')}.`
    );
  }
  const forcaNaTabela = Math.max(-1, Math.min(3, forcaFinal));
  return tabela[String(forcaNaTabela)];
}

/** Erguer/Empurrar/Arrastar: até 3x a capacidade de carga base -- esforço
 * pontual, não é carga contínua, não sofre penalidade de Sobrecarga. */
export function capacidadeEsforcoBrutoKg(capacidadeMaximaKg) {
  return round3(capacidadeMaximaKg * 3);
}

/** Peso = Peso Base do item (Catálogo) x Multiplicador de Peso do
 * material. Itens sem minério (ferramentas, consumíveis, etc.) usam
 * multiplicador 1.0. */
export function pesoEfetivoItem(pesoBaseKg, minerio, materiais) {
  if (!minerio) return round3(pesoBaseKg);
  const multiplicador = materiais?.[minerio]?.multiplicador_peso ?? 1.0;
  return round3(pesoBaseKg * multiplicador);
}

/** Soma o peso efetivo x quantidade de cada entrada do inventário. Cobre
 * os dois formatos: catalogado (item_id aponta pra itens.json, peso via
 * peso_base_kg x minério) e avulso/narrativo (item_id null, peso mora
 * direto na entrada em peso_base_kg, sem minério -- ver ORIGEM dos itens
 * de kit de Origem em entradasKitOrigem()). Entradas catalogadas cujo
 * item_id não existe mais no catálogo são ignoradas. */
export function pesoTotalInventario(inventario, catalogoItens, materiais) {
  let total = 0;
  for (const entrada of inventario || []) {
    const quantidade = Math.max(0, Number(entrada.quantidade ?? 1) || 0);
    let pesoUnitario;
    if (entrada.item_id) {
      const item = catalogoItens?.[entrada.item_id];
      if (!item) continue;
      pesoUnitario = pesoEfetivoItem(item.peso_base_kg || 0, entrada.minerio, materiais);
    } else if (entrada.nome_livre) {
      pesoUnitario = round3(entrada.peso_base_kg || 0);
    } else {
      continue;
    }
    total += pesoUnitario * quantidade;
  }
  return round3(total);
}

export const NIVEL_NORMAL = 'normal';
export const NIVEL_SOBRECARREGADO = 'sobrecarregado';
export const NIVEL_LIMITE_ABSOLUTO = 'sobrecarregado_limite_absoluto';

// "Debilidade Física: o personagem sofre Desvantagem em todos os testes
// que envolvam Atletismo, Acrobacia, Furtividade, Velocidade e Reflexo."
export const PERICIAS_COM_DESVANTAGEM_SOBRECARGA = [
  'atletismo', 'acrobacia', 'furtividade', 'velocidade', 'reflexo',
];

/**
 * Regras de Sobrecarga (Peso, Notion):
 *  - Até a capacidade máxima: sem penalidade.
 *  - Acima dela: -1,5m de Deslocamento a cada 5kg de excesso (qualquer
 *    fração de bloco já conta o bloco inteiro), Desvantagem nas 5 perícias
 *    acima, e a redução nunca passa de METADE do Deslocamento original.
 *  - Acima do DOBRO da capacidade (Limite Absoluto): Deslocamento cai a 0
 *    por completo -- ignora o teto de "metade" da regra anterior.
 */
export function estadoDeCarga(pesoTotalKg, capacidadeMaximaKg, deslocamentoBaseM) {
  const limiteAbsolutoKg = round3(capacidadeMaximaKg * 2);
  const excessoKg = round3(pesoTotalKg - capacidadeMaximaKg);

  if (excessoKg <= 0) {
    return {
      nivel: NIVEL_NORMAL,
      excessoKg: 0,
      reducaoDeslocamentoM: 0,
      deslocamentoFinalM: deslocamentoBaseM,
      desvantagemPericias: false,
      periciasAfetadas: [],
      capacidadeMaximaKg: round3(capacidadeMaximaKg),
      limiteAbsolutoKg,
    };
  }

  if (pesoTotalKg > limiteAbsolutoKg) {
    return {
      nivel: NIVEL_LIMITE_ABSOLUTO,
      excessoKg,
      reducaoDeslocamentoM: round3(deslocamentoBaseM),
      deslocamentoFinalM: 0,
      desvantagemPericias: true,
      periciasAfetadas: [...PERICIAS_COM_DESVANTAGEM_SOBRECARGA],
      capacidadeMaximaKg: round3(capacidadeMaximaKg),
      limiteAbsolutoKg,
    };
  }

  const blocosDe5kg = Math.ceil(excessoKg / 5);
  const reducaoBrutaM = 1.5 * blocosDe5kg;
  const reducaoDeslocamentoM = Math.min(reducaoBrutaM, deslocamentoBaseM / 2);
  return {
    nivel: NIVEL_SOBRECARREGADO,
    excessoKg,
    reducaoDeslocamentoM: round3(reducaoDeslocamentoM),
    deslocamentoFinalM: round3(deslocamentoBaseM - reducaoDeslocamentoM),
    desvantagemPericias: true,
    periciasAfetadas: [...PERICIAS_COM_DESVANTAGEM_SOBRECARGA],
    capacidadeMaximaKg: round3(capacidadeMaximaKg),
    limiteAbsolutoKg,
  };
}

// ---- Durabilidade ----

/** null = indestrutível (Karnathite -- nunca perde durabilidade, nunca quebra). */
export function durabilidadeMaximaMaterial(minerio, materiais) {
  return materiais?.[minerio]?.durabilidade_total ?? null;
}

export function limiarDesgasteMaterial(minerio, materiais) {
  return materiais?.[minerio]?.limiar_desgaste ?? null;
}

/**
 * Aplica a perda de durabilidade de UM acerto físico confirmado: 1 ponto
 * normalmente, 2 se o alvo usava armadura/pele densa (`alvoProtegido`).
 * Golpes que erraram não chamam esta função.
 *
 * O site não rola dados por ninguém -- então isto NÃO rola o d12 de
 * desgaste sozinho, só avisa (`exigeTesteD12Desgaste: true`) quando o
 * item cruzou o Limiar de Desgaste: dali em diante, cada acerto exige que
 * o jogador role 1d12 na mesa (um "1" quebra o item na hora).
 */
export function registrarAcerto(durabilidadeAtual, minerio, materiais, alvoProtegido = false) {
  const maximo = durabilidadeMaximaMaterial(minerio, materiais);
  if (maximo === null) {
    return { durabilidadeAtual: null, quebrado: false, exigeTesteD12Desgaste: false };
  }
  const atual = durabilidadeAtual ?? maximo;
  const perda = alvoProtegido ? 2 : 1;
  const novo = Math.max(0, atual - perda);
  const limiar = limiarDesgasteMaterial(minerio, materiais);
  const quebrado = novo <= 0;
  const exigeTeste = !quebrado && limiar !== null && novo <= limiar;
  return { durabilidadeAtual: novo, quebrado, exigeTesteD12Desgaste: exigeTeste };
}

/** Restaura a durabilidade cheia (habilidade Criar e Reparar de Ofício
 * numa cena de descanso). */
export function repararItem(minerio, materiais) {
  const maximo = durabilidadeMaximaMaterial(minerio, materiais);
  return { durabilidadeAtual: maximo, quebrado: false, exigeTesteD12Desgaste: false };
}

// ---------------------------------------------------------------------
// Kit inicial de Origem -> entradas de inventário
// ---------------------------------------------------------------------
//
// Espelho de entradas_kit_origem()/kit_origem_faltando() em
// api/motor/inventario.py -- ver o comentário grande lá pra entender os
// 4 tipos de item de kit (equipamento_catalogo / equipamento / moeda /
// companheiro) e por que moeda e companheiro nunca viram entrada de
// inventário.

function entradaDeKitItem(origemId, indice, kitItem, materiais) {
  const tipo = kitItem.tipo;
  if (tipo === 'moeda' || tipo === 'companheiro') return null;

  const base = {
    id: `kit-${origemId}-${indice}`,
    origem_kit_id: `${origemId}:${indice}`,
    quantidade: Math.max(1, Number(kitItem.quantidade ?? 1) || 1),
    quebrado: false,
  };

  if (tipo === 'equipamento_catalogo') {
    // "O item será, quando possível, feito de Cobre" -- Catálogo de Itens.
    const minerio = 'cobre';
    return {
      ...base,
      item_id: kitItem.item_id,
      minerio,
      durabilidade_atual: durabilidadeMaximaMaterial(minerio, materiais),
    };
  }
  // "equipamento" -- avulso/narrativo, sem equivalente no catálogo mecânico.
  return {
    ...base,
    item_id: null,
    nome_livre: kitItem.nome,
    peso_base_kg: kitItem.peso_base_kg || 0,
    minerio: null,
    durabilidade_atual: null,
  };
}

/** Todas as entradas de inventário que o kit inicial dessa Origem
 * produziria (ignorando o que o personagem já tem). */
export function entradasKitOrigem(origemId, origem, materiais) {
  const kitItens = origem?.kit_itens || [];
  return kitItens
    .map((kitItem, indice) => entradaDeKitItem(origemId, indice, kitItem, materiais))
    .filter(Boolean);
}

/** Só as entradas do kit que o personagem AINDA NÃO tem -- compara pelo
 * marcador `origem_kit_id`. Usado pelo botão "Adicionar Kit de Origem":
 * cada clique só preenche o que falta, nunca duplica o que já foi
 * adicionado (e um item removido de propósito pelo jogador continua
 * "faltando" até ele clicar de novo -- é uma ação explícita). */
export function kitOrigemFaltando(origemId, origem, inventarioAtual, materiais) {
  const jaTem = new Set((inventarioAtual || []).map((e) => e.origem_kit_id).filter(Boolean));
  return entradasKitOrigem(origemId, origem, materiais).filter((e) => !jaTem.has(e.origem_kit_id));
}

function round3(n) {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}
