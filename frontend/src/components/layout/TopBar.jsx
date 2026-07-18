import { ShieldQuestion, Bell, Users } from 'lucide-react'

function IconBtn({ children }) {
  return (
    <button className="w-10 h-10 rounded-md border border-panel-border flex items-center justify-center text-mist hover:text-white hover:border-white/30 transition-colors">
      {children}
    </button>
  )
}

export default function TopBar() {
  return (
    <>
      <div className="h-[3px] bg-gradient-to-r from-blood-dark via-blood-bright to-blood-dark" />
      <header className="flex items-center justify-end gap-3 px-8 py-6">
        <IconBtn><ShieldQuestion size={18} /></IconBtn>
        <IconBtn><Bell size={18} /></IconBtn>
        <IconBtn><Users size={18} /></IconBtn>
      </header>
    </>
  )
}
