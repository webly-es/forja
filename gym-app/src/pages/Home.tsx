import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { StatCard } from '../components/StatCard'
import { getBMI, getBMICategory, getTargetCalories, getMacros, getAge } from '../lib/metrics'
import { Dumbbell } from 'lucide-react'

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

  if (!profile) return null

  const bmi = getBMI(profile.weightKg, profile.heightCm)
  const calories = Math.round(getTargetCalories(profile))
  const macros = getMacros(profile)
  const age = getAge(profile.birthDate)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Hola, {profile.name}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {age} años · {profile.heightCm} cm · {(lastWeightLog?.weightKg ?? profile.weightKg)} kg
        </p>
      </div>

      <button
        onClick={() => navigate('/workout/start')}
        className="flex items-center justify-center gap-2 rounded-xl bg-accent py-4 font-medium text-bg transition-colors hover:bg-accent-hover"
      >
        <Dumbbell size={20} />
        Empezar entrenamiento
      </button>

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
