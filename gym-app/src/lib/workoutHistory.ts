import type { SetLog } from '../types'
import type { ExerciseHistory, RecentContext } from '../db/workoutReviews'

// Epley estimate of the one-rep max, the usual way to compare sets with different reps.
export function estimateOneRepMax(weightKg: number, reps: number): number {
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30)
}

export function bestOneRepMax(sets: SetLog[]): number {
  return sets.reduce((best, s) => Math.max(best, estimateOneRepMax(s.weightKg, s.reps)), 0)
}

export function totalVolume(sets: SetLog[]): number {
  return sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0)
}

// How many of the latest sessions (today included) failed to beat every session before them.
export function sessionsWithoutImprovement(history: ExerciseHistory): number {
  const series = [history.today, ...history.previous.map((p) => p.sets)].map(bestOneRepMax)
  let streak = 0
  for (let i = 0; i < series.length - 1; i++) {
    const olderBest = Math.max(...series.slice(i + 1))
    if (series[i] > olderBest) break
    streak++
  }
  return streak
}

const kg = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })

function formatSets(sets: SetLog[]): string {
  return sets.map((s) => `${kg(s.weightKg)}×${s.reps}`).join(', ')
}

function shortDate(iso: string): string {
  // A bare yyyy-mm-dd would parse as UTC midnight; noon keeps it on the same local day.
  return new Date(iso.length === 10 ? `${iso}T12:00` : iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

// One compact, model-friendly block per exercise, with the numbers already worked out.
export function describeExerciseHistory(history: ExerciseHistory): string {
  const todayVolume = totalVolume(history.today)
  const pastVolumes = history.previous.map((p) => totalVolume(p.sets))
  const avgPastVolume = pastVolumes.length ? pastVolumes.reduce((a, b) => a + b, 0) / pastVolumes.length : 0
  const lines = [
    `[id ${history.exercise.id}] ${history.exercise.name} (${history.exercise.muscleGroup})`,
    `  Hoy: ${formatSets(history.today)}`,
    ...history.previous.map((p) => `  ${shortDate(p.date)}: ${formatSets(p.sets)}`),
  ]
  if (history.previous.length === 0) {
    lines.push('  Primera vez que registra este ejercicio.')
  } else {
    const volumeChange = avgPastVolume ? Math.round(((todayVolume - avgPastVolume) / avgPastVolume) * 100) : 0
    lines.push(
      `  Volumen hoy ${Math.round(todayVolume)} kg (${volumeChange >= 0 ? '+' : ''}${volumeChange} % frente a la media anterior)`,
      `  1RM estimado hoy ${kg(bestOneRepMax(history.today))} kg, mejor anterior ${kg(
        Math.max(...history.previous.map((p) => bestOneRepMax(p.sets))),
      )} kg`,
      `  Sesiones seguidas sin superar su mejor marca: ${sessionsWithoutImprovement(history)}`,
    )
  }
  return lines.join('\n')
}

// Last week's eating and body weight in plain numbers; says so explicitly when nothing was logged.
export function describeRecentContext({ balance, weights }: RecentContext): string {
  const lines: string[] = []
  if (balance.length === 0) {
    lines.push('Sin comidas registradas en los últimos 7 días.')
  } else {
    const avgIn = Math.round(balance.reduce((sum, d) => sum + d.consumed, 0) / balance.length)
    const avgOut = Math.round(balance.reduce((sum, d) => sum + d.spent, 0) / balance.length)
    const diff = avgIn - avgOut
    lines.push(
      `Comida registrada ${balance.length} de los últimos 7 días: media de ${avgIn} kcal ingeridas frente a ${avgOut} kcal gastadas ` +
        `(${diff >= 0 ? '+' : ''}${diff} kcal/día, ${diff < -100 ? 'en déficit' : diff > 100 ? 'en superávit' : 'en mantenimiento'}).`,
    )
  }
  if (weights.length < 2) {
    lines.push(weights.length === 1 ? `Peso registrado: ${kg(weights[0].value)} kg (un solo registro reciente).` : 'Sin registros de peso recientes.')
  } else {
    const first = weights[0]
    const last = weights[weights.length - 1]
    const change = last.value - first.value
    lines.push(
      `Peso: ${kg(first.value)} kg el ${shortDate(first.date)} y ${kg(last.value)} kg el ${shortDate(last.date)} ` +
        `(${change >= 0 ? '+' : ''}${kg(change)} kg).`,
    )
  }
  return lines.join('\n')
}
