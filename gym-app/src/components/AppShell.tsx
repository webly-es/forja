import { NavLink, Outlet } from 'react-router-dom'
import { Home, Dumbbell, History, LineChart, ListChecks, Settings } from 'lucide-react'

const TABS = [
  { to: '/home', label: 'Inicio', icon: Home },
  { to: '/workout/start', label: 'Entrenar', icon: Dumbbell },
  { to: '/exercises', label: 'Ejercicios', icon: ListChecks },
  { to: '/history', label: 'Historial', icon: History },
  { to: '/progress', label: 'Progreso', icon: LineChart },
  { to: '/settings', label: 'Ajustes', icon: Settings },
]

export function AppShell() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-4 pb-24 pt-6">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                  isActive ? 'text-accent' : 'text-text-muted hover:text-text'
                }`
              }
            >
              <Icon size={20} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
