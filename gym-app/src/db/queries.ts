import { db } from './db'
import type { SetLog } from '../types'

export async function getLastSetForExercise(
  profileId: number,
  exerciseId: number,
  excludeSessionId?: number,
): Promise<SetLog | undefined> {
  const sets = await db.sets
    .where('exerciseId')
    .equals(exerciseId)
    .and((s) => s.profileId === profileId && s.sessionId !== excludeSessionId)
    .toArray()
  sets.sort((a, b) => b.completedAt.localeCompare(a.completedAt))
  return sets[0]
}
