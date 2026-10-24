import { describe, expect, it } from 'vitest'
import { skipPatterns } from './skipPatterns'
import type { RoutineDraft, SetLog, SkippedExercise, WorkoutSession } from '../types'

const session = (id: number, day: number, skipped?: SkippedExercise[], routineId = 1): WorkoutSession => ({
  id,
  profileId: 1,
  routineId,
  routineName: 'Pierna',
  startedAt: `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`,
  finishedAt: `2026-10-${String(day).padStart(2, '0')}T11:00:00.000Z`,
  skipped,
})
const set = (sessionId: number, exerciseId: number) => ({ sessionId, exerciseId }) as SetLog
const routines: RoutineDraft[] = [{ id: 1, name: 'Pierna', items: [{ exerciseId: 1 }, { exerciseId: 2 }, { exerciseId: 3 }] }]

describe('skipPatterns', () => {
  it('flags an exercise left out in most sessions, with its most frequent reason', () => {
    const sessions = [
      session(1, 10, [{ exerciseId: 3, reason: 'time' }]),
      session(2, 14, [{ exerciseId: 3, reason: 'tired' }]),
      session(3, 17, [{ exerciseId: 3, reason: 'time' }]),
      session(4, 21, []),
    ]
    const sets = [1, 2, 3, 4].flatMap((s) => [set(s, 1), set(s, 2)])
    expect(skipPatterns(sessions, sets, routines)).toEqual([{ exerciseId: 3, skips: 3, sessions: 4, reason: 'time', routineId: 1 }])
  })

  it('ignores a single skip and low rates', () => {
    const once = [session(1, 10, [{ exerciseId: 3, reason: 'time' }]), session(2, 14, [])]
    expect(skipPatterns(once, [], routines)).toEqual([])
    const rare = [1, 2, 3, 4, 5, 6].map((i) => session(i, 10 + i, i <= 2 ? [{ exerciseId: 3, reason: 'time' }] : []))
    expect(skipPatterns(rare, [], routines)).toEqual([])
  })

  it('does not count sessions from before skips were recorded', () => {
    const sessions = [
      ...[1, 2, 3, 4].map((i) => session(i, i)),
      session(5, 20, [{ exerciseId: 2, reason: 'pain' }]),
      session(6, 22, [{ exerciseId: 2, reason: 'pain' }]),
    ]
    expect(skipPatterns(sessions, [], routines).map((p) => [p.exerciseId, p.sessions])).toEqual([[2, 2]])
  })
})
