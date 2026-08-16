import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'
import { redimensionarImagem } from '../lib/imagem.js'
import ResumoEscolhas from '../components/ResumoEscolhas.jsx'
import FichaVisual from '../components/FichaVisual.jsx'
import PainelAscensao from '../components/PainelAscensao.jsx'
import PainelPoderesTreino from '../components/PainelPoderesTreino.jsx'
import PainelInventario from '../components/PainelInventario.jsx'

// As 3 abas principais da ficha. "Poderes" reúne tudo que já existia antes
// desta reestruturação (resumo de escolhas, status/perícias/atributos
// calculados, ascensão e treino de poderes); "Inventário" é só o painel
// novo de peso/durabilidade; "Background" é texto livre de interpretação,
// sem nenhuma regra mecânica por trás.
const ABAS = [
  { id: 'poderes', rotulo: 'Poderes' },
  { id: 'inventario', rotulo: 'Inventário' },
  { id: 'background', rotulo: 'Background' },
]

// Sub-abas escritas dentro de Background -- cada uma vira uma chave própria
// no campo `background` (mapa) do documento do personagem no Firestore.
const CAMPOS_BACKGROUND = [
  { chave: 'historia', rotulo: 'História', placeholder: 'De onde esse personagem veio, o que o trouxe até aqui...' },
  { chave: 'personalidade', rotulo: 'Personalidade', placeholder: 'Como ele age, fala, reage sob pressão...' },
  { chave: 'defeitos_qualidades', rotulo: 'Defeitos e Qualidades', placeholder: 'O que o define pra melhor e pra pior...' },
  { chave: 'relacoes_sociais', rotulo: 'Relações Sociais', placeholder: 'Família, aliados, rivais, dívidas de gratidão...' },
  { chave: 'talento', rotulo: 'Talento', placeholder: 'Aquilo que esse personagem faz melhor que ninguém...' },
]

const BACKGROUND_VAZIO = Object.fromEntries(CAMPOS_BACKGROUND.map((c) => [c.chave, '']))

function BotaoAba({ ativo, onClick, children, className = '' }) {
  return (
    <button type="button" onClick={onClick} className={`tab-item ${ativo ? 'active' : ''} ${className}`}>
      {children}
    </button>
  )
}

