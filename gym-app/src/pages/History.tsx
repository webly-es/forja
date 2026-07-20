import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { ChevronRight, Dumbbell, HeartPulse } from 'lucide-react'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDuration(start: string, end?: string) {
  if (!end) return 'En curso'
  const minutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  return `${minutes} min`
}

interface HistoryItem {
  id: number
  type: 'strength' | 'cardio'
  title: string
  date: string
  subtitle: string
}

export function History() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const navigate = useNavigate()

  const items = useLiveQuery(async () => {
    const [strength, cardio] = await Promise.all([
      db.workoutSessions.where('profileId').equals(activeProfileId).toArray(),
      db.cardioSessions.where('profileId').equals(activeProfileId).toArray(),
    ])

    const strengthItems: HistoryItem[] = strength
      .filter((s) => s.finishedAt)
      .map((s) => ({
        id: s.id!,
        type: 'strength',
        title: s.routineName,
        date: s.startedAt,
        subtitle: `${formatDate(s.startedAt)} · ${formatDuration(s.startedAt, s.finishedAt)}`,
      }))

    const cardioItems: HistoryItem[] = cardio.map((c) => ({
      id: c.id!,
      type: 'cardio',
      title: c.activity,
      date: c.date,
      subtitle: `${formatDate(c.date)} · ${c.durationMinutes} min`,
    }))

    return [...strengthItems, ...cardioItems].sort((a, b) => b.date.localeCompare(a.date))
  }, [activeProfileId], [] as HistoryItem[])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-text">Historial</h1>

      {items && items.length === 0 && (
        <p className="text-sm text-text-muted">Aún no tienes entrenamientos registrados.</p>
      )}

      <div className="flex flex-col gap-3">
        {items?.map((item) => (
          <button
            key={`${item.type}-${item.id}`}
            onClick={() =>
              navigate(item.type === 'strength' ? `/history/${item.id}` : `/history/cardio/${item.id}`)
            }
            className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-accent">
                {item.type === 'strength' ? <Dumbbell size={15} /> : <HeartPulse size={15} />}
              </span>
              <div>
                <div className="font-medium text-text">{item.title}</div>
                <div className="mt-0.5 text-xs text-text-muted">{item.subtitle}</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-text-muted" />
          </button>
        ))}
      </div>
    </div>
  )
}
