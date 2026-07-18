export default function Combate() {
  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl mb-1">Combate</h1>
          <p className="text-mist">Rastreie iniciativas, turnos e a fúria da batalha.</p>
        </div>
        <button className="btn-primary">⚔ Novo Encontro</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <div className="card-fantasy p-5">
          <div className="text-xs uppercase tracking-widest text-mist mb-3">Sessões</div>
          <p className="text-sm text-mist">Nenhum encontro criado.</p>
        </div>
        <div className="card-fantasy p-5 flex items-center justify-center text-mist text-sm min-h-[240px]">
          Selecione ou crie um encontro para começar.
        </div>
      </div>
    </div>
  )
}
