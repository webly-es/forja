import { db } from './db'
import { foodKey, memoryValues, wasCorrected } from '../lib/foodItems'
import type { FoodItem, FoodMemory } from '../types'

const MEMORY_IN_PROMPT = 30

// The foods this person logs most, corrected ones first: what the AI should know about them.
export async function getFoodMemory(profileId: number): Promise<FoodMemory[]> {
  const rows = await db.foodMemory.where('profileId').equals(profileId).toArray()
  return rows
    .sort((a, b) => Number(b.corrected) - Number(a.corrected) || b.uses - a.uses)
    .slice(0, MEMORY_IN_PROMPT)
}

// After saving an AI-analysed meal: remember each food as the person left it.
// aiItems are what the AI proposed (answers applied), to tell whether they corrected it.
export async function learnFromEntry(profileId: number, finalItems: FoodItem[], aiItems: FoodItem[]) {
  const aiByKey = new Map(aiItems.map((i) => [foodKey(i.name), i]))
  const now = new Date().toISOString()
  await db.transaction('rw', db.foodMemory, async () => {
    for (const item of finalItems) {
      const key = foodKey(item.name)
      const values = memoryValues(item)
      if (!key || !values) continue
      const corrected = wasCorrected(item, aiByKey.get(key))
      const existing = await db.foodMemory.where('[profileId+key]').equals([profileId, key]).first()
      if (existing) {
        // An unchanged item doesn't overwrite values the person corrected before.
        const keepOld = existing.corrected && !corrected
        await db.foodMemory.update(existing.id!, {
          name: item.name,
          ...(keepOld ? {} : values),
          uses: existing.uses + 1,
          corrected: existing.corrected || corrected,
          updatedAt: now,
        })
      } else {
        await db.foodMemory.add({ profileId, key, name: item.name, ...values, uses: 1, corrected, updatedAt: now })
      }
    }
  })
}
