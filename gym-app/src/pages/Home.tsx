import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { StatCard } from '../components/StatCard'
import { getBMI, getBMICategory, getTargetCalories, getMacros, getAge } from '../lib/metrics'
import { useDayBalance } from '../hooks/useDayBalance'
import { todayKey } from '../lib/dates'
import { getRoutineSummaries, type RoutineSummary } from '../db/queries'
import { coverUrl, HERO_IMAGE } from '../lib/routineCovers'
import { CalorieRing } from '../components/CalorieRing'
import { StreakCard } from '../components/StreakCard'
import { CycleCard } from '../components/cycle/CycleCard'
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
  const summaries = useLiveQuery(getRoutineSummaries, [], {} as Record<number, RoutineSummary>)

  if (!profile) return null

  const bmi = getBMI(profile.weightKg, profile.heightCm)
  // Today's target moves with steps and training; the profile estimate is only a fallback while loading.
  const calories = Math.round(today?.target ?? getTargetCalories(profile))
  const macros = today?.macros ?? getMacros(profile)
  const age = getAge(profile.birthDate)

  const lastCover = lastSession ? (summaries[lastSession.routineId]?.cover ?? 'general') : null
  const balance = today ? Math.round(today.consumed.kcal - today.energy.total) : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="relative -mx-4 -mt-6 overflow-hidden px-4 pb-4 pt-10">
        <img
          src={HERO_IMAGE}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[70%_center] opacity-90"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-bg/40"
          aria-hidden="true"
        />

        <div className="relative pt-28">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">Tu progreso hoy</p>
          <h1 className="mt-1.5 font-display text-4xl font-medium uppercase tracking-wide text-text">
            Hola, {profile.name}
          </h1>
          <div className="mt-3 h-px w-14 bg-gradient-to-r from-accent to-transparent" />
          <p className="mt-3 text-sm text-text-muted">
            {age} años · {profile.heightCm} cm · {(lastWeightLog?.weightKg ?? profile.weightKg)} kg
          </p>
        </div>
      </div>

      <button
        onClick={() => navigate('/workout/start')}
        className="-mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#e2b866] via-accent to-[#a87a2c] py-4 font-semibold text-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_28px_-8px_rgba(201,151,63,0.55)] transition-all duration-150 active:scale-[0.97]"
      >
        <Dumbbell size={20} />
        Empezar entrenamiento
      </button>

      <div className="card-forged relative overflow-hidden p-4">
        {lastCover && (
          <>
            <img
              src={coverUrl(lastCover)}
              alt=""
              className="absolute inset-y-0 right-0 -z-10 h-full w-2/3 object-cover object-right"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-surface via-surface/85 to-surface/10" />
          </>
        )}
        <div className="text-xs uppercase tracking-wide text-text-muted">Último entrenamiento</div>
        <div className="mt-1 font-display text-2xl font-medium uppercase tracking-wide text-text">
          {lastSession ? lastSession.routineName : 'Aún sin registros'}
        </div>
        {lastSession && (
          <div className="mt-0.5 text-xs text-accent">{formatRelativeDate(lastSession.startedAt)}</div>
        )}
      </div>

      <StreakCard profileId={activeProfileId} />

      <CycleCard profileId={activeProfileId} />

      {today && (
        <button
          onClick={() => navigate('/food')}
          className="card-forged flex items-center gap-4 p-4 text-left transition-colors hover:border-accent-muted"
        >
          <CalorieRing consumed={today.consumed.kcal} target={calories} />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-text-muted">Hoy</span>
              <ChevronRight size={16} className="text-text-muted" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-text-muted">Consumidas</span>
              <span className="font-display text-lg text-text">{Math.round(today.consumed.kcal)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-text-muted">Gastadas</span>
              <span className="font-display text-lg text-text">{today.energy.total}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-text-muted">{balance <= 0 ? 'Déficit' : 'Superávit'}</span>
              <span className="font-display text-lg text-accent">{Math.abs(balance)}</span>
            </div>
          </div>
        </button>
      )}

      <div>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-text-muted">Tus métricas</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="IMC" value={bmi.toFixed(1)} hint={getBMICategory(bmi)} />
          <StatCard label="Objetivo hoy" value={`${calories}`} hint="kcal / día" />
          <StatCard label="Proteína" value={`${macros.proteinG} g`} />
          <StatCard label="Grasa" value={`${macros.fatG} g`} />
          <StatCard label="Carbohidratos" value={`${macros.carbsG} g`} />
        </div>
      </div>
    </div>
  )
}
