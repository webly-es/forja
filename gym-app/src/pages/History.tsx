import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { ChevronRight, Dumbbell, HeartPulse } from 'lucide-react'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

function monthKey(iso: string) {
  return iso.slice(0, 7) // YYYY-MM
}

function monthLabel(key: string) {
  const label = new Date(`${key}-01T00:00:00`).toLocaleDateString('es', { month: 'short', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
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

  const months = [...new Set((items ?? []).map((item) => monthKey(item.date)))].sort((a, b) =>
    b.localeCompare(a),
  )

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  useEffect(() => {
    if (selectedMonth == null && months.length > 0) {
      setSelectedMonth(months[0])
    }
  }, [months, selectedMonth])

  const visibleItems = (items ?? []).filter((item) => monthKey(item.date) === selectedMonth)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-text">Historial</h1>

      {items && items.length === 0 && (
        <p className="text-sm text-text-muted">Aún no tienes entrenamientos registrados.</p>
      )}

      {months.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {months.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMonth(m)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                selectedMonth === m
                  ? 'border-accent bg-accent-muted text-accent'
                  : 'border-border bg-surface-2 text-text-muted hover:text-text'
              }`}
            >
              {monthLabel(m)}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {visibleItems.map((item) => (
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
