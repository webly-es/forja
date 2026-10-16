import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { getHistoryItems, type HistoryItem } from '../db/history'
import { getRoutineSummaries, type RoutineSummary } from '../db/queries'
import { coverUrl } from '../lib/routineCovers'
import { ChevronRight, HeartPulse } from 'lucide-react'

function monthKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const label = new Date(`${key}-01T00:00:00`).toLocaleDateString('es', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h === 0 ? `${m} min` : `${h} h ${m.toString().padStart(2, '0')}`
}

function HistoryRow({ item, summaries }: { item: HistoryItem; summaries: Record<number, RoutineSummary> }) {
  const navigate = useNavigate()
  const cover = item.routineId != null ? (summaries[item.routineId]?.cover ?? 'general') : null
  return (
    <button
      onClick={() => navigate(item.type === 'strength' ? `/history/${item.id}` : `/history/cardio/${item.id}`)}
      className="card-forged flex w-full items-center gap-3 overflow-hidden p-2.5 pr-3 text-left transition-colors hover:border-accent-muted"
    >
      {cover ? (
        <img src={coverUrl(cover)} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accent">
          <HeartPulse size={20} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-base uppercase tracking-wide text-text">{item.title}</div>
        <div className="mt-0.5 text-xs capitalize text-text-muted">{dayLabel(item.date)}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm text-text">{item.minutes} min</div>
        {item.kcal > 0 && <div className="text-xs text-accent">~{Math.round(item.kcal)} kcal</div>}
      </div>
      <ChevronRight size={16} className="shrink-0 text-text-muted" />
    </button>
  )
}

export function History() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const items = useLiveQuery(() => getHistoryItems(activeProfileId), [activeProfileId])
  const summaries = useLiveQuery(getRoutineSummaries, [], {} as Record<number, RoutineSummary>)
  const [selectedMonthOverride, setSelectedMonthOverride] = useState<string | null>(null)

  if (!items) return null

  const months = [...new Set(items.map((item) => monthKey(item.date)))].sort((a, b) => b.localeCompare(a))
  const selectedMonth = selectedMonthOverride ?? months[0] ?? null
  const visible = items.filter((item) => monthKey(item.date) === selectedMonth)
  const totalMinutes = visible.reduce((sum, i) => sum + i.minutes, 0)
  const totalKcal = visible.reduce((sum, i) => sum + i.kcal, 0)

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight text-text">Historial</h1>

      {items.length === 0 ? (
        <p className="text-sm text-text-muted">Aún no tienes entrenamientos registrados.</p>
      ) : (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {months.map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMonthOverride(m)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  selectedMonth === m
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-white/10 text-text-muted hover:text-text'
                }`}
              >
                {monthLabel(m)}
              </button>
            ))}
          </div>

          <div className="card-forged grid grid-cols-3 py-4 text-center">
            <div>
              <div className="font-display text-3xl text-text">{visible.length}</div>
              <div className="text-[11px] text-text-muted">{visible.length === 1 ? 'entreno' : 'entrenos'}</div>
            </div>
            <div className="border-x border-white/10">
              <div className="font-display text-3xl text-text">{formatHours(totalMinutes)}</div>
              <div className="text-[11px] text-text-muted">en total</div>
            </div>
            <div>
              <div className="font-display text-3xl text-accent">{Math.round(totalKcal).toLocaleString('es')}</div>
              <div className="text-[11px] text-text-muted">kcal</div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {visible.map((item) => (
              <HistoryRow key={`${item.type}-${item.id}`} item={item} summaries={summaries} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
