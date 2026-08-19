// Teste de regressão em cima do CÓDIGO-FONTE (não do DOM renderizado).
//
// Por quê: CampanhaDetalhe.jsx e PainelMestre.jsx dependem de Firebase
// Auth/Firestore, do AuthContext e de vários endpoints (api.js) pra
// montar de verdade -- simular tudo isso só pra provar "esse texto não
// existe mais nesses dois arquivos" seria um mock enorme pra pouco
// ganho. SecaoPersonagensCampanha.test.jsx já cobre o comportamento real
// (título, card único, link só pro mestre) via render de verdade; este
// arquivo cobre a OUTRA metade do pedido -- que a seção antiga de
// anotações sumiu e que a seção duplicada de personagens não existe mais
// nas duas páginas ao mesmo tempo.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const diretorioAtual = dirname(fileURLToPath(import.meta.url))
const fonteCampanhaDetalhe = readFileSync(join(diretorioAtual, 'CampanhaDetalhe.jsx'), 'utf-8')
const fontePainelMestre = readFileSync(join(diretorioAtual, '..', 'components', 'PainelMestre.jsx'), 'utf-8')

describe('remoção da seção de anotações "Jogadores Esperados"', () => {
  it('não existe mais em CampanhaDetalhe.jsx', () => {
    expect(fonteCampanhaDetalhe).not.toMatch(/Jogadores Esperados/)
    expect(fonteCampanhaDetalhe).not.toMatch(/jogadores_esperados/)
  })

  it('não existe mais em nenhum outro arquivo de página/componente da campanha', () => {
    expect(fontePainelMestre).not.toMatch(/Jogadores Esperados/)
  })
})

describe('unificação das seções de personagens/participantes', () => {
  it('CampanhaDetalhe.jsx não tem mais a seção antiga "Participantes da Campanha" (virou "Personagens da Campanha")', () => {
    expect(fonteCampanhaDetalhe).not.toMatch(/Participantes da Campanha/)
  })

  it('PainelMestre.jsx não tem mais a seção duplicada "Todos os Personagens da Mesa"', () => {
    expect(fontePainelMestre).not.toMatch(/Todos os Personagens da Mesa/)
  })

  it('o título "Personagens da Campanha" aparece em exatamente um lugar (CampanhaDetalhe.jsx, via SecaoPersonagensCampanha)', () => {
    const ocorrenciasNaPagina = (fonteCampanhaDetalhe.match(/Personagens da Campanha/g) || []).length
    const ocorrenciasNoPainel = (fontePainelMestre.match(/Personagens da Campanha/g) || []).length
    expect(ocorrenciasNaPagina + ocorrenciasNoPainel).toBe(0) // o texto do título mora só dentro de SecaoPersonagensCampanha.jsx
  })

  it('CampanhaDetalhe.jsx usa o componente unificado SecaoPersonagensCampanha', () => {
    expect(fonteCampanhaDetalhe).toMatch(/SecaoPersonagensCampanha/)
  })
})
