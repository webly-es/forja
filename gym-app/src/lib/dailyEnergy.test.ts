import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { estimateCalories, netOfRest } from './calories'
import { computeDailyEnergy, stepsToKcal, stepsToKm } from './dailyEnergy'
import { getBMR, getGoalOffset } from './metrics'
import { numberOrZero, scaleItem, sumItems } from './foodItems'
import type { CardioSession, FoodItem, Profile, WorkoutSession } from '../types'

const profile = {
  id: 1,
  name: 'Test',
  sex: 'M',
  birthDate: '1996-10-21',
  heightCm: 180,
  weightKg: 80,
} as Profile

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-21T12:00:00'))
})
afterEach(() => vi.useRealTimers())

describe('calories', () => {
  it('uses the Compendium formula', () => {
    // 5 MET × 3.5 × 80 kg / 200 = 7 kcal/min
    expect(estimateCalories(5, 80, 60)).toBe(420)
  })

  it('net of rest removes the 1 MET already counted in BMR', () => {
    expect(netOfRest(500, 5)).toBe(400)
    expect(netOfRest(100, 1)).toBe(0)
  })

  it('Mifflin-St Jeor BMR (30 years old today)', () => {
    expect(getBMR(profile)).toBe(10 * 80 + 6.25 * 180 - 5 * 30 + 5)
    expect(getBMR({ ...profile, sex: 'F' })).toBe(10 * 80 + 6.25 * 180 - 5 * 30 - 161)
  })

  it('steps: stride ≈ 0.415 × height, ~0.5 kcal per kg per km', () => {
    expect(stepsToKm(10000, 180)).toBeCloseTo(7.47, 2)
    expect(stepsToKcal(10000, 80, 180)).toBeCloseTo(298.8, 1)
  })

  it('a deficit goal lowers the target', () => {
    expect(getGoalOffset('lose')).toBeLessThan(0)
  })
})

describe('computeDailyEnergy', () => {
  const session = (startedAt: string, finished = true): WorkoutSession =>
    ({ id: 1, profileId: 1, routineName: 'X', startedAt, finishedAt: finished ? startedAt : undefined, caloriesBurned: 500, met: 5 }) as WorkoutSession

  it('adds BMR, digestion, finished workouts of that day and steps', () => {
    const e = computeDailyEnergy(profile, '2026-10-21', {
      sessions: [session('2026-10-21T18:00:00'), session('2026-10-20T18:00:00'), session('2026-10-21T19:00:00', false)],
      cardio: [],
      steps: 10000,
    })
    expect(e.bmr).toBe(1780)
    expect(e.tefKcal).toBe(178)
    expect(e.strengthKcal).toBe(400) // only today's finished session, net of rest
    expect(e.stepsKcal).toBe(299)
    expect(e.total).toBe(Math.round(1780 + 178 + 400 + 298.8))
  })

  it("walking cardio doesn't count its steps twice", () => {
    const walk = { date: '2026-10-21T08:00:00', activity: 'Caminar', durationMinutes: 30, caloriesBurned: 150, met: 3.5 } as CardioSession
    const withWalk = computeDailyEnergy(profile, '2026-10-21', { sessions: [], cardio: [walk], steps: 10000 })
    const without = computeDailyEnergy(profile, '2026-10-21', { sessions: [], cardio: [], steps: 10000 })
    expect(withWalk.stepsKcal).toBeLessThan(without.stepsKcal)
    expect(withWalk.cardioKcal).toBeGreaterThan(0)
  })
})

describe('food items', () => {
  const rice: FoodItem = { name: 'Arroz', grams: 200, kcal: 260, proteinG: 5, carbsG: 56, fatG: 1 }

  it('changing grams scales kcal and macros', () => {
    expect(scaleItem(rice, 100)).toEqual({ ...rice, grams: 100, kcal: 130, proteinG: 3, carbsG: 28, fatG: 1 })
  })

  it('an item without grams just takes the new amount', () => {
    expect(scaleItem({ ...rice, grams: 0 }, 150).kcal).toBe(260)
  })

  it('sums a dish', () => {
    expect(sumItems([rice, rice])).toEqual({ kcal: 520, proteinG: 10, carbsG: 112, fatG: 2 })
  })

  it('invalid or negative input counts as zero', () => {
    expect(numberOrZero('abc')).toBe(0)
    expect(numberOrZero('-5')).toBe(0)
    expect(numberOrZero('12.5')).toBe(12.5)
  })
})
