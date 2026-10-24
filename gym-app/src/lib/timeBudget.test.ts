import { describe, expect, it } from 'vitest'
import { estimateMinutes, fitToTime } from './timeBudget'
import type { WorkoutEntry } from './sessionIncidents'
import type { Exercise } from '../types'

// 4 sets × (40 + 80 s) + 60 s = 9 min per exercise.
const entry = (id: number, sets = 4): WorkoutEntry => ({
  exercise: { id, name: `E${id}`, muscleGroup: 'Pecho' } as Exercise,
  plan: { exerciseId: id, sets, restSeconds: 80 },
})
const entries = [entry(1), entry(2), entry(3), entry(4), entry(5), entry(6)]

describe('estimateMinutes', () => {
  it('counts sets, rest and the change between exercises', () => {
    expect(estimateMinutes(entries, new Map())).toBe(54)
  })

  it('only counts what is left', () => {
    expect(estimateMinutes(entries, new Map([[1, 4], [2, 2]]))).toBe(4 + 36)
  })
})

describe('fitToTime', () => {
  it('changes nothing when it already fits', () => {
    expect(fitToTime(entries, new Map(), 60)).toEqual([])
  })

  it('removes sets from the last exercises first', () => {
    // 54 min → 48: three sets of 2 min less, from the end.
    expect(fitToTime(entries, new Map(), 48)).toEqual([
      { type: 'sets', exerciseId: 4, sets: 3 },
      { type: 'sets', exerciseId: 5, sets: 3 },
      { type: 'sets', exerciseId: 6, sets: 3 },
    ])
  })

  it('drops the last exercises once every set count is at 2', () => {
    const actions = fitToTime(entries, new Map(), 20)
    expect(actions.filter((a) => a.type === 'drop').map((a) => a.exerciseId)).toEqual([4, 5, 6])
    expect(actions).toContainEqual({ type: 'sets', exerciseId: 2, sets: 2 })
    expect(actions.some((a) => a.exerciseId === 1)).toBe(false)
  })

  it('never touches the first exercise or one already started', () => {
    const actions = fitToTime(entries, new Map([[3, 1]]), 5)
    expect(actions.some((a) => a.exerciseId === 1 || a.exerciseId === 3)).toBe(false)
    expect(actions.filter((a) => a.type === 'drop').map((a) => a.exerciseId)).toEqual([2, 4, 5, 6])
  })
})
