export default function PoderDetalhe({ p }) {
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
