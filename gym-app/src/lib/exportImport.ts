import { db } from '../db/db'
import type { Profile } from '../types'

interface BackupPayload {
  version: 1
  exportedAt: string
  profile: Profile
  bodyWeightLogs: unknown[]
  bodyMeasurements?: unknown[]
  workoutSessions: unknown[]
  sets: unknown[]
  cardioSessions?: unknown[]
  foodEntries?: unknown[]
  dailySteps?: unknown[]
  // Keyed by exerciseId, which only matches on a device with the same catalog.
  machineSettings?: unknown[]
  exerciseTargets?: unknown[]
  workoutReviews?: unknown[]
  periodLogs?: unknown[]
  cycleCheckIns?: unknown[]
}

export async function exportProfileData(profileId: number) {
  const [
    profile,
    bodyWeightLogs,
    bodyMeasurements,
    workoutSessions,
    sets,
    cardioSessions,
    foodEntries,
    dailySteps,
    machineSettings,
    exerciseTargets,
    workoutReviews,
    periodLogs,
    cycleCheckIns,
  ] =
    await Promise.all([
      db.profiles.get(profileId),
      db.bodyWeightLogs.where('profileId').equals(profileId).toArray(),
      db.bodyMeasurements.where('profileId').equals(profileId).toArray(),
      db.workoutSessions.where('profileId').equals(profileId).toArray(),
      db.sets.where('profileId').equals(profileId).toArray(),
      db.cardioSessions.where('profileId').equals(profileId).toArray(),
      db.foodEntries.where('profileId').equals(profileId).toArray(),
      db.dailySteps.where('profileId').equals(profileId).toArray(),
      db.machineSettings.where('profileId').equals(profileId).toArray(),
      db.exerciseTargets.where('profileId').equals(profileId).toArray(),
      db.workoutReviews.where('profileId').equals(profileId).toArray(),
      db.periodLogs.where('profileId').equals(profileId).toArray(),
      db.cycleCheckIns.where('profileId').equals(profileId).toArray(),
    ])
  if (!profile) throw new Error('Perfil no encontrado')

  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    bodyWeightLogs,
    bodyMeasurements,
    workoutSessions,
    sets,
    cardioSessions,
    // Photo thumbnails are Blobs and don't survive JSON — data only.
    foodEntries: foodEntries.map(({ photo: _photo, ...rest }) => rest),
    dailySteps,
    machineSettings,
    exerciseTargets,
    workoutReviews,
    periodLogs,
    cycleCheckIns,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const safeName = profile.name.trim().replace(/\s+/g, '-').toLowerCase()
  a.href = url
  a.download = `gym-backup-${safeName}-${payload.exportedAt.slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function importProfileData(file: File): Promise<number> {
  const text = await file.text()
  const payload = JSON.parse(text) as BackupPayload
  if (payload.version !== 1 || !payload.profile) {
    throw new Error('Archivo de backup inválido')
  }

  return db.transaction(
    'rw',
    [
      db.profiles,
      db.bodyWeightLogs,
      db.bodyMeasurements,
      db.workoutSessions,
      db.sets,
      db.cardioSessions,
      db.foodEntries,
      db.dailySteps,
      db.machineSettings,
      db.exerciseTargets,
      db.workoutReviews,
      db.periodLogs,
      db.cycleCheckIns,
    ],
    async () => {
      const { id: _oldId, ...profileData } = payload.profile
      const newProfileId = (await db.profiles.add({ ...profileData })) as number

      const sessionIdMap = new Map<number, number>()
      for (const session of payload.workoutSessions as Array<Record<string, unknown>>) {
        const { id: oldSessionId, ...rest } = session
        const newId = (await db.workoutSessions.add({ ...rest, profileId: newProfileId } as never)) as number
        sessionIdMap.set(oldSessionId as number, newId)
      }

      for (const log of payload.bodyWeightLogs as Array<Record<string, unknown>>) {
        const { id: _oldId, ...rest } = log
        await db.bodyWeightLogs.add({ ...rest, profileId: newProfileId } as never)
      }

      for (const measurement of (payload.bodyMeasurements ?? []) as Array<Record<string, unknown>>) {
        const { id: _oldId, ...rest } = measurement
        await db.bodyMeasurements.add({ ...rest, profileId: newProfileId } as never)
      }

      for (const set of payload.sets as Array<Record<string, unknown>>) {
        const { id: _oldId, sessionId, ...rest } = set
        const newSessionId = sessionIdMap.get(sessionId as number)
        if (newSessionId == null) continue
        await db.sets.add({ ...rest, sessionId: newSessionId, profileId: newProfileId } as never)
      }

      // Optional in older backups.
      const profileRows: Array<[{ add: (row: never) => unknown }, unknown[] | undefined]> = [
        [db.cardioSessions, payload.cardioSessions],
        [db.foodEntries, payload.foodEntries],
        [db.dailySteps, payload.dailySteps],
        [db.machineSettings, payload.machineSettings],
        [db.periodLogs, payload.periodLogs],
        [db.cycleCheckIns, payload.cycleCheckIns],
      ]
      for (const [table, rows] of profileRows) {
        for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
          const { id: _oldId, ...rest } = row
          await table.add({ ...rest, profileId: newProfileId } as never)
        }
      }

      // AI reviews and targets point at sessions, whose ids change on import.
      for (const review of (payload.workoutReviews ?? []) as Array<Record<string, unknown>>) {
        const newSessionId = sessionIdMap.get(review.sessionId as number)
        if (newSessionId == null) continue
        await db.workoutReviews.put({ ...review, sessionId: newSessionId, profileId: newProfileId } as never)
      }
      for (const target of (payload.exerciseTargets ?? []) as Array<Record<string, unknown>>) {
        const { id: _oldId, sessionId, ...rest } = target
        await db.exerciseTargets.add({
          ...rest,
          sessionId: sessionIdMap.get(sessionId as number) ?? 0,
          profileId: newProfileId,
        } as never)
      }

      return newProfileId
    },
  )
}
