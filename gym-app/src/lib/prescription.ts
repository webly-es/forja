import type { RoutineItem } from '../types'

export const DEFAULT_PRESCRIPTION = { sets: 3, repMin: 8, repMax: 12, restSeconds: 90 } as const

export function hasPrescription(item: Pick<RoutineItem, 'sets' | 'repMin' | 'repMax' | 'restSeconds'>): boolean {
  return item.sets != null || item.repMin != null || item.restSeconds != null
}

export function formatRest(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')} min`
}

export function formatReps(repMin?: number, repMax?: number): string | null {
  if (repMin == null) return null
  return repMax != null && repMax !== repMin ? `${repMin}-${repMax}` : String(repMin)
}

// "4 × 8-10 · 90 s" ("4 series" without reps), or null when nothing is prescribed for this exercise.
export function formatPrescription(item: Pick<RoutineItem, 'sets' | 'repMin' | 'repMax' | 'restSeconds'>): string | null {
  const reps = formatReps(item.repMin, item.repMax)
  const work =
    item.sets != null
      ? reps
        ? `${item.sets} × ${reps}`
        : `${item.sets} ${item.sets === 1 ? 'serie' : 'series'}`
      : reps
        ? `${reps} reps`
        : null
  const parts = [work, item.restSeconds != null ? formatRest(item.restSeconds) : null].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}
