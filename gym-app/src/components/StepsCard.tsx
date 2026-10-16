import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { setDailySteps } from '../db/queries'
import { useAppStore } from '../store/useAppStore'
import { stepsToKcal, stepsToKm } from '../lib/dailyEnergy'
import { formatDateKey, shiftDateKey, todayKey } from '../lib/dates'
import type { Profile } from '../types'
import { Check, ClipboardPaste, Footprints, PenLine } from 'lucide-react'

interface StepsCardProps {
  profile: Profile
  dateKey: string
  steps: number
  // Kcal the steps add to the day (net of walking/running cardio already logged).
  stepsKcal: number
  onSelectDate: (dateKey: string) => void
}

const CHART_DAYS = 7

function titleFor(dateKey: string): string {
  const label = formatDateKey(dateKey)
  if (label === 'Hoy') return 'Pasos de hoy'
  if (label === 'Ayer') return 'Pasos de ayer'
  return `Pasos del ${label}`
}

export function StepsCard({ profile, dateKey, steps, stepsKcal, onSelectDate }: StepsCardProps) {
  const stepGoal = useAppStore((s) => s.stepGoal)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const statusTimer = useRef<number | undefined>(undefined)

  // The chart shows the last 7 days, or the 7 days ending on an older day being viewed.
  const today = todayKey()
  const chartEnd = dateKey > shiftDateKey(today, -CHART_DAYS) ? today : dateKey
  const chartDays = Array.from({ length: CHART_DAYS }, (_, i) => shiftDateKey(chartEnd, i - (CHART_DAYS - 1)))

  const history = useLiveQuery(
    async () => {
      const rows = await db.dailySteps
        .where('profileId')
        .equals(profile.id!)
        .and((d) => d.date >= chartDays[0] && d.date <= chartEnd)
        .toArray()
      return new Map(rows.map((r) => [r.date, r.steps]))
    },
    [profile.id, chartEnd],
  )

  useEffect(() => {
    setEditing(false)
  }, [dateKey])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  useEffect(() => () => window.clearTimeout(statusTimer.current), [])

  function flash(message: string) {
    setStatus(message)
    window.clearTimeout(statusTimer.current)
    statusTimer.current = window.setTimeout(() => setStatus(null), 4000)
  }

  async function save(next: number) {
    await setDailySteps(profile.id!, dateKey, next)
    setEditing(false)
    const delta = Math.round(
      stepsToKcal(next, profile.weightKg, profile.heightCm) - stepsToKcal(steps, profile.weightKg, profile.heightCm),
    )
    flash(
      delta === 0
        ? 'Pasos guardados'
        : `Guardado · ${delta > 0 ? '+' : '−'}${Math.abs(delta)} kcal en tu objetivo`,
    )
  }

  function startEditing() {
    setDraft(steps > 0 ? String(steps) : '')
    setEditing(true)
  }

  function submitDraft() {
    if (draft.trim() === '') return setEditing(false)
    const value = Math.round(Number(draft))
    if (Number.isFinite(value) && value >= 0) save(value)
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      const value = Number(text.replace(/[^\d]/g, ''))
      if (!value) {
        flash('No hay un número de pasos en el portapapeles')
        return
      }
      await save(value)
    } catch {
      flash('No se pudo leer el portapapeles. Escríbelos a mano.')
    }
  }

  const pct = Math.min(1, steps / stepGoal)
  const km = stepsToKm(steps, profile.heightCm)
  const chartMax = Math.max(stepGoal, ...chartDays.map((d) => history?.get(d) ?? 0))

  return (
    <section className="card-forged p-4">
      <div className="flex items-center gap-2">
        <Footprints size={15} className="text-accent" />
        <span className="flex-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">{titleFor(dateKey)}</span>
        <button
          onClick={handlePaste}
          className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:text-text"
        >
          <ClipboardPaste size={13} />
          Pegar de Salud
        </button>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitDraft()
            }}
            className="flex flex-1 gap-2"
          >
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Pasos"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
              className="input"
            />
            <button
              type="submit"
              aria-label="Guardar pasos"
              className="flex shrink-0 items-center justify-center rounded-lg bg-accent px-3 text-bg hover:bg-accent-hover"
            >
              <Check size={18} />
            </button>
          </form>
        ) : (
          <button onClick={startEditing} className="group flex items-baseline gap-2 text-left" aria-label="Editar pasos">
            <span className="font-display text-4xl font-medium tabular-nums text-text">
              {steps.toLocaleString('es')}
            </span>
            <span className="text-xs text-text-muted">/ {stepGoal.toLocaleString('es')}</span>
            <PenLine size={13} className="self-center text-text-muted transition-colors group-hover:text-accent" />
          </button>
        )}
        {!editing && steps >= stepGoal && <span className="text-xs font-medium text-accent">Meta cumplida</span>}
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
          style={{ width: `${pct * 100}%` }}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-surface py-2">
          <div className="text-sm font-semibold text-text">{km.toLocaleString('es', { maximumFractionDigits: 1 })} km</div>
          <div className="text-[11px] text-text-muted">distancia aprox.</div>
        </div>
        <div className="rounded-xl bg-surface py-2">
          <div className="text-sm font-semibold text-accent">+{stepsKcal.toLocaleString('es')} kcal</div>
          <div className="text-[11px] text-text-muted">suman a tu objetivo</div>
        </div>
      </div>

      <div className="relative mt-4 flex h-20 items-end gap-1.5">
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent/30"
          style={{ bottom: `calc(${(stepGoal / chartMax) * 100}% * 0.75 + 1.25rem)` }}
          aria-hidden="true"
        />
        {chartDays.map((d) => {
          const value = history?.get(d) ?? 0
          const selected = d === dateKey
          const [y, m, day] = d.split('-').map(Number)
          const weekday = new Date(y, m - 1, day).toLocaleDateString('es', { weekday: 'narrow' })
          return (
            <button
              key={d}
              onClick={() => onSelectDate(d)}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              aria-label={`${formatDateKey(d)}: ${value.toLocaleString('es')} pasos`}
            >
              <div className="flex h-[75%] w-full items-end">
                <div
                  className={`w-full rounded-t-md transition-[height] duration-500 ${
                    selected ? 'bg-accent' : value >= stepGoal ? 'bg-accent/60' : 'bg-surface-2'
                  }`}
                  style={{ height: `${Math.max(value > 0 ? 6 : 3, (value / chartMax) * 100)}%` }}
                />
              </div>
              <span className={`text-[10px] uppercase ${selected ? 'text-accent' : 'text-text-muted'}`}>{weekday}</span>
            </button>
          )
        })}
      </div>

      {status && <p className="mt-3 text-xs text-accent">{status}</p>}
    </section>
  )
}
