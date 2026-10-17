import { db } from './db'
import { getCycleStatus } from '../lib/cycle'
import { shiftDateKey } from '../lib/dates'
import type { CycleCheckIn, CycleSettings, PeriodLog } from '../types'

export function getPeriodLogs(profileId: number) {
  return db.periodLogs.where('profileId').equals(profileId).sortBy('startDate')
}

export async function getProfileCycleStatus(profileId: number, date: string) {
  const [profile, logs] = await Promise.all([db.profiles.get(profileId), getPeriodLogs(profileId)])
  if (!profile || profile.sex !== 'F') return null
  return getCycleStatus(profile.cycle, logs, date)
}

export function saveCycleSettings(profileId: number, cycle: CycleSettings) {
  return db.profiles.update(profileId, { cycle })
}

// Starting a pack only moves the date; the method and pattern stay as configured.
export async function setPackStart(profileId: number, date: string) {
  const profile = await db.profiles.get(profileId)
  if (!profile?.cycle) return
  await saveCycleSettings(profileId, { ...profile.cycle, packStartDate: date })
}

// A forgotten open period gets a typical length rather than running into the new one.
const FORGOTTEN_PERIOD_DAYS = 5

// One tap on Home: closes any period still open before the new one so two never overlap.
export async function logPeriodStart(profileId: number, date: string) {
  await db.transaction('rw', db.periodLogs, async () => {
    const logs = await getPeriodLogs(profileId)
    if (logs.some((l) => l.startDate === date)) return
    for (const open of logs.filter((l) => !l.endDate && l.startDate < date)) {
      const typicalEnd = shiftDateKey(open.startDate, FORGOTTEN_PERIOD_DAYS - 1)
      const dayBefore = shiftDateKey(date, -1)
      await db.periodLogs.update(open.id!, { endDate: typicalEnd < dayBefore ? typicalEnd : dayBefore })
    }
    await db.periodLogs.add({ profileId, startDate: date })
  })
}

export function logPeriodEnd(logId: number, date: string) {
  return db.periodLogs.update(logId, { endDate: date })
}

export function addPeriodLog(log: Omit<PeriodLog, 'id'>) {
  return db.periodLogs.add(log)
}

export function updatePeriodLog(logId: number, fields: Pick<PeriodLog, 'startDate' | 'endDate'>) {
  return db.periodLogs.update(logId, fields)
}

export function deletePeriodLog(logId: number) {
  return db.periodLogs.delete(logId)
}

export function getCheckIn(profileId: number, date: string) {
  return db.cycleCheckIns.where('[profileId+date]').equals([profileId, date]).first()
}

export async function saveCheckIn(checkIn: Omit<CycleCheckIn, 'id'>) {
  const existing = await getCheckIn(checkIn.profileId, checkIn.date)
  if (existing) await db.cycleCheckIns.update(existing.id!, checkIn)
  else await db.cycleCheckIns.add(checkIn)
}
