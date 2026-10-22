import { equipmentOf } from './equipment'
import { REP_RANGES } from './repRanges'
import type { Exercise, ExerciseTarget, Goal, RoutineItem, SetLog } from '../types'

export interface LiveHint {
  tone: 'up' | 'down' | 'ok' | 'done'
  text: string
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step
const kg = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })

// Instant, offline advice after each set, from the routine's rep range, the coach's target
// or, failing both, the profile goal's range. No AI here: waiting for a model between sets would get in the way.
export function liveHint(
  exercise: Exercise,
  sets: SetLog[],
  plan?: RoutineItem,
  target?: ExerciseTarget,
  goal?: Goal,
): LiveHint | null {
  const last = sets[sets.length - 1]
  if (!last) return null
  const fallback = goal ? REP_RANGES[goal] : undefined
  const repMin = plan?.repMin ?? target?.reps ?? fallback?.min
  const repMax = plan?.repMax ?? plan?.repMin ?? target?.reps ?? fallback?.max
  if (plan?.sets != null && sets.length >= plan.sets) {
    return { tone: 'done', text: `${plan.sets} series hechas. Pasa al siguiente ejercicio.` }
  }
  if (repMin == null || repMax == null) return null
  if (last.bodyKg != null) return bodyweightHint(last, repMin, repMax)
  if (last.weightKg <= 0) return null

  const dumbbells = equipmentOf(exercise) === 'Mancuernas'
  if (last.reps > repMax) {
    return {
      tone: 'up',
      text: `Te sobran repeticiones (${last.reps} de ${repMax}): sube ${dumbbells ? '1-2 kg por mancuerna' : '2,5 kg'} en la próxima.`,
    }
  }
  if (last.reps < repMin - 2) {
    const lighter = roundTo(last.weightKg * 0.92, dumbbells ? 1 : 2.5)
    return {
      tone: 'down',
      text: `Lejos de ${repMin} repeticiones: baja a unos ${kg(Math.max(0, Math.min(lighter, last.weightKg - (dumbbells ? 1 : 2.5))))} kg para completar el rango.`,
    }
  }
  if (last.reps < repMin) {
    return { tone: 'ok', text: `Cerca del rango: mantén ${kg(last.weightKg)} kg y busca ${repMin} repeticiones.` }
  }
  const range = repMin === repMax ? `${repMin}` : `${repMin}-${repMax}`
  return { tone: 'ok', text: `En rango (${range}). Mantén ${kg(last.weightKg)} kg${last.reps < repMax ? ` y busca ${last.reps + 1} repeticiones` : ''}.` }
}

// Bodyweight exercises progress by reps first, then added weight in 2,5 kg steps.
function bodyweightHint(last: SetLog, repMin: number, repMax: number): LiveHint {
  const added = last.weightKg
  if (last.reps > repMax) {
    return {
      tone: 'up',
      text: `Te sobran repeticiones (${last.reps} de ${repMax}): ${added > 0 ? `sube a ${kg(added + 2.5)} kg de lastre` : 'añade 2,5 kg de lastre'} en la próxima.`,
    }
  }
  if (last.reps < repMin - 2) {
    return {
      tone: 'down',
      text:
        added > 0
          ? `Lejos de ${repMin} repeticiones: ${added > 2.5 ? `baja a ${kg(roundTo(added * 0.5, 2.5))} kg de lastre` : 'quita el lastre'} para completar el rango.`
          : `Lejos de ${repMin} repeticiones: completa con negativas lentas o pasa a una variante más fácil.`,
    }
  }
  if (last.reps < repMin) {
    return { tone: 'ok', text: `Cerca del rango: sigue ${added > 0 ? `${kg(added)} kg de lastre` : 'sin lastre'} y busca ${repMin} repeticiones.` }
  }
  const range = repMin === repMax ? `${repMin}` : `${repMin}-${repMax}`
  const load = added > 0 ? `${kg(added)} kg de lastre` : 'sin lastre'
  return { tone: 'ok', text: `En rango (${range}). Sigue ${load}${last.reps < repMax ? ` y busca ${last.reps + 1} repeticiones` : ''}.` }
}
