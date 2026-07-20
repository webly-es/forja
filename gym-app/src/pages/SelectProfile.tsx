import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { Plus, User } from 'lucide-react'

export function SelectProfile() {
  const profiles = useLiveQuery(() => db.profiles.toArray(), [], [])
  const setActiveProfileId = useAppStore((s) => s.setActiveProfileId)
  const navigate = useNavigate()

  function selectProfile(id: number) {
    setActiveProfileId(id)
    navigate('/home')
  }

  const loading = profiles === undefined

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-text">¿Quién entrena hoy?</h1>
        <p className="mt-1 text-center text-sm text-text-muted">Selecciona tu perfil para continuar</p>

        <div className="mt-8 flex flex-col gap-3">
          {!loading &&
            profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => selectProfile(p.id!)}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-accent">
                  <User size={20} />
                </span>
                <div>
                  <div className="font-medium text-text">{p.name}</div>
                  <div className="text-xs text-text-muted">{p.sex === 'M' ? 'Hombre' : 'Mujer'}</div>
                </div>
              </button>
            ))}

          <button
            onClick={() => navigate('/setup')}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <Plus size={18} />
            Crear perfil
          </button>
        </div>
      </div>
    </div>
  )
}
