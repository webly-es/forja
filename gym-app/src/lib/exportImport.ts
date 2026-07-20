import { db } from '../db/db'
import type { Profile } from '../types'

interface BackupPayload {
  version: 1
  exportedAt: string
  profile: Profile
  bodyWeightLogs: unknown[]
  workoutSessions: unknown[]
  sets: unknown[]
}

export async function exportProfileData(profileId: number) {
  const [profile, bodyWeightLogs, workoutSessions, sets] = await Promise.all([
    db.profiles.get(profileId),
    db.bodyWeightLogs.where('profileId').equals(profileId).toArray(),
    db.workoutSessions.where('profileId').equals(profileId).toArray(),
    db.sets.where('profileId').equals(profileId).toArray(),
  ])
  if (!profile) throw new Error('Perfil no encontrado')

  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    bodyWeightLogs,
    workoutSessions,
    sets,
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

  return db.transaction('rw', db.profiles, db.bodyWeightLogs, db.workoutSessions, db.sets, async () => {
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

    for (const set of payload.sets as Array<Record<string, unknown>>) {
      const { id: _oldId, sessionId, ...rest } = set
      const newSessionId = sessionIdMap.get(sessionId as number)
      if (newSessionId == null) continue
      await db.sets.add({ ...rest, sessionId: newSessionId, profileId: newProfileId } as never)
    }

    return newProfileId
  })
}
