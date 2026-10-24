import { describe, expect, it } from 'vitest'
import { findPending } from './pendingExercises'
import type { SkippedExercise, WorkoutSession } from '../types'

const session = (id: number, day: number, skipped: SkippedExercise[] = []): WorkoutSession => ({
  id,
  profileId: 1,
  routineId: id * 10,
  routineName: `R${id}`,
  startedAt: `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`,
  finishedAt: `2026-10-${String(day).padStart(2, '0')}T11:00:00.000Z`,
  skipped,
})
const done = (entries: [number, number[]][]) => new Map(entries.map(([s, ids]) => [s, new Set(ids)]))
const current = session(9, 24)

describe('findPending', () => {
  it('offers what was left undone, with its routine', () => {
    const recent = [session(1, 20, [{ exerciseId: 5, reason: 'time' }])]
    const { recover, painful } = findPending(recent, done([[1, [1, 2]]]), current, new Set([7]))
    expect(recover).toEqual([{ exerciseId: 5, routineId: 10, routineName: 'R1', reason: 'time' }])
    expect(painful).toEqual([])
  })

  it('skips half-done ones, ones in today\'s routine and ones done since', () => {
    const recent = [
      session(1, 18, [{ exerciseId: 5, reason: 'time' }, { exerciseId: 6, reason: 'tired' }]),
      session(2, 21),
    ]
    const result = findPending(recent, done([[1, [6]], [2, [5]]]), current, new Set([8]))
    expect(result.recover).toEqual([])
    const today = findPending([session(1, 18, [{ exerciseId: 8, reason: 'time' }])], done([]), current, new Set([8]))
    expect(today.recover).toEqual([])
    const doneToday = findPending([session(1, 18, [{ exerciseId: 4, reason: 'time' }])], done([[9, [4]]]), current, new Set())
    expect(doneToday.recover).toEqual([])
  })

  it('keeps pain apart and the newest reason per exercise', () => {
    const recent = [
      session(1, 18, [{ exerciseId: 5, reason: 'pain' }]),
      session(2, 21, [{ exerciseId: 5, reason: 'unexpected' }, { exerciseId: 3, reason: 'pain' }]),
    ]
    const { recover, painful } = findPending(recent, done([]), current, new Set())
    expect(recover.map((p) => [p.exerciseId, p.reason])).toEqual([[5, 'unexpected']])
    expect(painful.map((p) => p.exerciseId)).toEqual([3])
  })
})
