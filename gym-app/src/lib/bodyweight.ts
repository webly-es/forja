import type { Exercise, SetLog } from '../types'

// On bodyweight exercises a set stores the added weight in weightKg and a snapshot of the
// body weight moved in bodyKg, so later weigh-ins don't rewrite past sets.

export const isBodyweight = (exercise: Pick<Exercise, 'bodyweightFactor'>) => (exercise.bodyweightFactor ?? 0) > 0

// Body weight moved by one rep, rounded to 0.1 kg.
export function bodyKgFor(exercise: Pick<Exercise, 'bodyweightFactor'>, profileWeightKg: number): number | undefined {
  if (!isBodyweight(exercise)) return undefined
  return Math.round(profileWeightKg * exercise.bodyweightFactor! * 10) / 10
}

// What the muscles actually move: body share plus added weight.
export function loadOf(set: Pick<SetLog, 'weightKg' | 'bodyKg'>): number {
  return (set.bodyKg ?? 0) + set.weightKg
}

const kg = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })

// "PC + 10 kg", "PC" (bodyweight only) or "60 kg".
export function formatLoad(set: Pick<SetLog, 'weightKg' | 'bodyKg'>): string {
  if (set.bodyKg == null) return `${kg(set.weightKg)} kg`
  return set.weightKg > 0 ? `PC + ${kg(set.weightKg)} kg` : 'PC'
}

// Compact form for AI prompts: "PC(51)+10×8" or "60×8".
export function formatSetForAi(set: Pick<SetLog, 'weightKg' | 'bodyKg' | 'reps'>): string {
  if (set.bodyKg == null) return `${kg(set.weightKg)}×${set.reps}`
  return `PC(${kg(set.bodyKg)})${set.weightKg > 0 ? `+${kg(set.weightKg)}` : ''}×${set.reps}`
}

export const BODYWEIGHT_PRESETS: { factor: number; label: string }[] = [
  { factor: 1, label: 'Casi todo el peso (dominadas, fondos)' },
  { factor: 0.65, label: 'Unos dos tercios (flexiones)' },
  { factor: 0.5, label: 'La mitad' },
  { factor: 0.3, label: 'Un tercio (abdominales)' },
]
