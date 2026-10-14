export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Comida',
  dinner: 'Cena',
  snack: 'Snack',
}

export function mealForHour(hour: number): MealType {
  if (hour >= 5 && hour < 11) return 'breakfast'
  if (hour >= 13 && hour < 17) return 'lunch'
  if (hour >= 20 || hour < 2) return 'dinner'
  return 'snack'
}
