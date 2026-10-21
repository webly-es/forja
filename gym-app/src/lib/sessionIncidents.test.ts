import { describe, expect, it } from 'vitest'
import { applyAdjustments, describeIncidents, guessSkipReason, mergeSkipped, type WorkoutEntry } from './sessionIncidents'
import { validateActions } from './ai/sessionCoach'
import type { Exercise, SessionNote, SetLog } from '../types'

const entry = (id: number, sets = 3): WorkoutEntry => ({
  exercise: { id, name: `E${id}`, muscleGroup: 'Pecho' } as Exercise,
  plan: { exerciseId: id, sets, repMin: 8, repMax: 12, restSeconds: 90 },
})
const logged = (exerciseId: number, n: number): SetLog[] =>
  Array.from({ length: n }, (_, i) => ({
    sessionId: 1,
    profileId: 1,
    exerciseId,
    setNumber: i + 1,
    weightKg: 50,
    reps: 10,
    restSeconds: 90,
    completedAt: '2026-10-21T10:00:00.000Z',
  }))
const note = (text: string, role: SessionNote['role'] = 'user'): SessionNote => ({ at: '2026-10-21T10:30:00.000Z', role, text })

describe('applyAdjustments', () => {
  const entries = [entry(1), entry(2), entry(3), entry(4)]

  it('without changes keeps the routine as is', () => {
    expect(applyAdjustments(entries).active.map((e) => e.exercise.id)).toEqual([1, 2, 3, 4])
  })

  it('priority goes first, dropped ones are set apart, reduced sets replace the plan', () => {
    const { active, dropped } = applyAdjustments(entries, { priority: [3], dropped: [4], sets: { 2: 1 } })
    expect(active.map((e) => e.exercise.id)).toEqual([3, 1, 2])
    expect(active.find((e) => e.exercise.id === 2)?.plan.sets).toBe(1)
    expect(dropped.map((e) => e.exercise.id)).toEqual([4])
  })
})

describe('validateActions', () => {
  const ctx = { entries: [entry(1), entry(2), entry(3, 4)], sets: [...logged(1, 3), ...logged(3, 2)] }

  it('ignores exercises already finished or unknown', () => {
    expect(validateActions([{ type: 'drop', exerciseId: 1 }, { type: 'drop', exerciseId: 99 }], ctx)).toEqual([])
  })

  it('reduced sets must stay between what is done and the current plan', () => {
    expect(validateActions([{ type: 'sets', exerciseId: 3, sets: 1 }], ctx)).toEqual([]) // already did 2
    expect(validateActions([{ type: 'sets', exerciseId: 3, sets: 4 }], ctx)).toEqual([]) // not a reduction
    expect(validateActions([{ type: 'sets', exerciseId: 3, sets: 3 }], ctx)).toEqual([{ type: 'sets', exerciseId: 3, sets: 3 }])
  })

  it('a dropped exercise is not also reduced or prioritised', () => {
    const actions = validateActions(
      [
        { type: 'drop', exerciseId: 2, reason: 'unexpected' },
        { type: 'priority', exerciseId: 2 },
      ],
      ctx,
    )
    expect(actions).toEqual([{ type: 'drop', exerciseId: 2, reason: 'unexpected' }])
  })

  it('an unknown reason falls back to lack of time', () => {
    expect(validateActions([{ type: 'drop', exerciseId: 2, reason: 'aliens' }], ctx)).toEqual([{ type: 'drop', exerciseId: 2, reason: 'time' }])
  })
})

describe('skip reasons', () => {
  it('guesses the reason from what was said to the coach', () => {
    expect(guessSkipReason([note('Tengo que ir a recoger a mi hijo')])).toBe('unexpected')
    expect(guessSkipReason([note('Me duele el hombro')])).toBe('pain')
    expect(guessSkipReason([note('Me quedan 15 minutos')])).toBe('time')
    expect(guessSkipReason([note('Estoy sin energía, dormí fatal')])).toBe('tired')
    expect(guessSkipReason([note('Recoge tus cosas', 'coach')])).toBeUndefined() // only the person's words count
  })

  it('the latest reason wins per exercise', () => {
    expect(mergeSkipped([{ exerciseId: 1, reason: 'time' }, { exerciseId: 2, reason: 'tired' }], [{ exerciseId: 1, reason: 'pain' }])).toEqual([
      { exerciseId: 2, reason: 'tired' },
      { exerciseId: 1, reason: 'pain' },
    ])
  })

  it('describes what was skipped for the review', () => {
    const lines = describeIncidents([{ exercise: entry(4).exercise, reason: 'unexpected', partial: false }], [note('Me tengo que ir')])
    expect(lines[0]).toBe('- No hizo E4 (Pecho): imprevisto.')
    expect(lines).toContain('Lo que contó al coach durante el entreno:')
  })
})
