import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import TopBar from './TopBar.jsx'

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-void">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <TopBar />
        <main className="px-8 pb-12 animate-fade-up">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
