import { NavLink, Outlet } from 'react-router-dom'
import { Home, Dumbbell, History, LineChart, Settings, Utensils } from 'lucide-react'

const TABS = [
  { to: '/home', label: 'Inicio', icon: Home },
  { to: '/workout/start', label: 'Entrenar', icon: Dumbbell },
  { to: '/food', label: 'Comida', icon: Utensils },
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
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06] bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                  isActive ? 'text-accent' : 'text-text-muted hover:text-text'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-x-1/4 top-0 h-0.5 rounded-full bg-accent shadow-[0_0_10px_rgba(201,151,63,0.8)]" />
                  )}
                  <Icon size={20} strokeWidth={1.75} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
