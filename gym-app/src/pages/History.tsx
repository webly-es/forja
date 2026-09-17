import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { deleteCardioSession, deleteWorkoutSession } from '../db/queries'
import { ConfirmDeleteRow } from '../components/ConfirmDeleteRow'
import { ChevronRight, Dumbbell, HeartPulse, Trash2 } from 'lucide-react'

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

  const [selectedMonthOverride, setSelectedMonthOverride] = useState<string | null>(null)
  const selectedMonth = selectedMonthOverride ?? months[0] ?? null

  const visibleItems = (items ?? []).filter((item) => monthKey(item.date) === selectedMonth)

  const [confirmingDeleteKey, setConfirmingDeleteKey] = useState<string | null>(null)

  async function handleDelete(item: HistoryItem) {
    if (item.type === 'strength') {
      await deleteWorkoutSession(item.id)
    } else {
      await deleteCardioSession(item.id)
    }
    setConfirmingDeleteKey(null)
  }

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
              onClick={() => setSelectedMonthOverride(m)}
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
        {visibleItems.map((item) => {
          const key = `${item.type}-${item.id}`
          return (
            <div key={key} className="rounded-xl border border-border bg-surface transition-colors hover:border-accent">
              {confirmingDeleteKey === key ? (
                <div className="p-4">
                  <ConfirmDeleteRow
                    message={`¿Eliminar "${item.title}" del ${item.subtitle.split(' · ')[0]}?`}
                    onCancel={() => setConfirmingDeleteKey(null)}
                    onConfirm={() => handleDelete(item)}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 p-4">
                  <button
                    onClick={() =>
                      navigate(item.type === 'strength' ? `/history/${item.id}` : `/history/cardio/${item.id}`)
                    }
                    className="flex flex-1 items-center justify-between gap-3 text-left"
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
                  <button
                    onClick={() => setConfirmingDeleteKey(key)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-danger"
                    aria-label="Eliminar entrenamiento"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
