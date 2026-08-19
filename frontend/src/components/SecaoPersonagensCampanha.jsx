import { Link } from 'react-router-dom'

// Única seção que lista "todo mundo que já trouxe um personagem pra essa
// campanha" -- antes disso existiam DUAS (Participantes da Campanha, em
// CampanhaDetalhe.jsx, e Todos os Personagens da Mesa, dentro do Painel
// do Mestre), mostrando basicamente a mesma coisa duas vezes. Unificadas
// aqui num componente só, puro (sem Firebase/fetch por dentro), pra dar
// pra reusar e testar sem precisar montar a página inteira.
//
// Jogador comum vê os cards, sem poder clicar. O mestre pode clicar em
// qualquer um pra abrir a ficha completa desse personagem em ABA NOVA
// (assim dá pra deixar várias fichas abertas ao mesmo tempo enquanto
// acompanha a mesa) -- mesmo componente <Link> e mesma linguagem visual
// (card com destaque dourado no hover) que o sistema de amizades usa pra
// navegar até a ficha de um amigo; a diferença técnica deliberada é o
// `target="_blank"` (lá a navegação é na mesma aba, porque não faz
// sentido abrir dezenas de abas do PRÓPRIO personagem; aqui faz, porque é
// o mestre revisando vários personagens de uma vez).
export default function SecaoPersonagensCampanha({ participantes, catalogo, ehMestre }) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-display mb-6">Personagens da Campanha</h2>
      {participantes.length === 0 ? (
        <div className="card-fantasy p-10 text-center text-mist">Ninguém trouxe um personagem pra essa campanha ainda.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {participantes.map((p) => {
            const conteudo = (
              <div className="flex gap-4">
                <div className="w-14 h-14 rounded border border-panel-border bg-void overflow-hidden shrink-0 flex items-center justify-center">
                  {p.imagem_base64 ? (
                    <img src={p.imagem_base64} alt={p.nome_personagem} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-mist text-[10px]">Sem foto</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-display font-semibold mb-1 truncate">{p.nome_personagem || 'Personagem sem nome'}</div>
                  <p className="text-xs text-mist truncate">
                    {catalogo.racas[p.raca_id]?.nome || p.raca_id} · {catalogo.classes[p.classe_id]?.nome || p.classe_id}
                  </p>
                  <p className="text-[11px] text-mist mt-1 truncate">Jogado por {p.dono_nome || 'alguém sem nome definido'}</p>
                </div>
              </div>
            )
            return ehMestre ? (
              <Link
                key={p.id}
                to={`/personagens/${p.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="card-fantasy p-5 hover:border-gold/50 transition-colors"
                title="Abrir ficha completa em uma nova aba"
              >
                {conteudo}
              </Link>
            ) : (
              <div key={p.id} className="card-fantasy p-5">
                {conteudo}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
