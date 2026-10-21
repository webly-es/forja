import { describe, expect, it } from 'vitest'
import { detectRecord } from './records'
import { bodyKgFor, formatLoad, formatSetForAi, loadOf } from './bodyweight'
import type { SetLog } from '../types'

const set = (weightKg: number, reps: number, bodyKg?: number): SetLog => ({
  sessionId: 1,
  profileId: 1,
  exerciseId: 1,
  setNumber: 1,
  weightKg,
  bodyKg,
  reps,
  restSeconds: 90,
  completedAt: '2026-10-01T10:00:00.000Z',
})

describe('bodyweight load', () => {
  it('only bodyweight exercises get a body share, rounded to 0.1 kg', () => {
    expect(bodyKgFor({ bodyweightFactor: 0.65 }, 78)).toBe(50.7)
    expect(bodyKgFor({ bodyweightFactor: undefined }, 78)).toBeUndefined()
    expect(bodyKgFor({ bodyweightFactor: 0 }, 78)).toBeUndefined() // turned off by the user
  })

  it('load is body share plus added weight', () => {
    expect(loadOf(set(10, 8, 51))).toBe(61)
    expect(loadOf(set(60, 8))).toBe(60)
  })

  it('formats sets for the screen and for the AI', () => {
    expect(formatLoad(set(10, 8, 51))).toBe('PC + 10 kg')
    expect(formatLoad(set(0, 8, 51))).toBe('PC')
    expect(formatLoad(set(62.5, 8))).toBe('62,5 kg')
    expect(formatSetForAi(set(10, 8, 51))).toBe('PC(51)+10×8')
    expect(formatSetForAi(set(0, 12, 51))).toBe('PC(51)×12')
    expect(formatSetForAi(set(60, 8))).toBe('60×8')
  })
})

describe('detectRecord', () => {
  it('never celebrates the very first set', () => {
    expect(detectRecord(set(60, 8), [])).toBeNull()
  })

  it('heavier load is a weight record', () => {
    expect(detectRecord(set(62.5, 6), [set(60, 8)])?.kind).toBe('weight')
  })

  it('same load with more reps is not a weight record but can be a strength one', () => {
    expect(detectRecord(set(60, 10), [set(60, 6)])?.kind).toBe('strength')
  })

  it('a clearly higher estimated 1RM at lower weight is a strength record', () => {
    // 50×12 → 70 kg estimated vs 52,5×6 → 63 kg
    expect(detectRecord(set(50, 12), [set(52.5, 6)])?.kind).toBe('strength')
  })

  it('high-rep sets only count as weight records', () => {
    expect(detectRecord(set(40, 20), [set(50, 8)])).toBeNull()
  })

  it('rounding noise is not a record', () => {
    expect(detectRecord(set(60, 8), [set(60, 8)])).toBeNull()
  })

  it('on bodyweight exercises a heavier weigh-in alone never makes a record', () => {
    // Same 8 reps with no extra weight; body share went from 50 to 52 kg.
    expect(detectRecord(set(0, 8, 52), [set(0, 8, 50)])).toBeNull()
  })

  it('on bodyweight exercises more added weight is a record', () => {
    const record = detectRecord(set(5, 8, 52), [set(0, 8, 50)])
    expect(record?.kind).toBe('weight')
    expect(record?.previous).toEqual({ weightKg: 0, bodyKg: 50, reps: 8 })
  })
})
