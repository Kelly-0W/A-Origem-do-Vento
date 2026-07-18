import { useEffect } from 'react'

const NOME_ATRIBUTO = { for: 'Força', des: 'Destreza', con: 'Constituição', int: 'Inteligência', sab: 'Sabedoria', car: 'Carisma' }

function fmtMod(valor) {
  if (valor === null || valor === undefined) return null
  return valor > 0 ? `+${valor}` : `${valor}`
}

function Secao({ titulo, children }) {
  return (
    <div className="mb-6">
      <h3 className="font-display text-gold text-xs uppercase tracking-widest mb-2">{titulo}</h3>
      {children}
    </div>
  )
}

function Habilidade({ h }) {
  return (
    <div className="stat-tile">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm text-white">{h.nome}</span>
        {h.tipo && (
          <span className="text-[10px] uppercase tracking-widest text-mist border border-panel-border rounded px-1.5 py-0.5">
            {h.tipo}
          </span>
        )}
      </div>
      <p className="text-xs text-mist leading-relaxed">{h.descricao}</p>
    </div>
  )
}

function BlocoStatus({ status }) {
  if (!status) return null
  const linhas = [
    ['Vida', status.vida],
    ['Sanidade', status.sanidade],
    ['Arché', status.arche],
    ['Defesa', status.defesa],
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {linhas.map(([label, s]) =>
        s ? (
          <div key={label} className="stat-tile">
            <span className="text-[10px] uppercase tracking-widest text-mist">{label}</span>
            <span className="text-white font-display">
              {s.base} <span className="text-mist text-xs">+{s.mult_ascensao}×Grau ({NOME_ATRIBUTO[s.atributo] || s.atributo})</span>
            </span>
          </div>
        ) : null
      )}
      {status.deslocamento_m != null && (
        <div className="stat-tile">
          <span className="text-[10px] uppercase tracking-widest text-mist">Deslocamento</span>
          <span className="text-white font-display">{status.deslocamento_m} m</span>
        </div>
      )}
      {status.ataque_desarmado && (
        <div className="stat-tile">
          <span className="text-[10px] uppercase tracking-widest text-mist">Ataque Desarmado</span>
          <span className="text-white font-display">
            {status.ataque_desarmado.dano} ({status.ataque_desarmado.tipo_dano})
          </span>
        </div>
      )}
    </div>
  )
}

function BlocoModificadores({ modificadores_atributo }) {
  if (!modificadores_atributo) return null
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(modificadores_atributo).map(([attr, valor]) => (
        <span
          key={attr}
          className={`text-xs px-2.5 py-1 rounded-md border ${
            valor > 0
              ? 'border-forest/60 text-white bg-forest-dark/40'
              : valor < 0
              ? 'border-blood-bright/40 text-white bg-blood-dark/30'
              : 'border-panel-border text-mist'
          }`}
        >
          {NOME_ATRIBUTO[attr] || attr}: {fmtMod(valor)}
        </span>
      ))}
    </div>
  )
}

