import { normalize } from './exercises'
import type { FoodItem, FoodMemory, FoodQuestion } from '../types'

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

// Same food however it was typed: "Arroz blanco", "arroz  blanco." → "arroz blanco".
export function foodKey(name: string): string {
  return normalize(name)
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()
}

// Items after the chosen answers: scaling first (on the AI's original items), then added foods.
// answers maps question index → option index; unanswered questions change nothing.
export function applyAnswers(base: FoodItem[], questions: FoodQuestion[], answers: Record<number, number>): FoodItem[] {
  const factors = base.map(() => 1)
  const added: FoodItem[] = []
  questions.forEach((q, qi) => {
    const option = answers[qi] != null ? q.options[answers[qi]] : undefined
    if (!option) return
    for (const { item, factor } of option.scale ?? []) {
      if (item >= 0 && item < base.length) factors[item] *= factor
    }
    added.push(...(option.add ?? []))
  })
  return [...base.map((item, i) => (factors[i] === 1 ? item : scaleItem(item, Math.round(item.grams * factors[i])))), ...added]
}

const per100 = (value: number, grams: number) => Math.round((value / grams) * 1000) / 10

// What the person settled on for this food, per 100 g, to reuse next time.
export function memoryValues(item: FoodItem): Pick<FoodMemory, 'grams' | 'per100'> | null {
  if (item.grams <= 0) return null
  return {
    grams: item.grams,
    per100: {
      kcal: per100(item.kcal, item.grams),
      proteinG: per100(item.proteinG, item.grams),
      carbsG: per100(item.carbsG, item.grams),
      fatG: per100(item.fatG, item.grams),
    },
  }
}

// Did the person change this item from what the AI proposed?
export function wasCorrected(final: FoodItem, ai: FoodItem | undefined): boolean {
  if (!ai) return true // added by hand
  return final.grams !== ai.grams || final.kcal !== ai.kcal || final.proteinG !== ai.proteinG
}

// Foods the person already corrected keep their own values per gram; the AI's portion stays.
export function applyMemory(items: FoodItem[], memory: FoodMemory[]): FoodItem[] {
  const known = new Map(memory.filter((m) => m.corrected).map((m) => [m.key, m]))
  return items.map((item) => {
    const m = known.get(foodKey(item.name))
    if (!m || item.grams <= 0) return item
    const at = (v: number) => Math.round((v * item.grams) / 100)
    return {
      ...item,
      kcal: at(m.per100.kcal),
      proteinG: at(m.per100.proteinG),
      carbsG: at(m.per100.carbsG),
      fatG: at(m.per100.fatG),
      confidence: 'high',
      note: 'Según tus correcciones',
    }
  })
}

