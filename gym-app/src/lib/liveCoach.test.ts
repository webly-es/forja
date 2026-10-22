import { describe, expect, it } from 'vitest'
import { liveHint } from './liveCoach'
import type { Exercise, SetLog } from '../types'

const legPress: Exercise = { id: 1, name: 'Prensa de piernas', muscleGroup: 'Piernas' } as Exercise
const curl: Exercise = { id: 2, name: 'Curl con mancuernas', muscleGroup: 'Bíceps' } as Exercise
const pullUp: Exercise = { id: 3, name: 'Dominadas', muscleGroup: 'Espalda', bodyweightFactor: 0.95 } as Exercise

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