export default function PersonagemDetalhe() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const navigate = useNavigate()

  const [excluindo, setExcluindo] = useState(false)
  const [erroExcluir, setErroExcluir] = useState(null)

  const [carregando, setCarregando] = useState(true)
  const [erroCarregamento, setErroCarregamento] = useState(null)
  const [personagem, setPersonagem] = useState(null)
  const [catalogo, setCatalogo] = useState({ racas: {}, classes: {}, origens: {}, elementos: {}, pericias: {}, sagracanticos: {}, itens: {}, materiais: {} })

  const [abaAtiva, setAbaAtiva] = useState('poderes')
  const [abaBackgroundAtiva, setAbaBackgroundAtiva] = useState('historia')

  const [nomePersonagem, setNomePersonagem] = useState('')
  const [imagemBase64, setImagemBase64] = useState(null)
  const [background, setBackground] = useState(BACKGROUND_VAZIO)
  const [processandoImagem, setProcessandoImagem] = useState(false)
  const [erroImagem, setErroImagem] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erroSalvar, setErroSalvar] = useState(null)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      setErroCarregamento(null)
      try {
        const colecoes = ['racas', 'classes', 'origens', 'elementos', 'pericias', 'sagracanticos', 'itens', 'materiais']
        const respostas = await Promise.all(colecoes.map((c) => api.buscarBiblioteca(c)))
        const novoCatalogo = {}
        colecoes.forEach((c, i) => { novoCatalogo[c] = respostas[i].dados?.itens ?? {} })
        setCatalogo(novoCatalogo)

        const referencia = doc(db, 'personagens', id)
        const snap = await getDoc(referencia)
        if (!snap.exists()) {
          setErroCarregamento('Personagem não encontrado.')
          return
        }
        const dados = { id: snap.id, ...snap.data() }
        setPersonagem(dados)
        setNomePersonagem(dados.escolhas?.nome_personagem || '')
        setImagemBase64(dados.imagem_base64 || null)
        setBackground({ ...BACKGROUND_VAZIO, ...(dados.background || {}) })
      } catch (err) {
        console.error(err)
        setErroCarregamento('Não foi possível carregar este personagem — ele pode não existir ou não pertencer à sua conta.')
      } finally {
        setCarregando(false)
      }
    }
    if (usuario) carregar()
  }, [id, usuario])

  async function selecionarImagem(evento) {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return
    if (!arquivo.type.startsWith('image/')) {
      setErroImagem('Escolha um arquivo de imagem.')
      return
    }
    setErroImagem(null)
    setProcessandoImagem(true)
    try {
      const dataUrl = await redimensionarImagem(arquivo)
      setImagemBase64(dataUrl)
    } catch (err) {
      console.error(err)
      setErroImagem('Não foi possível processar essa imagem.')
    } finally {
      setProcessandoImagem(false)
    }
  }

  async function salvarCosmetico() {
    setSalvando(true)
    setSalvo(false)
    setErroSalvar(null)
    try {
      await updateDoc(doc(db, 'personagens', id), {
        'escolhas.nome_personagem': nomePersonagem.trim(),
        imagem_base64: imagemBase64,
        background,
        atualizado_em: serverTimestamp(),
      })
      setPersonagem((prev) => ({
        ...prev,
        escolhas: { ...prev.escolhas, nome_personagem: nomePersonagem.trim() },
        imagem_base64: imagemBase64,
        background,
      }))
      setSalvo(true)
    } catch (err) {
      console.error(err)
      setErroSalvar('Não foi possível salvar as alterações agora.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluirPersonagem() {
    const confirmado = window.confirm(
      `Excluir "${personagem.escolhas?.nome_personagem || 'este personagem'}" pra sempre? Essa ação não pode ser desfeita.`
    )
    if (!confirmado) return
    setExcluindo(true)
    setErroExcluir(null)
    try {
      await deleteDoc(doc(db, 'personagens', id))
      navigate('/personagens')
    } catch (err) {
      console.error(err)
      setErroExcluir('Não foi possível excluir este personagem agora.')
      setExcluindo(false)
    }
  }

  if (carregando) {
    return <div className="pt-10 text-mist">Carregando personagem...</div>
  }

  if (erroCarregamento) {
    return (
      <div className="pt-2">
        <Link to="/personagens" className="flex items-center gap-1 text-mist text-sm mb-6 hover:text-white w-fit">
          <ChevronLeft size={16} /> Voltar
        </Link>
        <div className="card-fantasy p-10 text-center text-blood-bright text-sm">{erroCarregamento}</div>
      </div>
    )
  }

  const escolhas = personagem.escolhas || {}
  const ehDono = personagem.dono_uid === usuario.uid
  const raca = catalogo.racas[escolhas.raca_id] || null
  const linhagem = (raca?.linhagens || []).find((l) => l.id === escolhas.linhagem_id) || null
  const classe = catalogo.classes[escolhas.classe_id] || null
  const origem = catalogo.origens[escolhas.origem_id] || null
  const elemento = catalogo.elementos[escolhas.elemento_id] || null
  const isCaca = escolhas.elemento_id === 'caca'
  // Cada Espiritual de Caça está vinculado a um elemento diferente -- os
  // poderes da Caça (e o painel de treinamento) usam ESSE elemento, não
  // "caca" em si (que não tem lista de poderes própria).
  const espiritualEscolhido = elemento?.espirituais?.[escolhas.espiritual_escolhido] || null
  const elementoPoderes = isCaca ? (catalogo.elementos[espiritualEscolhido?.elemento_id] || null) : elemento
  const nomeElementoPoderes = isCaca ? (elementoPoderes?.nome ?? espiritualEscolhido?.elemento_id) : elemento?.nome

  function BotaoSalvarCosmetico({ className = '' }) {
    return (
      <div className={className}>
        <button
          className="btn-primary disabled:opacity-50"
          onClick={salvarCosmetico}
          disabled={salvando || nomePersonagem.trim().length === 0}
        >
          {salvando ? 'Salvando...' : 'Salvar Alterações'}
        </button>
        {salvo && <span className="text-forest text-xs ml-3">Salvo.</span>}
        {erroSalvar && <p className="text-blood-bright text-xs mt-2">{erroSalvar}</p>}
      </div>
    )
  }

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-6">
        <Link to="/personagens" className="flex items-center gap-1 text-mist text-sm hover:text-white w-fit">
          <ChevronLeft size={16} /> Voltar
        </Link>
        <button
          onClick={excluirPersonagem}
          disabled={excluindo}
          className={`text-xs text-mist hover:text-blood-bright transition-colors disabled:opacity-50 ${ehDono ? '' : 'invisible'}`}
        >
          {excluindo ? 'Excluindo...' : 'Excluir personagem'}
        </button>
      </div>
      {erroExcluir && <p className="text-blood-bright text-xs mb-4">{erroExcluir}</p>}

      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        <div className="shrink-0">
          <div className="w-32 h-32 rounded-lg border border-panel-border bg-void overflow-hidden flex items-center justify-center">
            {imagemBase64 ? (
              <img src={imagemBase64} alt={nomePersonagem || 'Retrato do personagem'} className="w-full h-full object-cover" />
            ) : (
              <span className="text-mist text-xs text-center px-2">Sem retrato</span>
            )}
          </div>
          {ehDono && (
            <>
              <label className="btn-secondary text-xs mt-3 inline-block cursor-pointer">
                {processandoImagem ? 'Processando...' : 'Trocar retrato'}
                <input type="file" accept="image/*" className="hidden" onChange={selecionarImagem} disabled={processandoImagem} />
              </label>
              {erroImagem && <p className="text-blood-bright text-xs mt-2">{erroImagem}</p>}
            </>
          )}
        </div>

        {ehDono ? (
          <div className="flex-1">
            <label className="flex flex-col gap-1.5 mb-4 max-w-sm">
              <span className="text-[11px] uppercase tracking-widest text-mist">Nome do personagem</span>
              <input
                value={nomePersonagem}
                onChange={(e) => setNomePersonagem(e.target.value)}
                placeholder="Como esse herói é conhecido"
                className="campo-input"
              />
            </label>
            <BotaoSalvarCosmetico />
          </div>
        ) : (
          <div className="flex-1">
            <h1 className="text-2xl font-display">{nomePersonagem || 'Personagem sem nome'}</h1>
          </div>
        )}
      </div>

      {/* Navegação das 3 abas principais */}
      <div className="flex items-center gap-1 border-b border-panel-border mb-8 overflow-x-auto">
        {ABAS.map((aba) => (
          <BotaoAba key={aba.id} ativo={abaAtiva === aba.id} onClick={() => setAbaAtiva(aba.id)}>
            {aba.rotulo}
          </BotaoAba>
        ))}
      </div>

      {abaAtiva === 'poderes' && (
        <div>
          <ResumoEscolhas
            catalogo={catalogo}
            escolhas={escolhas}
            raca={raca}
            linhagem={linhagem}
            classe={classe}
            origem={origem}
            elemento={elemento}
            isCaca={isCaca}
          />

          {personagem.calculado && (
            <FichaVisual
              resultado={personagem.calculado}
              catalogo={catalogo}
              raca={raca}
              linhagem={linhagem}
              classe={classe}
              origem={origem}
              elemento={elemento}
              escolhas={escolhas}
              isCaca={isCaca}
              interativo={ehDono}
              personagemId={id}
              donoUid={personagem.dono_uid}
              onAtualizado={(novoCalculado, novasEscolhas) =>
                setPersonagem((prev) => ({ ...prev, calculado: novoCalculado, escolhas: novasEscolhas }))
              }
              vidaAtual={personagem.vida_atual}
              sanidadeAtual={personagem.sanidade_atual}
              archeAtual={personagem.arche_atual}
              bonusDefesa={personagem.bonus_defesa}
              bonusDeslocamento={personagem.bonus_deslocamento}
              onAtualizarRecurso={(campo, valor) =>
                setPersonagem((prev) => ({ ...prev, [campo]: valor }))
              }
            />
          )}

          {ehDono && (
            <PainelAscensao
              personagemId={id}
              donoUid={usuario.uid}
              grauAscensao={personagem.grau_ascensao ?? 0}
              ascensaoEmProgresso={personagem.ascensao_em_progresso}
              raca={raca}
              linhagem={linhagem}
              classe={classe}
              origem={origem}
              escolhas={escolhas}
              estaEmCampanha={(personagem.campanhas_ids || []).length > 0}
              onAtualizado={(novaAscensao) =>
                setPersonagem((prev) => ({ ...prev, ascensao_em_progresso: novaAscensao }))
              }
              onAscensaoEfetivada={({ grau_ascensao, calculado, escolhas: novasEscolhas }) =>
                setPersonagem((prev) => ({
                  ...prev,
                  grau_ascensao,
                  calculado,
                  escolhas: novasEscolhas,
                  ascensao_em_progresso: {
                    grau_alvo: null,
                    catalisador: false,
                    provacao: false,
                    ritual: false,
                    descricao_manifestacao: '',
                    status: 'nenhuma',
                    respondido_por_uid: prev.ascensao_em_progresso?.respondido_por_uid ?? null,
                    respondido_em: prev.ascensao_em_progresso?.respondido_em ?? null,
                  },
                }))
              }
            />
          )}

          {ehDono && elementoPoderes && (
            <PainelPoderesTreino
              personagemId={id}
              poderesEscolhidos={escolhas.poderes_escolhidos || []}
              elementoPoderes={elementoPoderes}
              nomeElemento={nomeElementoPoderes}
              isCaca={isCaca}
              onAtualizado={(novosPoderes) =>
                setPersonagem((prev) => ({
                  ...prev,
                  escolhas: { ...prev.escolhas, poderes_escolhidos: novosPoderes },
                }))
              }
            />
          )}
        </div>
      )}

      {abaAtiva === 'inventario' && (
        <div>
          {personagem.calculado ? (
            <PainelInventario
              personagemId={id}
              interativo={ehDono}
              inventario={personagem.inventario}
              catalogoItens={catalogo.itens}
              materiais={catalogo.materiais}
              porteBiologico={personagem.calculado.porte_biologico}
              forcaFinal={personagem.calculado.atributos_finais?.for}
              deslocamentoBaseM={personagem.calculado.status?.deslocamento_m}
              origemId={escolhas.origem_id}
              origem={origem}
              onAtualizado={(novoInventario) =>
                setPersonagem((prev) => ({ ...prev, inventario: novoInventario }))
              }
            />
          ) : (
            <p className="text-mist text-sm">A ficha ainda não foi calculada -- o inventário depende da Força e do Deslocamento do personagem.</p>
          )}
        </div>
      )}

      {abaAtiva === 'background' && (
        <div className="card-fantasy p-6">
          <div className="flex items-center gap-1 border-b border-panel-border mb-5 overflow-x-auto">
            {CAMPOS_BACKGROUND.map((campo) => (
              <BotaoAba
                key={campo.chave}
                ativo={abaBackgroundAtiva === campo.chave}
                onClick={() => setAbaBackgroundAtiva(campo.chave)}
                className="text-xs px-3 py-1.5"
              >
                {campo.rotulo}
              </BotaoAba>
            ))}
          </div>

          {CAMPOS_BACKGROUND.filter((c) => c.chave === abaBackgroundAtiva).map((campo) => (
            <div key={campo.chave}>
              {ehDono ? (
                <textarea
                  value={background[campo.chave] ?? ''}
                  onChange={(e) => setBackground((prev) => ({ ...prev, [campo.chave]: e.target.value }))}
                  placeholder={campo.placeholder}
                  rows={12}
                  className="campo-input w-full resize-y"
                />
              ) : (
                <p className="text-sm text-white whitespace-pre-wrap min-h-[8rem]">
                  {background[campo.chave]?.trim() ? background[campo.chave] : <span className="text-mist">Nada escrito ainda.</span>}
                </p>
              )}
            </div>
          ))}

          {ehDono && <BotaoSalvarCosmetico className="mt-4" />}
        </div>
      )}
    </div>
  )
}
