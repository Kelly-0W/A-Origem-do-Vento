export default function ModalBase({ titulo, onFechar, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 sm:p-10 overflow-y-auto" onClick={onFechar}>
      <div className="card-fantasy w-full max-w-md p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onFechar} className="absolute top-4 right-4 text-mist hover:text-white text-xl leading-none" aria-label="Fechar">×</button>
        <h2 className="text-2xl font-display text-white mb-5 pr-8">{titulo}</h2>
        {children}
      </div>
    </div>
  )
}
