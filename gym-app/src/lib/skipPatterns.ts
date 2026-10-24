import { SKIP_REASONS } from './sessionIncidents'
import type { RoutineDraft, SetLog, SkipReason, WorkoutSession } from '../types'

const MIN_SKIPS = 2
const MIN_RATE = 0.4

export interface SkipPattern {
  exerciseId: number
  skips: number // sessions where it was left undone or half done
  sessions: number // sessions where it was due
  reason: SkipReason // most frequent
  routineId: number // routine of the latest skip
}

// Exercises that keep being left out. Only sessions since skips started being recorded count,
// so older sessions (when nobody asked why) don't water the rate down.
export function skipPatterns(sessions: WorkoutSession[], sets: SetLog[], routines: RoutineDraft[]): SkipPattern[] {
  const ordered = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const first = ordered.findIndex((s) => s.skipped?.length)
  if (first === -1) return []
  const items = new Map(routines.map((r) => [r.id!, r.items.map((i) => i.exerciseId)]))
  const logged = new Map<number, Set<number>>()
  for (const set of sets) logged.set(set.sessionId, (logged.get(set.sessionId) ?? new Set()).add(set.exerciseId))

  const due = new Map<number, number>()
  const skipped = new Map<number, { count: number; reasons: SkipReason[]; routineId: number }>()
  for (const session of ordered.slice(first)) {
    const ids = new Set([
      ...(items.get(session.routineId) ?? []),
      ...(logged.get(session.id!) ?? []),
      ...(session.skipped ?? []).map((s) => s.exerciseId),
    ])
    for (const id of ids) due.set(id, (due.get(id) ?? 0) + 1)
    for (const skip of session.skipped ?? []) {
      const entry = skipped.get(skip.exerciseId) ?? { count: 0, reasons: [], routineId: session.routineId }
      skipped.set(skip.exerciseId, { count: entry.count + 1, reasons: [...entry.reasons, skip.reason], routineId: session.routineId })
    }
  }

  const patterns: SkipPattern[] = []
  for (const [exerciseId, { count, reasons, routineId }] of skipped) {
    const sessionsDue = due.get(exerciseId) ?? count
    if (count < MIN_SKIPS || count / sessionsDue < MIN_RATE) continue
    patterns.push({ exerciseId, skips: count, sessions: sessionsDue, reason: mostFrequent(reasons), routineId })
  }
  return patterns.sort((a, b) => b.skips / b.sessions - a.skips / a.sessions || b.skips - a.skips)
}

// Ties go to the latest reason.
function mostFrequent(reasons: SkipReason[]): SkipReason {
  const counts = new Map(SKIP_REASONS.map((r) => [r, 0]))
  for (const r of reasons) counts.set(r, counts.get(r)! + 1)
  return [...reasons].reverse().reduce((best, r) => (counts.get(r)! > counts.get(best)! ? r : best))
}
