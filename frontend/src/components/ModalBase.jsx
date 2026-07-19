import { createPortal } from 'react-dom'

// IMPORTANTE: renderiza via createPortal direto no document.body, e não
// inline dentro da árvore de componentes.
//
// Causa raiz do bug de "o modal aparece jogado lá em cima, fora do lugar
// onde eu cliquei": `<main>` (AppLayout.jsx) tem a classe `animate-fade-up`,
// cuja animação termina em `transform: translateY(0)` com
// `animation-fill-mode: both` -- ou seja, mesmo depois de a animação
// acabar, `<main>` fica com um `transform` aplicado permanentemente.
// Por spec do CSS, QUALQUER elemento com `transform` diferente de `none`
// vira o "containing block" dos descendentes `position: fixed` -- então
// um modal com `fixed inset-0` renderizado dentro de `<main>` para de se
// posicionar relativo à janela (viewport) e passa a se posicionar relativo
// a `<main>`, que é alto como a página inteira e rola junto com ela. É
// isso que fazia o modal parecer "pular" pra longe de onde a pessoa clicou.
//
// Renderizando fora da árvore (direto em document.body, que não tem
// transform nenhum), o modal volta a se comportar como `position: fixed`
// de verdade, sempre relativo à janela, não importa o que aconteça com
// animações/transforms em qualquer ancestral no futuro.
export default function ModalBase({ titulo, onFechar, children }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 sm:p-10 overflow-y-auto" onClick={onFechar}>
      <div className="card-fantasy w-full max-w-md p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onFechar} className="absolute top-4 right-4 text-mist hover:text-white text-xl leading-none" aria-label="Fechar">×</button>
        {titulo && <h2 className="text-2xl font-display text-white mb-5 pr-8">{titulo}</h2>}
        {children}
      </div>
    </div>,
    document.body
  )
}
