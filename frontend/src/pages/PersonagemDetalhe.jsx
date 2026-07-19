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

export default function PersonagemDetalhe() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const navigate = useNavigate()

  const [excluindo, setExcluindo] = useState(false)
  const [erroExcluir, setErroExcluir] = useState(null)

  const [carregando, setCarregando] = useState(true)
  const [erroCarregamento, setErroCarregamento] = useState(null)
  const [personagem, setPersonagem] = useState(null)
  const [catalogo, setCatalogo] = useState({ racas: {}, classes: {}, origens: {}, elementos: {}, pericias: {} })

  const [nomePersonagem, setNomePersonagem] = useState('')
  const [imagemBase64, setImagemBase64] = useState(null)
  const [anotacoes, setAnotacoes] = useState('')
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
        const colecoes = ['racas', 'classes', 'origens', 'elementos', 'pericias']
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
        setAnotacoes(dados.anotacoes || '')
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
        anotacoes,
        atualizado_em: serverTimestamp(),
      })
      setPersonagem((prev) => ({
        ...prev,
        escolhas: { ...prev.escolhas, nome_personagem: nomePersonagem.trim() },
        imagem_base64: imagemBase64,
        anotacoes,
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
  const raca = catalogo.racas[escolhas.raca_id] || null
  const linhagem = (raca?.linhagens || []).find((l) => l.id === escolhas.linhagem_id) || null
  const classe = catalogo.classes[escolhas.classe_id] || null
  const origem = catalogo.origens[escolhas.origem_id] || null
  const elemento = catalogo.elementos[escolhas.elemento_id] || null
  const isCaca = escolhas.elemento_id === 'caca'

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-6">
        <Link to="/personagens" className="flex items-center gap-1 text-mist text-sm hover:text-white w-fit">
          <ChevronLeft size={16} /> Voltar
        </Link>
        <button
          onClick={excluirPersonagem}
          disabled={excluindo}
          className="text-xs text-mist hover:text-blood-bright transition-colors disabled:opacity-50"
        >
          {excluindo ? 'Excluindo...' : 'Excluir personagem'}
        </button>
      </div>
      {erroExcluir && <p className="text-blood-bright text-xs mb-4">{erroExcluir}</p>}

      <div className="flex flex-col sm:flex-row gap-6 mb-10">
        <div className="shrink-0">
          <div className="w-32 h-32 rounded-lg border border-panel-border bg-void overflow-hidden flex items-center justify-center">
            {imagemBase64 ? (
              <img src={imagemBase64} alt={nomePersonagem || 'Retrato do personagem'} className="w-full h-full object-cover" />
            ) : (
              <span className="text-mist text-xs text-center px-2">Sem retrato</span>
            )}
          </div>
          <label className="btn-secondary text-xs mt-3 inline-block cursor-pointer">
            {processandoImagem ? 'Processando...' : 'Trocar retrato'}
            <input type="file" accept="image/*" className="hidden" onChange={selecionarImagem} disabled={processandoImagem} />
          </label>
          {erroImagem && <p className="text-blood-bright text-xs mt-2">{erroImagem}</p>}
        </div>

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

          <label className="flex flex-col gap-1.5 mb-4">
            <span className="text-[11px] uppercase tracking-widest text-mist">Anotações</span>
            <textarea
              value={anotacoes}
              onChange={(e) => setAnotacoes(e.target.value)}
              placeholder="Histórico, ganchos de campanha, lembretes..."
              rows={4}
              className="campo-input resize-y"
            />
          </label>

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
      </div>

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
          elemento={elemento}
          escolhas={escolhas}
          isCaca={isCaca}
          interativo
          personagemId={id}
          donoUid={usuario.uid}
          onAtualizado={(novoCalculado, novasEscolhas) =>
            setPersonagem((prev) => ({ ...prev, calculado: novoCalculado, escolhas: novasEscolhas }))
          }
        />
      )}

      <PainelAscensao
        personagemId={id}
        grauAscensao={personagem.grau_ascensao ?? 0}
        ascensaoEmProgresso={personagem.ascensao_em_progresso}
        classe={classe}
        origem={origem}
        onAtualizado={(novaAscensao) =>
          setPersonagem((prev) => ({ ...prev, ascensao_em_progresso: novaAscensao }))
        }
      />
    </div>
  )
}
