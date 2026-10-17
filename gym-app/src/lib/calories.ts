export const MET_STRENGTH_TRAINING = 5.0
// Vigorous circuit training with little rest (Compendium of Physical Activities).
export const MET_CIRCUIT_TRAINING = 8.0

// Compendium of Physical Activities formula
export function estimateCalories(met: number, weightKg: number, durationMinutes: number): number {
  const caloriesPerMinute = (met * 3.5 * weightKg) / 200
  return Math.round(caloriesPerMinute * durationMinutes)
}

// Gross MET calories include the resting energy you'd spend anyway (1 MET). The daily
// balance already counts the full BMR, so it only adds the part above rest.
export function netOfRest(grossKcal: number, met: number): number {
  return met > 1 ? (grossKcal * (met - 1)) / met : 0
}
