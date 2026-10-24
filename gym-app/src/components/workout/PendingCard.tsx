import { useLiveQuery } from 'dexie-react-hooks'
import { History } from 'lucide-react'
import { db } from '../../db/db'
import { addExtras, dismissPending, getPendingForSession } from '../../db/pendingExercises'
import { SKIP_REASON_LABELS } from '../../lib/sessionIncidents'

// Offers what earlier sessions left undone; adding it puts it at the end of today's workout.
export function PendingCard({ sessionId }: { sessionId: number }) {
  const data = useLiveQuery(async () => {
    const pending = await getPendingForSession(sessionId)
    const ids = [...pending.recover, ...pending.painful].map((p) => p.exerciseId)
    const exercises = await db.exercises.bulkGet(ids)
    const names = new Map(exercises.flatMap((e) => (e ? [[e.id!, e.name] as const] : [])))
    return { ...pending, names }
  }, [sessionId])

  if (!data || (data.recover.length === 0 && data.painful.length === 0)) return null
  const { recover, painful, names } = data
  const routines = [...new Set(recover.map((p) => p.routineName))]

  return (
    <div className="card-forged mt-3 flex flex-col gap-2.5 p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <History size={17} />
        </span>
        <span className="min-w-0 flex-1">
          {recover.length > 0 ? (
            <>
              <span className="block text-sm font-medium text-text">Te quedó pendiente de {routines.join(' y ')}</span>
              {recover.map((p) => (
                <span key={p.exerciseId} className="block text-xs text-text-muted">
                  {names.get(p.exerciseId)} · {SKIP_REASON_LABELS[p.reason].toLowerCase()}
                </span>
              ))}
            </>
          ) : (
            <span className="block text-sm font-medium text-text">La última vez paraste por molestias</span>
          )}
          {painful.length > 0 && (
            <span className="mt-1 block text-xs leading-relaxed text-text-muted">
              {painful.map((p) => names.get(p.exerciseId)).join(', ')}: lo dejaste por molestias, así que no lo añadimos. Si sigue, coméntalo con el coach.
            </span>
          )}
        </span>
      </div>
      <div className={`grid gap-2 ${recover.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {recover.length > 0 && (
          <button
            onClick={() => void addExtras(sessionId, recover)}
            className="rounded-lg bg-accent py-2 text-xs font-medium text-bg active:scale-[0.97]"
          >
            Añadir hoy
          </button>
        )}
        <button
          onClick={() => void dismissPending(sessionId)}
          className="rounded-lg border border-border py-2 text-xs text-text-muted active:scale-[0.97]"
        >
          {recover.length > 0 ? 'No, gracias' : 'Entendido'}
        </button>
      </div>
    </div>
  )
}
