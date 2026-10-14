import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { StatCard } from '../components/StatCard'
import { getBMI, getBMICategory, getTargetCalories, getMacros, getAge } from '../lib/metrics'
import { useDayBalance } from '../hooks/useDayBalance'
import { todayKey } from '../lib/dates'
import { ChevronRight, Dumbbell } from 'lucide-react'

function formatRelativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `Hace ${days} días`
}

export function Home() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const navigate = useNavigate()
  const profile = useLiveQuery(() => db.profiles.get(activeProfileId), [activeProfileId])

  const lastWeightLog = useLiveQuery(
    () =>
      db.bodyWeightLogs
        .where('profileId')
        .equals(activeProfileId)
        .toArray()
        .then((logs) => logs.sort((a, b) => b.date.localeCompare(a.date))[0]),
    [activeProfileId],
  )

  const lastSession = useLiveQuery(
    () =>
      db.workoutSessions
        .where('profileId')
        .equals(activeProfileId)
        .toArray()
        .then(
          (sessions) =>
            sessions
              .filter((s) => s.finishedAt)
              .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0],
        ),
    [activeProfileId],
  )

  const today = useDayBalance(activeProfileId, todayKey())

  if (!profile) return null

  const bmi = getBMI(profile.weightKg, profile.heightCm)
  const calories = Math.round(getTargetCalories(profile))
  const macros = getMacros(profile)
  const age = getAge(profile.birthDate)

  return (
    <div className="flex flex-col gap-6">
      <div className="relative -mx-4 overflow-hidden px-4 pb-2 pt-4">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full"
          style={{
            background: 'radial-gradient(closest-side, rgba(201,151,63,0.16), rgba(201,151,63,0) 70%)',
            filter: 'blur(24px)',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
          aria-hidden="true"
        />

        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Tu progreso hoy</p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-text">Hola, {profile.name}</h1>
          <div className="mt-3 h-px w-12 bg-gradient-to-r from-accent to-transparent" />
          <p className="mt-3 text-sm text-text-muted">
            {age} años · {profile.heightCm} cm · {(lastWeightLog?.weightKg ?? profile.weightKg)} kg
          </p>
        </div>
      </div>

      <button
        onClick={() => navigate('/workout/start')}
        className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-accent-hover to-accent py-4 font-semibold text-bg shadow-[0_8px_24px_-6px_rgba(201,151,63,0.5)] transition-all duration-150 active:scale-[0.97] active:shadow-[0_4px_12px_-4px_rgba(201,151,63,0.4)]"
      >
        <Dumbbell size={20} />
        Empezar entrenamiento
      </button>

      <div className="rounded-2xl border border-accent-muted/60 bg-gradient-to-b from-surface to-surface-2 p-4">
        <div className="text-xs uppercase tracking-wide text-text-muted">Último entrenamiento</div>
        <div className="mt-1 text-xl font-semibold text-text">
          {lastSession ? lastSession.routineName : 'Aún sin registros'}
        </div>
        {lastSession && (
          <div className="mt-0.5 text-xs text-accent">{formatRelativeDate(lastSession.startedAt)}</div>
        )}
      </div>

      {today && (
        <button
          onClick={() => navigate('/food')}
          className="rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wide text-text-muted">Hoy</div>
            <ChevronRight size={16} className="text-text-muted" />
          </div>
          <div className="mt-2 grid grid-cols-3">
            <div>
              <div className="text-lg font-semibold text-text">{Math.round(today.consumed.kcal)}</div>
              <div className="text-xs text-text-muted">consumidas</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-text">{today.energy.total}</div>
              <div className="text-xs text-text-muted">gastadas</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-accent">
                {Math.abs(Math.round(today.consumed.kcal - today.energy.total))}
              </div>
              <div className="text-xs text-text-muted">
                {today.consumed.kcal - today.energy.total <= 0 ? 'déficit' : 'superávit'}
              </div>
            </div>
          </div>
        </button>
      )}

      <div>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-text-muted">Tus métricas</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="IMC" value={bmi.toFixed(1)} hint={getBMICategory(bmi)} />
          <StatCard label="Calorías objetivo" value={`${calories}`} hint="kcal / día" />
          <StatCard label="Proteína" value={`${macros.proteinG} g`} />
          <StatCard label="Grasa" value={`${macros.fatG} g`} />
          <StatCard label="Carbohidratos" value={`${macros.carbsG} g`} />
        </div>
      </div>
    </div>
  )
}
