import { normalize } from './exercises'
import type { Exercise, RoutineItem, SessionAdjustments, SessionNote, SkipReason, SkippedExercise } from '../types'

export const SKIP_REASONS: SkipReason[] = ['unexpected', 'time', 'tired', 'pain', 'unmotivated']

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  unexpected: 'Imprevisto',
  time: 'Sin tiempo',
  tired: 'Cansancio',
  pain: 'Molestia o dolor',
  unmotivated: 'Sin ganas',
}

export interface WorkoutEntry {
  exercise: Exercise
  plan: RoutineItem
}

// Today's list after the coach's accepted changes: priority exercises first, reduced
// sets in place of the routine's, and dropped ones set apart so they can be brought back.
export function applyAdjustments<T extends WorkoutEntry>(entries: T[], adjustments?: SessionAdjustments): { active: T[]; dropped: T[] } {
  const dropped = new Set(adjustments?.dropped ?? [])
  const priority = adjustments?.priority ?? []
  const rank = (e: T) => {
    const i = priority.indexOf(e.exercise.id!)
    return i === -1 ? priority.length : i
  }
  const active = entries
    .filter((e) => !dropped.has(e.exercise.id!))
    .map((e, order) => ({ e, order }))
    .sort((a, b) => rank(a.e) - rank(b.e) || a.order - b.order)
    .map(({ e }) => {
      const sets = adjustments?.sets?.[e.exercise.id!]
      return sets != null ? { ...e, plan: { ...e.plan, sets } } : e
    })
  return { active, dropped: entries.filter((e) => dropped.has(e.exercise.id!)) }
}

// Best guess from what was said to the coach, to preselect the reason on finishing.
export function guessSkipReason(notes: SessionNote[] | undefined): SkipReason | undefined {
  const said = normalize((notes ?? []).filter((n) => n.role === 'user').map((n) => n.text).join(' '))
  if (!said) return undefined
  if (/dolor|duele|molest|lesion|pinchazo/.test(said)) return 'pain'
  if (/irme|me voy|recoger|hijo|hija|urgencia|imprevisto|trabajo|llamada/.test(said)) return 'unexpected'
  if (/minutos|tiempo|prisa|cierra/.test(said)) return 'time'
  if (/cansad|energia|agotad|sueno|dormi/.test(said)) return 'tired'
  return undefined
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })

export interface SkippedDetail {
  exercise: Exercise
  reason: SkipReason
  partial: boolean // some sets were logged before leaving it
}

// Plain-text block for the post-workout review; empty when nothing happened.
export function describeIncidents(skipped: SkippedDetail[], notes: SessionNote[] | undefined): string[] {
  const lines: string[] = []
  for (const { exercise, reason, partial } of skipped) {
    lines.push(`- ${partial ? 'Dejó a medias' : 'No hizo'} ${exercise.name} (${exercise.muscleGroup}): ${SKIP_REASON_LABELS[reason].toLowerCase()}.`)
  }
  const said = (notes ?? []).filter((n) => n.role === 'user')
  if (said.length) {
    lines.push('Lo que contó al coach durante el entreno:', ...said.map((n) => `- ${time(n.at)}: "${n.text}"`))
  }
  return lines
}

// Merges new skips into the stored list (latest reason wins per exercise).
export function mergeSkipped(current: SkippedExercise[] | undefined, added: SkippedExercise[]): SkippedExercise[] {
  const ids = new Set(added.map((s) => s.exerciseId))
  return [...(current ?? []).filter((s) => !ids.has(s.exerciseId)), ...added]
}
