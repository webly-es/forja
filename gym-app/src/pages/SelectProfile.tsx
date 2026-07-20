import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { deleteProfile } from '../db/queries'
import { useAppStore } from '../store/useAppStore'
import { Plus, User, Trash2 } from 'lucide-react'

export function SelectProfile() {
  const profiles = useLiveQuery(() => db.profiles.toArray(), [], [])
  const activeProfileId = useAppStore((s) => s.activeProfileId)
  const setActiveProfileId = useAppStore((s) => s.setActiveProfileId)
  const navigate = useNavigate()
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null)

  function selectProfile(id: number) {
    setActiveProfileId(id)
    navigate('/home')
  }

  async function handleDeleteProfile(id: number) {
    await deleteProfile(id)
    if (activeProfileId === id) setActiveProfileId(null)
    setConfirmingDeleteId(null)
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
              <div
                key={p.id}
                className="rounded-xl border border-border bg-surface transition-colors hover:border-accent"
              >
                {confirmingDeleteId === p.id ? (
                  <div className="flex items-center justify-between gap-3 p-4">
                    <span className="text-sm text-text">¿Eliminar a {p.name} y todo su historial?</span>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => setConfirmingDeleteId(null)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted"
                      >
                        No
                      </button>
                      <button
                        onClick={() => handleDeleteProfile(p.id!)}
                        className="rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-bg"
                      >
                        Sí, eliminar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-4">
                    <button
                      onClick={() => selectProfile(p.id!)}
                      className="flex flex-1 items-center gap-4 text-left"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-accent">
                        <User size={20} />
                      </span>
                      <div>
                        <div className="font-medium text-text">{p.name}</div>
                        <div className="text-xs text-text-muted">{p.sex === 'M' ? 'Hombre' : 'Mujer'}</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setConfirmingDeleteId(p.id!)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-danger"
                      aria-label={`Eliminar perfil de ${p.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
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
