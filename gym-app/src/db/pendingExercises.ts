import { db } from './db'
import { findPending, PENDING_DAYS, type PendingExercise } from '../lib/pendingExercises'

// What earlier sessions left pending, to offer it at the start of this one.
export async function getPendingForSession(sessionId: number) {
  const session = await db.workoutSessions.get(sessionId)
  if (!session || session.pendingDismissed) return { recover: [], painful: [] }
  const since = new Date(new Date(session.startedAt).getTime() - PENDING_DAYS * 86_400_000).toISOString()
  const recent = await db.workoutSessions
    .where('profileId')
    .equals(session.profileId)
    .filter((s) => s.id !== sessionId && !!s.finishedAt && !s.ladder && s.startedAt >= since && s.startedAt < session.startedAt)
    .toArray()
  const ids = [sessionId, ...recent.map((s) => s.id!)]
  const sets = await db.sets.where('sessionId').anyOf(ids).toArray()
  const doneBySession = new Map<number, Set<number>>()
  for (const set of sets) {
    const done = doneBySession.get(set.sessionId) ?? new Set<number>()
    done.add(set.exerciseId)
    doneBySession.set(set.sessionId, done)
  }
  const links = await db.routineExercises.where('routineId').equals(session.routineId).toArray()
  const todayIds = new Set([
    ...links.map((l) => l.exerciseId),
    ...(session.swaps ?? []).map((s) => s.to),
    ...(session.extras ?? []).map((e) => e.exerciseId),
  ])
  return findPending(recent, doneBySession, session, todayIds)
}

export async function addExtras(sessionId: number, pending: PendingExercise[]) {
  await db.transaction('rw', db.workoutSessions, async () => {
    const session = await db.workoutSessions.get(sessionId)
    if (!session) return
    const extras = [...(session.extras ?? [])]
    for (const p of pending) {
      if (!extras.some((e) => e.exerciseId === p.exerciseId)) extras.push({ exerciseId: p.exerciseId, routineId: p.routineId })
    }
    // The card is answered: what's left (only painful ones) isn't asked again.
    await db.workoutSessions.update(sessionId, { extras, pendingDismissed: true })
  })
}

export async function dismissPending(sessionId: number) {
  await db.workoutSessions.update(sessionId, { pendingDismissed: true })
}
