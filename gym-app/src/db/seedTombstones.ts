import { db } from './db'

// Marks a piece of the hardcoded seed data (db/seed.ts) as deleted by the
// user, so ensureExercisesSeeded/ensureFemaleRoutinesSeeded skip recreating
// it on the next app start instead of blindly upserting by name/key.
export const tombstoneKeys = {
  routine: (routineKey: string) => `routine:${routineKey}`,
  exercise: (exerciseName: string) => `exercise:${exerciseName}`,
  link: (routineKey: string, exerciseName: string) => `link:${routineKey}:${exerciseName}`,
}

export async function addSeedTombstone(key: string) {
  await db.seedTombstones.put({ key })
}

export async function isSeedTombstoned(key: string): Promise<boolean> {
  return (await db.seedTombstones.get(key)) !== undefined
}
