import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import RotaProtegida from './components/RotaProtegida.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Personagens from './pages/Personagens.jsx'
import PersonagemDetalhe from './pages/PersonagemDetalhe.jsx'
import CharacterWizard from './pages/CharacterWizard.jsx'
import Campanhas from './pages/Campanhas.jsx'
import Combate from './pages/Combate.jsx'
import Biblioteca from './pages/Biblioteca.jsx'
import EmBreve from './pages/EmBreve.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RotaProtegida><AppLayout /></RotaProtegida>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/personagens" element={<Personagens />} />
        <Route path="/personagens/novo" element={<CharacterWizard />} />
        <Route path="/personagens/:id" element={<PersonagemDetalhe />} />
        <Route path="/campanhas" element={<Campanhas />} />
        <Route path="/combate" element={<Combate />} />
        <Route path="/biblioteca" element={<Biblioteca />} />
        <Route path="/homebrew" element={<EmBreve titulo="Homebrew" descricao="Crie suas próprias regras, classes e criaturas." />} />
        <Route path="/configuracoes" element={<EmBreve titulo="Configurações" descricao="Personalize sua experiência de jogo." />} />
      </Route>
    </Routes>
  )
}
