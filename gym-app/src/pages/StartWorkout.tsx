import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { getRoutineSummaries, type RoutineSummary } from '../db/queries'
import { useAppStore } from '../store/useAppStore'
import { CardioPanel } from '../components/CardioPanel'
import { CheckInSheet } from '../components/cycle/CheckInSheet'
import { getCheckIn } from '../db/cycle'
import { todayKey } from '../lib/dates'
import { coverUrl } from '../lib/routineCovers'
import { HeartPulse, ListChecks, Plus, Pencil } from 'lucide-react'

type Mode = 'strength' | 'cardio'

export function StartWorkout() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId)
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('strength')
  const [checkInOpen, setCheckInOpen] = useState(false)
  const today = todayKey()

  const profile = useLiveQuery(() => db.profiles.get(activeProfileId), [activeProfileId])
  const routines = useLiveQuery(() => db.routines.toArray(), [], [])
  const summaries = useLiveQuery(getRoutineSummaries, [], {} as Record<number, RoutineSummary>)
  // null while loading, so the prompt doesn't flash in when today's check-in exists.
  const checkIn = useLiveQuery(async () => (await getCheckIn(activeProfileId, today)) ?? false, [activeProfileId, today], null)
  const tracksCycle = profile?.sex === 'F' && profile.cycle != null && profile.cycle.method !== 'off'

  async function startRoutine(routineId: number, routineName: string) {
    const sessionId = (await db.workoutSessions.add({
      profileId: activeProfileId,
      routineId,
      routineName,
      startedAt: new Date().toISOString(),
    })) as number
    setActiveSessionId(sessionId)
    navigate(`/workout/active/${sessionId}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Empezar entrenamiento</h1>
        <p className="mt-1 text-sm text-text-muted">Elige el tipo de entrenamiento de hoy</p>
      </div>

      <div className="flex gap-2 rounded-xl border border-border bg-surface p-1">
        <button
          onClick={() => setMode('strength')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all active:scale-[0.97] ${
            mode === 'strength' ? 'bg-accent text-bg' : 'text-text-muted'
          }`}
        >
          Fuerza
        </button>
        <button
          onClick={() => setMode('cardio')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all active:scale-[0.97] ${
            mode === 'cardio' ? 'bg-accent text-bg' : 'text-text-muted'
          }`}
        >
          Cardio y actividad
        </button>
      </div>

      {tracksCycle && checkIn === false && (
        <button
          onClick={() => setCheckInOpen(true)}
          className="card-forged flex items-center gap-3 p-4 text-left transition-colors hover:border-accent-muted"
        >
          <HeartPulse size={18} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-text">¿Cómo llegas hoy?</span>
            <span className="block text-xs text-text-muted">Energía, dolor y sueño en tres toques. Opcional.</span>
          </span>
        </button>
      )}

      {mode === 'strength' ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/workout/routines/new')}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-text-muted transition-transform hover:border-accent hover:text-accent active:scale-[0.97]"
            >
              <Plus size={16} />
              Crear rutina
            </button>
            <button
              onClick={() => navigate('/exercises')}
              className="flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm text-text-muted transition-transform hover:border-accent hover:text-accent active:scale-[0.97]"
            >
              <ListChecks size={16} />
              Ejercicios
            </button>
          </div>
          {routines?.map((r) => {
            const summary = summaries[r.id!]
            return (
              <div key={r.id} className="card-forged relative h-28 overflow-hidden">
                <img
                  src={coverUrl(summary?.cover ?? 'general')}
                  alt=""
                  className="absolute inset-0 -z-10 h-full w-full object-cover object-right"
                />
                <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/60 to-transparent" />
                <button
                  onClick={() => startRoutine(r.id!, r.name)}
                  className="flex h-full w-full flex-col justify-end p-4 pr-14 text-left transition-transform active:scale-[0.98]"
                >
                  <span className="font-display text-xl font-medium uppercase leading-tight tracking-wide text-text">
                    {r.name}
                  </span>
                  <span className="mt-1 text-xs text-accent">{summary?.exerciseCount ?? 0} ejercicios</span>
                </button>
                <button
                  onClick={() => navigate(`/workout/routines/${r.id}/edit`)}
                  className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-bg/60 text-text-muted backdrop-blur transition-colors hover:text-text"
                  aria-label="Editar rutina"
                >
                  <Pencil size={15} />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        profile && <CardioPanel profile={profile} />
      )}

      {checkInOpen && <CheckInSheet profileId={activeProfileId} date={today} onClose={() => setCheckInOpen(false)} />}
    </div>
  )
}
