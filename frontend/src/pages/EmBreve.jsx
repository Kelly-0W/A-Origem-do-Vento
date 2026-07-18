export default function EmBreve({ titulo, descricao }) {
  return (
    <div className="card-fantasy px-10 py-16 text-center mt-4">
      <h1 className="text-3xl mb-3">{titulo}</h1>
      <p className="text-mist mb-6">{descricao}</p>
      <div className="w-full max-w-md mx-auto border-t border-panel-border pt-6">
        <span className="text-gold text-xs tracking-[0.3em] uppercase">Em breve</span>
      </div>
    </div>
  )
}
