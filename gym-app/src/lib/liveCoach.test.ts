import { describe, expect, it } from 'vitest'
import { liveHint } from './liveCoach'
import { describeExerciseHistory } from './workoutHistory'
import { formatPrescription } from './prescription'
import type { Exercise, SetLog } from '../types'

const exercise = (id: number, name: string, bodyweightFactor?: number) =>
  ({ id, name, muscleGroup: 'Piernas', order: id, bodyweightFactor }) as unknown as Exercise
const legPress = exercise(1, 'Prensa de piernas')
const curl = exercise(2, 'Curl con mancuernas')
const pullUp = exercise(3, 'Dominadas', 0.95)

const set = (weightKg: number, reps: number, bodyKg?: number): SetLog => ({
  sessionId: 1,
  profileId: 1,
  exerciseId: 1,
  setNumber: 1,
  weightKg,
  bodyKg,
  reps,
  restSeconds: 90,
  completedAt: '2026-10-22T10:00:00.000Z',
})

describe('live hint without routine prescription or saved target', () => {
  it('stays silent only when the goal is unknown too', () => {
    expect(liveHint(legPress, [set(100, 14)])).toBeNull()
  })

  it('uses the goal range to raise, lower or keep the weight', () => {
    expect(liveHint(legPress, [set(100, 14)], undefined, undefined, 'recomp')?.tone).toBe('up')
    expect(liveHint(legPress, [set(100, 5)], undefined, undefined, 'recomp')?.text).toContain('baja a unos 92,5 kg')
    expect(liveHint(legPress, [set(100, 10)], undefined, undefined, 'recomp')?.text).toBe(
      'En rango (8-12). Mantén 100 kg y busca 11 repeticiones.',
    )
  })

  it('does not call a set below the range "in range"', () => {
    expect(liveHint(legPress, [set(100, 7)], undefined, undefined, 'recomp')?.text).toBe(
      'Cerca del rango: mantén 100 kg y busca 8 repeticiones.',
    )
  })

  it('dumbbells step by 1-2 kg per dumbbell', () => {
    expect(liveHint(curl, [set(12, 13)], undefined, undefined, 'lose')?.text).toContain('1-2 kg por mancuerna')
  })

  it('bodyweight exercises suggest added weight', () => {
    expect(liveHint(pullUp, [set(0, 13, 70)], undefined, undefined, 'recomp')?.text).toContain('añade 2,5 kg de lastre')
  })

  it('the routine prescription still wins over the goal', () => {
    const plan = { exerciseId: 1, repMin: 4, repMax: 6 }
    expect(liveHint(legPress, [set(100, 7)], plan, undefined, 'recomp')?.tone).toBe('up')
  })
})

describe('planned sets', () => {
  const plan = { exerciseId: 1, sets: 4 }

  it('tells how many sets are left', () => {
    expect(liveHint(legPress, [set(100, 10)], plan, undefined, 'recomp')?.text).toBe(
      'En rango (8-12). Mantén 100 kg y busca 11 repeticiones. Te quedan 3 series.',
    )
    expect(liveHint(legPress, [set(100, 10), set(100, 10), set(100, 9)], plan, undefined, 'recomp')?.text).toMatch(/Te queda 1 serie\.$/)
  })

  it('keeps the weight on the top of the range, raises it only past it', () => {
    expect(liveHint(legPress, [set(100, 12)], plan, undefined, 'recomp')?.tone).toBe('ok')
    expect(liveHint(legPress, [set(100, 13)], plan, undefined, 'recomp')?.tone).toBe('up')
  })

  it('stops once the planned sets are done', () => {
    const four = [set(100, 10), set(100, 10), set(100, 9), set(100, 8)]
    expect(liveHint(legPress, four, plan, undefined, 'recomp')).toEqual({
      tone: 'done',
      text: '4 series hechas. Pasa al siguiente ejercicio.',
    })
  })

  it('shows sets without a rep range as "4 series"', () => {
    expect(formatPrescription(plan)).toBe('4 series')
    expect(formatPrescription({ sets: 3, repMin: 8, repMax: 12 })).toBe('3 × 8-12')
  })

  it('goes into the post-workout prompt', () => {
    const text = describeExerciseHistory({ exercise: legPress, today: [set(100, 10)], previous: [], plannedSets: 4 })
    expect(text).toContain('Series previstas: 4')
    expect(describeExerciseHistory({ exercise: legPress, today: [set(100, 10)], previous: [] })).not.toContain('Series previstas')
  })
})
