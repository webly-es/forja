import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { GOAL_SHORT_LABELS, getAge } from '../lib/metrics'
import { HERO_IMAGE } from '../lib/routineCovers'
import { ChevronRight, Plus } from 'lucide-react'

export function SelectProfile() {
  const profiles = useLiveQuery(() => db.profiles.toArray(), [], [])
  const setActiveProfileId = useAppStore((s) => s.setActiveProfileId)
  const navigate = useNavigate()

  function selectProfile(id: number) {
    setActiveProfileId(id)
    navigate('/home')
  }

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden px-6 pb-10">
      <img
        src={HERO_IMAGE}
        alt=""
        className="pointer-events-none absolute inset-x-0 top-0 h-80 w-full object-cover object-[70%_center] opacity-80"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-t from-bg via-bg/50 to-bg/30" aria-hidden="true" />

      <div className="relative pt-44">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-accent">Forja</p>
        <h1 className="mt-1.5 font-display text-4xl font-medium uppercase tracking-wide text-text">¿Quién entrena hoy?</h1>
        <div className="mt-3 h-px w-14 bg-gradient-to-r from-accent to-transparent" />
      </div>

      <div className="relative mt-8 flex flex-col gap-3">
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => selectProfile(p.id!)}
            className="card-forged flex items-center gap-4 p-4 text-left transition-transform active:scale-[0.98]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-accent/60 bg-accent-muted/40 font-display text-xl uppercase text-accent">
              {p.name.trim().charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-lg uppercase tracking-wide text-text">{p.name}</span>
              <span className="block text-xs text-text-muted">
                {getAge(p.birthDate)} años · <span className="text-accent">{GOAL_SHORT_LABELS[p.goal]}</span>
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-text-muted" />
          </button>
        ))}

        <button
          onClick={() => navigate('/setup')}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-4 text-sm text-text-muted transition-all hover:border-accent hover:text-accent active:scale-[0.97]"
        >
          <Plus size={18} />
          Crear perfil
        </button>
      </div>
    </div>
  )
}
