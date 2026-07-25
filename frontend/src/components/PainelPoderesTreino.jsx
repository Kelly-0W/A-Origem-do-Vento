import { useState } from 'react'
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import ModalBase from './ModalBase.jsx'
import PoderDetalhe from './PoderDetalhe.jsx'

// Ascensão não concede poderes novos automaticamente -- eles vêm de
// treinamento externo à narrativa (ver nota em api/motor/validacoes.py,
// que só exige um MÍNIMO de 2 poderes, nunca um máximo). Este painel é
// onde esse treinamento vira, de fato, um poder a mais na ficha.
//
// Pra Caça, `elementoPoderes` é o elemento VINCULADO ao Espiritual
// escolhido (não "caca" em si, que não tem lista de poderes própria) --
// quem chama este componente já resolve isso antes de passar as props.
export default function PainelPoderesTreino({
  personagemId, poderesEscolhidos, elementoPoderes, nomeElemento, isCaca, onAtualizado,
}) {
  const [modalAberto, setModalAberto] = useState(false)
  const [poderAberto, setPoderAberto] = useState(null)
  const [salvando, setSalvando] = useState(null) // id do poder sendo salvo, ou null
  const [erro, setErro] = useState(null)

  if (!elementoPoderes) return null

  const catalogoPoderes = elementoPoderes.poderes || {}
  const conhecidos = poderesEscolhidos.filter((id) => catalogoPoderes[id])
  const disponiveis = Object.entries(catalogoPoderes).filter(([id]) => !poderesEscolhidos.includes(id))

  async function adicionarPoder(id) {
    setSalvando(id)
    setErro(null)
    try {
      await updateDoc(doc(db, 'personagens', personagemId), {
        'escolhas.poderes_escolhidos': arrayUnion(id),
        atualizado_em: serverTimestamp(),
      })
      onAtualizado([...poderesEscolhidos, id])
      setModalAberto(false)
    } catch (err) {
      console.error(err)
      setErro('Não foi possível adicionar esse poder agora.')
    } finally {
      setSalvando(null)
    }
  }

  return (
    <div className="card-fantasy p-6 mt-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg">Poderes de {nomeElemento}</h2>
        <button className="btn-secondary text-xs" onClick={() => setModalAberto(true)}>+ Adicionar Poder</button>
      </div>
      <p className="text-mist text-xs mb-4">
        Subir de Ascensão não dá poderes novos sozinho -- eles vêm de treinamento externo à narrativa. Use o botão
        acima quando seu personagem aprender um poder novo em jogo.
        {isCaca && ' Esses poderes só podem ser usados enquanto o personagem estiver Transformado.'}
      </p>

      {conhecidos.length === 0 ? (
        <p className="text-mist text-sm">Nenhum poder conhecido ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {conhecidos.map((id) => {
            const poder = catalogoPoderes[id]
            return (
              <button
                key={id}
                onClick={() => setPoderAberto(poder)}
                className="text-left card-fantasy p-4 hover:border-white/20 transition-colors"
              >
                <div className="font-display font-semibold mb-1 text-sm">{poder.nome}</div>
                <p className="text-xs text-mist line-clamp-2">{poder.descricao}</p>
              </button>
            )
          })}
        </div>
      )}

      {modalAberto && (
        <ModalBase titulo={`Adicionar Poder de ${nomeElemento}`} onFechar={() => setModalAberto(false)}>
          {erro && <p className="text-blood-bright text-xs mb-4">{erro}</p>}
          {disponiveis.length === 0 ? (
            <p className="text-mist text-sm">Este personagem já conhece todos os poderes deste elemento.</p>
          ) : (
            <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
              {disponiveis.map(([id, poder]) => (
                <div key={id} className="card-fantasy p-4">
                  <div className="font-display font-semibold mb-1 text-sm">{poder.nome}</div>
                  <p className="text-xs text-mist mb-3">{poder.descricao}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-block text-[11px] px-2 py-1 rounded border border-gold/40 text-gold">
                      Custo: {poder.custo_arche} Arché
                    </span>
                    <button
                      className="btn-primary text-xs disabled:opacity-50"
                      onClick={() => adicionarPoder(id)}
                      disabled={salvando === id}
                    >
                      {salvando === id ? 'Adicionando...' : 'Adicionar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ModalBase>
      )}

      {poderAberto && (
        <ModalBase onFechar={() => setPoderAberto(null)}>
          <PoderDetalhe p={poderAberto} />
        </ModalBase>
      )}
    </div>
  )
}
