import { getBMR } from './metrics'
import { estimateStepsPerMinute } from './met'
import { toDateKey } from './dates'
import type { CardioSession, Profile, WorkoutSession } from '../types'

export interface DailyEnergy {
  bmr: number
  tefKcal: number
  strengthKcal: number
  cardioKcal: number
  stepsKcal: number
  total: number
}

// Stride length ≈ 0.415 × height.
export function stepsToKm(steps: number, heightCm: number): number {
  return (steps * heightCm * 0.415) / 100 / 1000
}

// Net cost of walking (BMR is counted separately): ~0.5 kcal per kg per km.
export function stepsToKcal(steps: number, weightKg: number, heightCm: number): number {
  return stepsToKm(steps, heightCm) * weightKg * 0.5
}

// Thermic effect of food: digesting a normal diet costs ~10 % of BMR.
const TEF_FACTOR = 0.1

export function computeDailyEnergy(
  profile: Profile,
  dateKey: string,
  data: { sessions: WorkoutSession[]; cardio: CardioSession[]; steps: number },
): DailyEnergy {
  const bmr = getBMR(profile)
  const tefKcal = bmr * TEF_FACTOR

  const strengthKcal = data.sessions
    .filter((s) => s.finishedAt && toDateKey(new Date(s.startedAt)) === dateKey)
    .reduce((sum, s) => sum + (s.caloriesBurned ?? 0), 0)

  const dayCardio = data.cardio.filter((c) => toDateKey(new Date(c.date)) === dateKey)
  const cardioKcal = dayCardio.reduce((sum, c) => sum + c.caloriesBurned, 0)

  // Walking/running cardio already counts by MET — drop its steps from the
  // phone's daily total so those minutes aren't counted twice.
  const cardioSteps = dayCardio.reduce(
    (sum, c) => sum + estimateStepsPerMinute(c.activity) * c.durationMinutes,
    0,
  )
  const netSteps = Math.max(0, data.steps - cardioSteps)
  const stepsKcal = stepsToKcal(netSteps, profile.weightKg, profile.heightCm)

  return {
    bmr: Math.round(bmr),
    tefKcal: Math.round(tefKcal),
    strengthKcal: Math.round(strengthKcal),
    cardioKcal: Math.round(cardioKcal),
    stepsKcal: Math.round(stepsKcal),
    total: Math.round(bmr + tefKcal + strengthKcal + cardioKcal + stepsKcal),
  }
}
