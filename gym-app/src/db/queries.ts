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

export async function deleteSetAndRenumber(sessionId: number, exerciseId: number, setId: number) {
  await db.transaction('rw', db.sets, async () => {
    await db.sets.delete(setId)
    const remaining = await db.sets
      .where({ sessionId, exerciseId })
      .toArray()
      .then((sets) => sets.sort((a, b) => a.setNumber - b.setNumber))
    for (let i = 0; i < remaining.length; i++) {
      const newSetNumber = i + 1
      if (remaining[i].setNumber !== newSetNumber) {
        await db.sets.update(remaining[i].id!, { setNumber: newSetNumber })
      }
    }
  })
}
