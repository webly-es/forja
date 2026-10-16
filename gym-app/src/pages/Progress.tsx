import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { ActivityHeatmap } from '../components/ActivityHeatmap'
import { NutritionSection } from '../components/progress/NutritionSection'
import { BodyWeightSection } from '../components/progress/BodyWeightSection'
import { MeasurementsSection } from '../components/progress/MeasurementsSection'
import { ExerciseProgressSection } from '../components/progress/ExerciseProgressSection'

export function Progress() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const profile = useLiveQuery(() => db.profiles.get(activeProfileId), [activeProfileId])
  if (!profile) return null

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-text">Progreso</h1>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-text-muted">Constancia</h2>
        <ActivityHeatmap profileId={activeProfileId} />
      </section>

      <ExerciseProgressSection profileId={activeProfileId} />
      <BodyWeightSection profileId={activeProfileId} currentWeight={profile.weightKg} goal={profile.goal} />
      <MeasurementsSection profileId={activeProfileId} />
      <NutritionSection profileId={activeProfileId} />
    </div>
  )
}
