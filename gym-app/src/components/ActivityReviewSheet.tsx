import { useState } from 'react'
import { X } from 'lucide-react'
import type { ActivityItem } from '../lib/ai/activity'
import { estimateCalories } from '../lib/calories'
import { shiftDateKey, todayKey } from '../lib/dates'
import { addCardioSessions } from '../db/queries'

interface ActivityReviewSheetProps {
  profileId: number
  weightKg: number
  items: ActivityItem[]
  onClose: () => void
  onSaved: (result: { sessionIds: number[]; minutes: number; calories: number }) => void
}

interface Row {
  name: string
  minutes: string
  met: string
}

function rowCalories(row: Row, weightKg: number): number {
  const minutes = Number(row.minutes)
  const met = Number(row.met)
  return minutes > 0 && met > 0 ? estimateCalories(met, weightKg, minutes) : 0
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

// Shows what the AI understood so every activity can be corrected before it's logged.
export function ActivityReviewSheet({ profileId, weightKg, items, onClose, onSaved }: ActivityReviewSheetProps) {
  const [rows, setRows] = useState<Row[]>(() =>
    items.map((i) => ({ name: i.name, minutes: String(i.minutes), met: String(i.met) })),
  )
  const [dateKey, setDateKey] = useState(todayKey)
  const [saving, setSaving] = useState(false)

  const validRows = rows.filter((r) => r.name.trim() !== '' && rowCalories(r, weightKg) > 0)
  const totalMinutes = validRows.reduce((sum, r) => sum + Math.round(Number(r.minutes)), 0)
  const totalKcal = validRows.reduce((sum, r) => sum + rowCalories(r, weightKg), 0)

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  async function handleSave() {
    if (validRows.length === 0 || saving) return
    setSaving(true)
    const sessionIds = await addCardioSessions(
      profileId,
      dateKey,
      validRows.map((r) => ({
        activity: r.name,
        durationMinutes: Math.round(Number(r.minutes)),
        met: Number(r.met),
        caloriesBurned: rowCalories(r, weightKg),
      })),
    )
    onSaved({ sessionIds, minutes: totalMinutes, calories: totalKcal })
  }

  const today = todayKey()
  const dayOptions = [
    { key: today, label: 'Hoy' },
    { key: shiftDateKey(today, -1), label: 'Ayer' },
  ]
  const smallInput =
    'w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-right text-sm text-text outline-none focus:border-accent'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-6">
      <div className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Revisar actividad</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 flex gap-2 rounded-xl border border-border bg-surface-2 p-1">
          {dayOptions.map((d) => (
            <button
              key={d.key}
              onClick={() => setDateKey(d.key)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
                dateKey === d.key ? 'bg-accent text-bg' : 'text-text-muted'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {rows.map((row, i) => (
            <div key={i} className="rounded-xl border border-border bg-bg/40 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-text outline-none"
                  aria-label="Actividad"
                />
                <button
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  className="text-text-muted hover:text-text"
                  aria-label={`Quitar ${row.name}`}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 items-end gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-text-muted">Minutos</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={row.minutes}
                    onChange={(e) => updateRow(i, { minutes: e.target.value })}
                    className={smallInput}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-text-muted">Intensidad (MET)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    step={0.5}
                    value={row.met}
                    onChange={(e) => updateRow(i, { met: e.target.value })}
                    className={smallInput}
                  />
                </label>
                <div className="pb-1.5 text-right">
                  <div className="text-sm font-semibold text-accent">{rowCalories(row, weightKg)} kcal</div>
                  <div className="text-[11px] text-text-muted">{formatDuration(Number(row.minutes) || 0)}</div>
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-text-muted">No queda ninguna actividad.</p>}
        </div>

        <div className="mt-4 flex items-baseline justify-between rounded-xl bg-surface-2 px-4 py-3">
          <span className="text-xs uppercase tracking-wide text-text-muted">Total · {formatDuration(totalMinutes)}</span>
          <span className="font-display text-2xl text-accent">~{totalKcal.toLocaleString('es')} kcal</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
          Estimación con tu peso ({weightKg} kg). En tu balance diario solo cuenta lo que supera el gasto en reposo, que
          ya está incluido.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm text-text-muted hover:text-text"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={validRows.length === 0 || saving}
            className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-medium text-bg transition-opacity disabled:opacity-30 hover:bg-accent-hover"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
