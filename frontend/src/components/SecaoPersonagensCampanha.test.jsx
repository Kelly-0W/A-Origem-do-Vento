import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SecaoPersonagensCampanha from './SecaoPersonagensCampanha.jsx'

const catalogo = {
  racas: { humano: { nome: 'Humano' } },
  classes: { gladiador: { nome: 'Gladiador' } },
}

const participantes = [
  {
    id: 'personagem-1',
    nome_personagem: 'Robervones',
    raca_id: 'humano',
    classe_id: 'gladiador',
    dono_nome: 'Clara',
    imagem_base64: null,
  },
  {
    id: 'personagem-2',
    nome_personagem: 'Aira Windar',
    raca_id: 'humano',
    classe_id: 'gladiador',
    dono_nome: 'Evelyn Louise',
    imagem_base64: null,
  },
]

function renderizar(props) {
  return render(
    <MemoryRouter>
      <SecaoPersonagensCampanha catalogo={catalogo} {...props} />
    </MemoryRouter>
  )
}

describe('SecaoPersonagensCampanha', () => {
  it('usa exatamente o título "Personagens da Campanha"', () => {
    renderizar({ participantes: [], ehMestre: false })
    expect(screen.getByRole('heading', { name: 'Personagens da Campanha' })).toBeInTheDocument()
  })

  it('mostra a mensagem de vazio quando não há participantes', () => {
    renderizar({ participantes: [], ehMestre: false })
    expect(screen.getByText('Ninguém trouxe um personagem pra essa campanha ainda.')).toBeInTheDocument()
  })

  it('renderiza um card por participante', () => {
    renderizar({ participantes, ehMestre: false })
    expect(screen.getByText('Robervones')).toBeInTheDocument()
    expect(screen.getByText('Aira Windar')).toBeInTheDocument()
    expect(screen.getByText(/Jogado por Clara/)).toBeInTheDocument()
    expect(screen.getByText(/Jogado por Evelyn Louise/)).toBeInTheDocument()
  })

  it('jogador comum NÃO vê os cards como clicáveis', () => {
    renderizar({ participantes, ehMestre: false })
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('mestre vê cada personagem como link pra ficha completa, abrindo em aba nova', () => {
    renderizar({ participantes, ehMestre: true })
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(participantes.length)

    const linkRobervones = screen.getByText('Robervones').closest('a')
    expect(linkRobervones).toHaveAttribute('href', '/personagens/personagem-1')
    expect(linkRobervones).toHaveAttribute('target', '_blank')
    expect(linkRobervones).toHaveAttribute('rel', expect.stringContaining('noopener'))

    const linkAira = screen.getByText('Aira Windar').closest('a')
    expect(linkAira).toHaveAttribute('href', '/personagens/personagem-2')
    expect(linkAira).toHaveAttribute('target', '_blank')
  })
})
