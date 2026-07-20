import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { ChevronRight } from 'lucide-react'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDuration(start: string, end?: string) {
  if (!end) return 'En curso'
  const minutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  return `${minutes} min`
}

export function History() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const navigate = useNavigate()

  const sessions = useLiveQuery(
    () =>
      db.workoutSessions
        .where('profileId')
        .equals(activeProfileId)
        .toArray()
        .then((s) => s.filter((x) => x.finishedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt))),
    [activeProfileId],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-text">Historial</h1>

      {sessions && sessions.length === 0 && (
        <p className="text-sm text-text-muted">Aún no tienes entrenamientos registrados.</p>
      )}

      <div className="flex flex-col gap-3">
        {sessions?.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(`/history/${s.id}`)}
            className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent"
          >
            <div>
              <div className="font-medium text-text">{s.routineName}</div>
              <div className="mt-0.5 text-xs text-text-muted">
                {formatDate(s.startedAt)} · {formatDuration(s.startedAt, s.finishedAt)}
              </div>
            </div>
            <ChevronRight size={20} className="text-text-muted" />
          </button>
        ))}
      </div>
    </div>
  )
}
