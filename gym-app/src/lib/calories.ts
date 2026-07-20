export const MET_STRENGTH_TRAINING = 5.0

// Compendium of Physical Activities formula
export function estimateCalories(met: number, weightKg: number, durationMinutes: number): number {
  const caloriesPerMinute = (met * 3.5 * weightKg) / 200
  return Math.round(caloriesPerMinute * durationMinutes)
}
