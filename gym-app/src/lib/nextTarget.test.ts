import { describe, expect, it } from 'vitest'
import { suggestTarget } from './nextTarget'
import { openingHint } from './liveCoach'
import type { SetLog } from '../types'

const set = (weightKg: number, reps: number, bodyKg?: number): SetLog => ({
  sessionId: 7,
  profileId: 1,
  exerciseId: 1,
  setNumber: 1,
  weightKg,
  bodyKg,
  reps,
  restSeconds: 90,
  completedAt: '2026-10-22T10:00:00.000Z',
})

describe('offline target from the last session', () => {
  it('nothing to suggest without a last session', () => {
    expect(suggestTarget([], 8, 12)).toBeUndefined()
  })

  it('every working set at the top of the range: smallest step up, back to the bottom', () => {
    expect(suggestTarget([set(100, 12), set(100, 12), set(100, 13)], 8, 12)).toEqual({ weightKg: 102.5, reps: 8 })
    expect(suggestTarget([set(14, 12), set(14, 12)], 8, 12, { dumbbells: true })).toEqual({ weightKg: 15, reps: 8 })
  })

  it('otherwise same weight and one rep more than the best set, capped at the top', () => {
    expect(suggestTarget([set(100, 10), set(100, 9), set(100, 8)], 8, 12)).toEqual({ weightKg: 100, reps: 11 })
    expect(suggestTarget([set(100, 12), set(100, 11)], 8, 12)).toEqual({ weightKg: 100, reps: 12 })
    expect(suggestTarget([set(100, 5)], 8, 12)).toEqual({ weightKg: 100, reps: 8 })
  })

  it('lighter back-off sets do not count', () => {
    expect(suggestTarget([set(100, 12), set(100, 12), set(80, 9)], 8, 12)).toEqual({ weightKg: 102.5, reps: 8 })
  })

  it('bodyweight exercises add 2,5 kg of added weight', () => {
    expect(suggestTarget([set(0, 12, 70), set(0, 13, 70)], 8, 12)).toEqual({ weightKg: 2.5, reps: 8 })
    expect(suggestTarget([set(0, 9, 70)], 8, 12)).toEqual({ weightKg: 0, reps: 10 })
  })
})

describe('hint before the first set', () => {
  it('shows today\'s target with the planned sets', () => {
    expect(openingHint('100 kg', 10, 8, 12, 4).text).toBe('Hoy: 100 kg × 10 · 4 series.')
  })

  it('first time: how to pick a weight', () => {
    expect(openingHint(undefined, undefined, 8, 12).text).toBe('Primera vez: elige un peso con el que llegues a 8-12 repeticiones.')
  })
})
