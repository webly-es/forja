import type { ActivityLevel, Goal, Profile } from '../types'

export function getAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

export function getBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100
  return weightKg / (heightM * heightM)
}

export function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return 'Bajo peso'
  if (bmi < 25) return 'Peso normal'
  if (bmi < 30) return 'Sobrepeso'
  return 'Obesidad'
}

// Mifflin-St Jeor
export function getBMR(profile: Pick<Profile, 'sex' | 'weightKg' | 'heightCm' | 'birthDate'>): number {
  const age = getAge(profile.birthDate)
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * age
  return profile.sex === 'M' ? base + 5 : base - 161
}

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentario (poco o nada de ejercicio)',
  light: 'Ligero (1-3 días/semana)',
  moderate: 'Moderado (3-5 días/semana)',
  active: 'Activo (6-7 días/semana)',
  very_active: 'Muy activo (entreno intenso diario)',
}

export const GOAL_LABELS: Record<Goal, string> = {
  lose: 'Perder grasa',
  maintain: 'Mantener',
  gain: 'Ganar músculo',
  recomp: 'Ganar músculo y perder grasa (recomposición)',
}

export function getMaintenanceCalories(profile: Profile): number {
  return getBMR(profile) * ACTIVITY_FACTORS[profile.activityLevel]
}

const GOAL_OFFSETS: Record<Goal, number> = {
  lose: -450,
  maintain: 0,
  gain: 300,
  recomp: -150,
}

// Kcal to add to (or subtract from) a day's spend to hit the profile's goal.
export function getGoalOffset(goal: Goal): number {
  return GOAL_OFFSETS[goal]
}

export function getTargetCalories(profile: Profile): number {
  return getMaintenanceCalories(profile) + getGoalOffset(profile.goal)
}

export interface Macros {
  proteinG: number
  fatG: number
  carbsG: number
}

// Protein scales with body weight and fat with the calorie target; carbs absorb the rest,
// so on a dynamic (activity-based) target it's mostly carbs that move.
export function getMacros(profile: Profile, calories = getTargetCalories(profile)): Macros {
  const proteinPerKg = profile.goal === 'lose' || profile.goal === 'recomp' ? 2.2 : 1.9
  const proteinG = Math.round(profile.weightKg * proteinPerKg)
  const fatCalories = calories * 0.25
  const fatG = Math.round(fatCalories / 9)
  const remainingCalories = calories - proteinG * 4 - fatG * 9
  const carbsG = Math.max(0, Math.round(remainingCalories / 4))
  return { proteinG, fatG, carbsG }
}
