import { coverForGroups, coverUrl } from '../../lib/routineCovers'
import { formatPrescription } from '../../lib/prescription'
import type { AiRoutine, Exercise } from '../../types'

// One day proposed by the AI: cover, focus and each exercise with its prescription and reason.
export function AiRoutineCard({ routine, exercisesById }: { routine: AiRoutine; exercisesById: Map<number, Exercise> }) {
  const groups = routine.items.flatMap((i) => exercisesById.get(i.exerciseId)?.muscleGroup ?? [])
  return (
    <div className="card-forged overflow-hidden">
      <div className="relative h-20">
        <img src={coverUrl(coverForGroups(groups))} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-right" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/70 to-transparent" />
        <div className="flex h-full flex-col justify-end px-4 pb-2.5">
          <span className="font-display text-lg uppercase leading-tight tracking-wide text-text">{routine.name}</span>
          {routine.focus && <span className="truncate text-xs text-text-muted">{routine.focus}</span>}
        </div>
      </div>
      <ol className="divide-y divide-white/[0.06]">
        {routine.items.map((item, i) => (
          <li key={item.exerciseId} className="flex gap-3 px-4 py-2.5">
            <span className="mt-0.5 font-display text-sm text-accent">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-text">{exercisesById.get(item.exerciseId)?.name}</span>
                <span className="shrink-0 text-xs font-medium text-accent">{formatPrescription({ ...item, restSeconds: undefined })}</span>
              </span>
              {item.reason && <span className="mt-0.5 block text-xs leading-relaxed text-text-muted">{item.reason}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