function DetalheRaca({ item }) {
  return (
    <>
      {item.descricao_curta && <p className="text-sm text-mist mb-6">{item.descricao_curta}</p>}

      <Secao titulo="Status Base">
        <BlocoStatus status={item.status} />
      </Secao>

      <Secao titulo="Modificadores de Atributo">
        <BlocoModificadores modificadores_atributo={item.modificadores_atributo} />
      </Secao>

      {Array.isArray(item.habilidades_globais) && item.habilidades_globais.length > 0 && (
        <Secao titulo="Habilidades Globais">
          <div className="grid sm:grid-cols-2 gap-3">
            {item.habilidades_globais.map((h) => (
              <Habilidade key={h.id} h={h} />
            ))}
          </div>
        </Secao>
      )}

      {Array.isArray(item.linhagens) && item.linhagens.length > 0 && (
        <Secao titulo="Linhagens">
          <div className="flex flex-col gap-4">
            {item.linhagens.map((l) => (
              <div key={l.id} className="card-fantasy p-4">
                <div className="font-display text-white mb-1">{l.nome}</div>
                {l.descricao_curta && <p className="text-xs text-mist mb-3">{l.descricao_curta}</p>}
                <div className="mb-3">
                  <BlocoStatus status={l.status} />
                </div>
                <div className="mb-3">
                  <BlocoModificadores modificadores_atributo={l.modificadores_atributo} />
                </div>
                {Array.isArray(item.habilidades_especificas) && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {item.habilidades_especificas
                      .filter((h) => h.linhagem_id === l.id)
                      .map((h) => (
                        <Habilidade key={h.id} h={h} />
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Secao>
      )}

      {item.sistema_racial_inato && (
        <Secao titulo="Sistema Racial Único">
          <div className="card-fantasy p-4">
            <div className="font-display text-white mb-1">{item.sistema_racial_inato.nome}</div>
            <p className="text-xs text-mist leading-relaxed">{item.sistema_racial_inato.descricao}</p>
          </div>
        </Secao>
      )}
    </>
  )
}

function DetalheClasse({ item }) {
  return (
    <>
      {item.descricao_curta && <p className="text-sm text-mist mb-6">{item.descricao_curta}</p>}

      {item.pericia_treinada_fixa && (
        <Secao titulo="Perícia Treinada Fixa">
          <span className="text-sm text-white capitalize">{item.pericia_treinada_fixa}</span>
        </Secao>
      )}

      {Array.isArray(item.habilidades) && item.habilidades.length > 0 && (
        <Secao titulo={`Habilidades de Classe (${item.qtd_habilidades_iniciais ?? '?'} no Grau 0)`}>
          <div className="grid sm:grid-cols-2 gap-3">
            {item.habilidades.map((h) => (
              <Habilidade key={h.id} h={h} />
            ))}
          </div>
        </Secao>
      )}

      {Array.isArray(item.subclasses) && item.subclasses.length > 0 && (
        <Secao titulo="Subclasses">
          <div className="flex flex-col gap-4">
            {item.subclasses.map((s) => (
              <div key={s.id} className="card-fantasy p-4">
                <div className="font-display text-white mb-1">{s.nome}</div>
                {s.descricao && <p className="text-xs text-mist mb-3">{s.descricao}</p>}
                {Array.isArray(s.habilidades) && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {s.habilidades.map((h) => (
                      <Habilidade key={h.id} h={h} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Secao>
      )}

      {item.provacoes && (
        <Secao titulo="Provações">
          {['facil', 'medio', 'dificil'].map(
            (grau) =>
              Array.isArray(item.provacoes[grau]) &&
              item.provacoes[grau].length > 0 && (
                <div key={grau} className="mb-3">
                  <span className="text-[10px] uppercase tracking-widest text-mist">{grau}</span>
                  <ul className="list-disc list-inside text-xs text-mist mt-1 space-y-1">
                    {item.provacoes[grau].map((p) => (
                      <li key={p.id}>{p.descricao}</li>
                    ))}
                  </ul>
                </div>
              )
          )}
        </Secao>
      )}
    </>
  )
}

function DetalheOrigem({ item }) {
  return (
    <>
      {item.descricao && <p className="text-sm text-mist mb-6">{item.descricao}</p>}

      {Array.isArray(item.pericias_opcoes) && item.pericias_opcoes.length > 0 && (
        <Secao titulo="Opções de Perícia">
          <div className="flex flex-wrap gap-2">
            {item.pericias_opcoes.map((p) => (
              <span key={p.pericia_id} className="text-xs px-2.5 py-1 rounded-md border border-panel-border text-white capitalize">
                {p.pericia_id}
                {p.nota && <span className="text-mist"> — {p.nota}</span>}
              </span>
            ))}
          </div>
        </Secao>
      )}

      {Array.isArray(item.kit_itens) && item.kit_itens.length > 0 && (
        <Secao titulo="Kit de Itens">
          <ul className="list-disc list-inside text-sm text-mist space-y-1">
            {item.kit_itens.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </Secao>
      )}

      {item.habilidade_passiva && (
        <Secao titulo="Habilidade Passiva">
          <div className="stat-tile">
            <span className="font-display text-sm text-white">{item.habilidade_passiva.nome}</span>
            <p className="text-xs text-mist leading-relaxed">{item.habilidade_passiva.descricao}</p>
          </div>
        </Secao>
      )}

      {item.rituais && (
        <Secao titulo="Ritual de Ascensão">
          {['facil', 'medio', 'dificil'].map(
            (grau) =>
              item.rituais[grau] && (
                <div key={grau} className="stat-tile mb-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm text-white">{item.rituais[grau].nome}</span>
                    <span className="text-[10px] uppercase tracking-widest text-mist">{grau}</span>
                  </div>
                  <p className="text-xs text-mist leading-relaxed">{item.rituais[grau].descricao}</p>
                </div>
              )
          )}
        </Secao>
      )}
    </>
  )
}

function Poder({ p, id }) {
  return (
    <div className="stat-tile">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-display text-sm text-white">{p.nome}</span>
        {p.custo_arche != null && <span className="text-[10px] uppercase tracking-widest text-gold">{p.custo_arche} Arché</span>}
      </div>
      <p className="text-xs text-mist leading-relaxed mb-2">{p.descricao}</p>
      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-mist mb-2">
        {p.execucao && <span className="border border-panel-border rounded px-1.5 py-0.5">Execução: {p.execucao}</span>}
        {p.alcance && <span className="border border-panel-border rounded px-1.5 py-0.5">Alcance: {p.alcance}</span>}
        {p.duracao && <span className="border border-panel-border rounded px-1.5 py-0.5">Duração: {p.duracao}</span>}
        {p.pericia && <span className="border border-panel-border rounded px-1.5 py-0.5 capitalize">Perícia: {p.pericia}</span>}
      </div>
      {p.dano && (
        <p className="text-xs text-mist">
          Dano: <span className="text-white">{p.dano.dados}</span> ({p.dano.tipo}
          {p.dano.atributo_bonus ? `, +${p.dano.atributo_bonus}` : ''})
        </p>
      )}
      {Array.isArray(p.variacoes) && p.variacoes.length > 0 && (
        <div className="mt-2 border-t border-panel-border pt-2">
          <span className="text-[10px] uppercase tracking-widest text-mist">Variações por submanipulação</span>
          <ul className="list-disc list-inside text-xs text-mist mt-1 space-y-1">
            {p.variacoes.map((v, i) => (
              <li key={i}>
                <span className="text-white capitalize">{v.submanipulacao}:</span> {v.efeito}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function DetalheElemento({ item }) {
  return (
    <>
      {item.descricao && <p className="text-sm text-mist mb-6">{item.descricao}</p>}

      {Array.isArray(item.submanipulacoes) && item.submanipulacoes.length > 0 && (
        <Secao titulo="Submanipulações">
          <div className="flex flex-wrap gap-2">
            {item.submanipulacoes.map((s) => (
              <span key={s.id} className="text-xs px-2.5 py-1 rounded-md border border-panel-border text-white">
                {s.nome}
              </span>
            ))}
          </div>
        </Secao>
      )}

      {Array.isArray(item.estagios_arche_baixo) && item.estagios_arche_baixo.length > 0 && (
        <Secao titulo="Estágios de Corrosão do Arché">
          <div className="flex flex-col gap-2">
            {item.estagios_arche_baixo.map((e) => (
              <div key={e.estagio} className="stat-tile">
                <span className="text-[10px] uppercase tracking-widest text-mist">
                  Estágio {e.estagio} — abaixo de {e.limiar_pct}%
                </span>
                <p className="text-xs text-mist leading-relaxed">{e.efeito}</p>
              </div>
            ))}
          </div>
        </Secao>
      )}

      {item.poderes && Object.keys(item.poderes).length > 0 && (
        <Secao titulo="Poderes">
          <div className="grid sm:grid-cols-2 gap-3">
            {Object.entries(item.poderes).map(([id, p]) => (
              <Poder key={id} id={id} p={p} />
            ))}
          </div>
        </Secao>
      )}
    </>
  )
}

function DetalheItem({ item }) {
  return (
    <>
      {item.categoria && (
        <span className="inline-block text-[10px] uppercase tracking-widest text-gold border border-panel-border rounded px-2 py-1 mb-4">
          {item.categoria}
        </span>
      )}
      {item.descricao && <p className="text-sm text-mist mb-6">{item.descricao}</p>}

      {item.arma && (
        <Secao titulo="Atributos de Arma">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="stat-tile">
              <span className="text-[10px] uppercase tracking-widest text-mist">Dano</span>
              <span className="text-white font-display">
                {item.arma.dano?.dados} ({item.arma.dano?.tipo_dano})
              </span>
            </div>
            <div className="stat-tile">
              <span className="text-[10px] uppercase tracking-widest text-mist">Empunhadura</span>
              <span className="text-white font-display capitalize">{item.arma.empunhadura?.replace('_', ' ')}</span>
            </div>
            <div className="stat-tile">
              <span className="text-[10px] uppercase tracking-widest text-mist">Alcance</span>
              <span className="text-white font-display">{item.arma.alcance_m} m</span>
            </div>
            {item.arma.minerio && (
              <div className="stat-tile">
                <span className="text-[10px] uppercase tracking-widest text-mist">Minério</span>
                <span className="text-white font-display capitalize">{item.arma.minerio}</span>
              </div>
            )}
          </div>
        </Secao>
      )}

      {item.defesa && (
        <Secao titulo="Atributos de Defesa">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(item.defesa).map(([k, v]) => (
              <div key={k} className="stat-tile">
                <span className="text-[10px] uppercase tracking-widest text-mist capitalize">{k.replace('_', ' ')}</span>
                <span className="text-white font-display">{String(v)}</span>
              </div>
            ))}
          </div>
        </Secao>
      )}

      {item.conteudo && (
        <Secao titulo="Conteúdo">
          <p className="text-sm text-mist">{JSON.stringify(item.conteudo)}</p>
        </Secao>
      )}
    </>
  )
}

function DetalhePericia({ item }) {
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        {item.atributo && (
          <span className="text-xs px-2.5 py-1 rounded-md border border-panel-border text-white">
            {NOME_ATRIBUTO[item.atributo] || item.atributo}
          </span>
        )}
        <span className="text-xs px-2.5 py-1 rounded-md border border-panel-border text-mist">
          {item.requer_treinamento ? 'Requer treinamento' : 'Uso livre (não treinada)'}
        </span>
      </div>

      {item.descricao && <p className="text-sm text-mist mb-6">{item.descricao}</p>}

      {Array.isArray(item.mini_habilidades) && item.mini_habilidades.length > 0 && (
        <Secao titulo="Mini-habilidades">
          <div className="flex flex-col gap-2">
            {item.mini_habilidades.map((m, i) => (
              <div key={i} className="stat-tile">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm text-white">{m.nome}</span>
                  <span className="text-[10px] uppercase tracking-widest text-gold">CD {m.cd}</span>
                </div>
                <p className="text-xs text-mist leading-relaxed">{m.descricao}</p>
              </div>
            ))}
          </div>
        </Secao>
      )}
    </>
  )
}

const RENDERIZADORES = {
  racas: DetalheRaca,
  classes: DetalheClasse,
  origens: DetalheOrigem,
  elementos: DetalheElemento,
  itens: DetalheItem,
  pericias: DetalhePericia,
}

export default function BibliotecaDetalhe({ colecao, item, onFechar }) {
  useEffect(() => {
    const aoTeclar = (e) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [onFechar])

  if (!item) return null

  const Renderizador = RENDERIZADORES[colecao]

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 sm:p-10 overflow-y-auto animate-fade-up"
      onClick={onFechar}
    >
      <div
        className="card-fantasy w-full max-w-2xl p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onFechar}
          className="absolute top-4 right-4 text-mist hover:text-white text-xl leading-none"
          aria-label="Fechar"
        >
          ×
        </button>

        <h2 className="text-2xl font-display text-white mb-4 pr-8">{item.nome}</h2>

        {Renderizador ? <Renderizador item={item} /> : <p className="text-sm text-mist">Sem detalhe disponível para esta coleção.</p>}
      </div>
    </div>
  )
}
