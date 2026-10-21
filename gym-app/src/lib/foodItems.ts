import type { FoodItem } from '../types'

export function sumItems(items: FoodItem[]) {
  return items.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      proteinG: acc.proteinG + i.proteinG,
      carbsG: acc.carbsG + i.carbsG,
      fatG: acc.fatG + i.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  )
}

// Changing an item's grams scales its kcal/macros proportionally, since the
// AI's per-gram estimate is usually better than its portion estimate.
export function scaleItem(item: FoodItem, grams: number): FoodItem {
  if (item.grams <= 0) return { ...item, grams }
  const f = grams / item.grams
  return {
    ...item,
    grams,
    kcal: Math.round(item.kcal * f),
    proteinG: Math.round(item.proteinG * f),
    carbsG: Math.round(item.carbsG * f),
    fatG: Math.round(item.fatG * f),
  }
}

export function numberOrZero(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}
