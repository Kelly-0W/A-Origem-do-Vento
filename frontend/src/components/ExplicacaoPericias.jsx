import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { NOMES_ATRIBUTOS, ABREV_ATRIBUTOS } from '../lib/constantes.js'

// Mostra, acima da grade de busca da aba "Perícias" na Biblioteca:
// 1) a tabela Perícia x Atributo x Precisa de Treinamento (direto do
//    catálogo real -- nunca desalinha do que está de fato cadastrado);
// 2) a explicação matemática de como o bônus final é calculado, com os
//    marcos de bônus de treinamento também vindos do catálogo
//    (constantes_ascensao.json -> bonus_treinamento_pericia.marcos).
export default function ExplicacaoPericias({ pericias }) {
  const [marcos, setMarcos] = useState(null)

  useEffect(() => {
    api.buscarBiblioteca('constantes_ascensao').then(({ dados }) => {
      setMarcos(dados?.itens?.bonus_treinamento_pericia?.marcos || null)
    })
  }, [])

  const entradas = Object.entries(pericias || {}).sort(([, a], [, b]) =>
    (a.nome || '').localeCompare(b.nome || '')
  )

  const marcosOrdenados = marcos
    ? Object.entries(marcos).sort(([a], [b]) => Number(a) - Number(b))
    : null

  return (
    <div className="card-fantasy p-6 mb-8">
      <h2 className="font-display text-xl mb-1">Como as Perícias funcionam</h2>
      <p className="text-mist text-sm mb-6">
        Cada perícia usa um atributo-base fixo (salvo quando uma habilidade específica troca isso — ver "atributo
        trocável" na sua ficha). Perícias marcadas como "Requer treinamento" simplesmente não podem ser usadas
        destreinadas.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="font-display text-gold text-xs uppercase tracking-widest mb-3">O cálculo</h3>
          <div className="flex flex-col gap-2 text-sm mb-4">
            <div className="stat-tile">
              <span className="text-xs uppercase tracking-widest text-mist">Perícia não treinada</span>
              <div className="mt-1">= Modificador do Atributo</div>
            </div>
            <div className="stat-tile">
              <span className="text-xs uppercase tracking-widest text-mist">Perícia treinada</span>
              <div className="mt-1">= Modificador do Atributo + Bônus de treinamento</div>
            </div>
          </div>

          <h4 className="text-xs uppercase tracking-widest text-mist mb-2">Bônus de treinamento por Grau de Ascensão</h4>
          {marcosOrdenados ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {marcosOrdenados.map(([grau, bonus]) => (
                <span key={grau} className="text-xs px-2.5 py-1 rounded-md border border-panel-border text-white">
                  Grau {grau}: <span className="text-gold">+{bonus}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-mist mb-4">Carregando...</p>
          )}
          <p className="text-xs text-mist mb-1">
            O bônus vale o do maior marco alcançado — por exemplo, no Grau 4 o personagem ainda usa o bônus do
            Grau 3, porque o Grau 4 não é um marco novo.
          </p>

          <p className="text-xs text-mist mt-4">
            <span className="text-gold">Perícia retreinada:</span> se uma habilidade te dá treinamento numa perícia
            em que você já era treinado, em vez de não fazer nada você ganha um bônus fixo extra de{' '}
            <span className="text-white">+2</span>, que não escala com o Grau de Ascensão (diferente do bônus normal
            acima).
          </p>
          <p className="text-xs text-mist mt-2">
            Habilidades e poderes que exigem uma perícia só podem ser usados se essa perícia estiver{' '}
            <span className="text-white">treinada</span>.
          </p>
        </div>

        <div>
          <h3 className="font-display text-gold text-xs uppercase tracking-widest mb-3">Atributo de cada perícia</h3>
          <div className="border border-panel-border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-void/60 text-mist uppercase tracking-widest text-[10px]">
                  <th className="text-left px-3 py-2">Perícia</th>
                  <th className="text-left px-3 py-2">Atributo</th>
                  <th className="text-left px-3 py-2">Treinamento</th>
                </tr>
              </thead>
              <tbody>
                {entradas.map(([id, p]) => (
                  <tr key={id} className="border-t border-panel-border">
                    <td className="px-3 py-1.5 text-white">{p.nome}</td>
                    <td className="px-3 py-1.5 text-mist" title={NOMES_ATRIBUTOS[p.atributo] || p.atributo}>
                      {ABREV_ATRIBUTOS[p.atributo] || p.atributo}
                    </td>
                    <td className="px-3 py-1.5">
                      {p.requer_treinamento ? (
                        <span className="text-gold">Obrigatório</span>
                      ) : (
                        <span className="text-mist">Livre</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
