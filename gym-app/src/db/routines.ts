import { db } from './db'
import { addSeedTombstone, tombstoneKeys } from './seedTombstones'
import type { Routine, RoutineDraft, RoutineExercise, RoutineItem } from '../types'

// Shared routines plus the ones this profile owns.
export async function getRoutinesForProfile(profileId: number): Promise<Routine[]> {
  const all = await db.routines.toArray()
  return all.filter((r) => r.profileId == null || r.profileId === profileId)
}

export function linkToItem({ exerciseId, sets, repMin, repMax, restSeconds }: RoutineExercise): RoutineItem {
  return { exerciseId, sets, repMin, repMax, restSeconds }
}

export async function getRoutineDraft(routineId: number): Promise<RoutineDraft | undefined> {
  const routine = await db.routines.get(routineId)
  if (!routine) return undefined
  const links = await db.routineExercises.where('routineId').equals(routineId).sortBy('order')
  return { id: routine.id, name: routine.name, profileId: routine.profileId, notes: routine.notes, aiReview: routine.aiReview, items: links.map(linkToItem) }
}

// Writes the routine and replaces its exercise links. Must run inside a transaction
// over routines, routineExercises, exercises and seedTombstones.
async function writeDraft(draft: RoutineDraft): Promise<number> {
  const fields = { name: draft.name.trim(), profileId: draft.profileId, notes: draft.notes, aiReview: draft.aiReview }
  let id = draft.id
  if (id) {
    const routine = await db.routines.get(id)
    await db.routines.update(id, fields)
    if (routine) {
      // Factory routines would bring removed exercises back on the next start without a tombstone.
      const keep = new Set(draft.items.map((i) => i.exerciseId))
      const links = await db.routineExercises.where('routineId').equals(id).toArray()
      for (const link of links) {
        if (keep.has(link.exerciseId)) continue
        const exercise = await db.exercises.get(link.exerciseId)
        if (exercise) await addSeedTombstone(tombstoneKeys.link(routine.key, exercise.name))
      }
    }
  } else {
    id = (await db.routines.add({ key: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...fields })) as number
  }
  await db.routineExercises.where('routineId').equals(id).delete()
  await db.routineExercises.bulkAdd(draft.items.map((item, order) => ({ ...item, routineId: id, order })))
  return id
}

const TABLES = [db.routines, db.routineExercises, db.exercises, db.seedTombstones]

export function saveRoutine(draft: RoutineDraft): Promise<number> {
  return db.transaction('rw', TABLES, () => writeDraft(draft))
}

// Several routines at once (an AI weekly program): all of them or none.
export function saveProgram(drafts: RoutineDraft[]): Promise<number[]> {
  return db.transaction('rw', TABLES, async () => {
    const ids: number[] = []
    for (const draft of drafts) ids.push(await writeDraft(draft))
    return ids
  })
}

// Every routine this profile sees, with its exercises, e.g. as context for the coach.
export async function getRoutineDraftsForProfile(profileId: number): Promise<RoutineDraft[]> {
  const routines = await getRoutinesForProfile(profileId)
  const drafts = await Promise.all(routines.map((r) => getRoutineDraft(r.id!)))
  return drafts.filter((d): d is RoutineDraft => d != null)
}
