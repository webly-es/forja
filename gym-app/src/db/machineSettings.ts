import { db } from './db'
import type { MachineSetting } from '../types'

export type MachineSettingFields = Pick<MachineSetting, 'seat' | 'lever' | 'note'>

export function getMachineSetting(profileId: number, exerciseId: number) {
  return db.machineSettings.where('[profileId+exerciseId]').equals([profileId, exerciseId]).first()
}

// Upsert; clearing every field removes the row so the card goes back to its empty state.
export async function saveMachineSetting(profileId: number, exerciseId: number, fields: MachineSettingFields) {
  const clean = { seat: fields.seat.trim(), lever: fields.lever.trim(), note: fields.note.trim() }
  const existing = await getMachineSetting(profileId, exerciseId)
  if (!clean.seat && !clean.lever && !clean.note) {
    if (existing) await db.machineSettings.delete(existing.id!)
    return
  }
  const updatedAt = new Date().toISOString()
  if (existing) await db.machineSettings.update(existing.id!, { ...clean, updatedAt })
  else await db.machineSettings.add({ profileId, exerciseId, ...clean, updatedAt })
}

// Used when two duplicate exercises are merged: keeps the target's own settings if it has any.
export async function moveMachineSettings(fromExerciseId: number, toExerciseId: number) {
  for (const row of await db.machineSettings.where('exerciseId').equals(fromExerciseId).toArray()) {
    if (await getMachineSetting(row.profileId, toExerciseId)) await db.machineSettings.delete(row.id!)
    else await db.machineSettings.update(row.id!, { exerciseId: toExerciseId })
  }
}

export function deleteMachineSettingsForExercise(exerciseId: number) {
  return db.machineSettings.where('exerciseId').equals(exerciseId).delete()
}
