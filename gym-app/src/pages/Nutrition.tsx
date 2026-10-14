import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { setDailySteps } from '../db/queries'
import { useAppStore } from '../store/useAppStore'
import { useDayBalance } from '../hooks/useDayBalance'
import { getMacros, getTargetCalories } from '../lib/metrics'
import { formatDateKey, shiftDateKey, todayKey } from '../lib/dates'
import { MEAL_LABELS, MEAL_TYPES, mealForHour } from '../lib/meals'
import { FoodEntrySheet } from '../components/FoodEntrySheet'
import type { FoodEntry } from '../types'
import { Camera, ChevronLeft, ChevronRight, ClipboardPaste, Footprints, PenLine, RotateCcw, Utensils } from 'lucide-react'

type SheetState = { mode: 'photo' | 'manual'; entry?: FoodEntry } | null

function FoodThumb({ photo }: { photo?: Blob }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!photo) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(photo)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo])

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2 text-text-muted">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Utensils size={16} />}
    </div>
  )
}

function ProgressBar({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="uppercase tracking-wide text-text-muted">{label}</span>
        <span className="text-text">
          {Math.round(value)} <span className="text-text-muted">/ {Math.round(target)} {unit}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function Nutrition() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const [dateKey, setDateKey] = useState(todayKey)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [showRecent, setShowRecent] = useState(false)
  const [stepsDraft, setStepsDraft] = useState('')
  const [stepsStatus, setStepsStatus] = useState<string | null>(null)

  const profile = useLiveQuery(() => db.profiles.get(activeProfileId), [activeProfileId])
  const day = useDayBalance(activeProfileId, dateKey)

  const recent = useLiveQuery(async () => {
    const since = shiftDateKey(todayKey(), -14)
    const rows = await db.foodEntries
      .where('profileId')
      .equals(activeProfileId)
      .and((e) => e.date >= since)
      .toArray()
    rows.sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
    const seen = new Set<string>()
    return rows
      .filter((e) => {
        const key = e.name.trim().toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 10)
  }, [activeProfileId])

  if (!profile || !day) return null

  const isToday = dateKey === todayKey()
  const targetKcal = getTargetCalories(profile)
  const macros = getMacros(profile)
  const balance = Math.round(day.consumed.kcal - day.energy.total)

  async function saveSteps(steps: number) {
    await setDailySteps(activeProfileId, dateKey, steps)
    setStepsDraft('')
    setStepsStatus('Pasos guardados')
    setTimeout(() => setStepsStatus(null), 2000)
  }

  async function handlePasteSteps() {
    try {
      const text = await navigator.clipboard.readText()
      const steps = Number(text.replace(/[^\d]/g, ''))
      if (!steps) {
        setStepsStatus('No hay un número de pasos en el portapapeles')
        setTimeout(() => setStepsStatus(null), 3000)
        return
      }
      await saveSteps(steps)
    } catch {
      setStepsStatus('No se pudo leer el portapapeles. Escríbelos a mano.')
      setTimeout(() => setStepsStatus(null), 3000)
    }
  }

  async function repeatEntry(source: FoodEntry) {
    const { id: _id, ...rest } = source
    await db.foodEntries.add({
      ...rest,
      date: dateKey,
      loggedAt: new Date().toISOString(),
      meal: isToday ? mealForHour(new Date().getHours()) : source.meal,
    })
    setShowRecent(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Comida</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDateKey((d) => shiftDateKey(d, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text"
            aria-label="Día anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-20 text-center text-sm capitalize text-text">{formatDateKey(dateKey)}</span>
          <button
            onClick={() => setDateKey((d) => shiftDateKey(d, 1))}
            disabled={isToday}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text disabled:opacity-30"
            aria-label="Día siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-accent-muted/60 bg-gradient-to-b from-surface to-surface-2 p-4">
        <div className="grid grid-cols-3 text-center">
          <div>
            <div className="text-xs uppercase tracking-wide text-text-muted">Consumido</div>
            <div className="mt-1 text-xl font-semibold text-text">{Math.round(day.consumed.kcal)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-text-muted">Gastado</div>
            <div className="mt-1 text-xl font-semibold text-text">{day.energy.total}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-text-muted">{balance <= 0 ? 'Déficit' : 'Superávit'}</div>
            <div className="mt-1 text-xl font-semibold text-accent">{Math.abs(balance)}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-1 border-t border-border pt-3 text-center text-[11px] text-text-muted">
          <div>
            <div className="text-sm text-text">{day.energy.bmr}</div>
            En reposo
          </div>
          <div>
            <div className="text-sm text-text">{day.energy.strengthKcal}</div>
            Gym
          </div>
          <div>
            <div className="text-sm text-text">{day.energy.cardioKcal}</div>
            Cardio
          </div>
          <div>
            <div className="text-sm text-text">{day.energy.stepsKcal}</div>
            Pasos
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <ProgressBar label="Calorías" value={day.consumed.kcal} target={targetKcal} unit="kcal" />
        <ProgressBar label="Proteína" value={day.consumed.proteinG} target={macros.proteinG} unit="g" />
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-text">
            <Footprints size={16} className="text-text-muted" />
            {day.steps > 0 ? `${day.steps.toLocaleString('es')} pasos` : 'Sin pasos registrados'}
          </div>
          <button
            onClick={handlePasteSteps}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-text"
          >
            <ClipboardPaste size={14} />
            Pegar pasos
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder="Escribir pasos"
            value={stepsDraft}
            onChange={(e) => setStepsDraft(e.target.value)}
            className="input"
          />
          <button
            onClick={() => Number(stepsDraft) >= 0 && stepsDraft !== '' && saveSteps(Math.round(Number(stepsDraft)))}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-hover"
          >
            Guardar
          </button>
        </div>
        {stepsStatus && <p className="mt-2 text-xs text-accent">{stepsStatus}</p>}
      </section>

      <section className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setSheet({ mode: 'photo' })}
          className="flex flex-col items-center gap-1.5 rounded-xl bg-gradient-to-b from-accent-hover to-accent py-3 text-xs font-semibold text-bg transition-transform active:scale-[0.97]"
        >
          <Camera size={18} />
          Foto del plato
        </button>
        <button
          onClick={() => setSheet({ mode: 'manual' })}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-surface py-3 text-xs text-text transition-colors hover:border-accent"
        >
          <PenLine size={18} className="text-text-muted" />
          Añadir a mano
        </button>
        <button
          onClick={() => setShowRecent((v) => !v)}
          className={`flex flex-col items-center gap-1.5 rounded-xl border bg-surface py-3 text-xs text-text transition-colors hover:border-accent ${
            showRecent ? 'border-accent' : 'border-border'
          }`}
        >
          <RotateCcw size={18} className="text-text-muted" />
          Repetir
        </button>
      </section>

      {showRecent && (
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-wide text-text-muted">Comidas recientes</h2>
          {recent && recent.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              {recent.map((e, i) => (
                <button
                  key={e.id}
                  onClick={() => repeatEntry(e)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 ${
                    i > 0 ? 'border-t border-border' : ''
                  }`}
                >
                  <FoodThumb photo={e.photo} />
                  <span className="min-w-0 flex-1 truncate text-sm text-text">{e.name}</span>
                  <span className="text-xs text-text-muted">{e.kcal} kcal</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Aún no hay comidas en los últimos 14 días.</p>
          )}
        </section>
      )}

      {MEAL_TYPES.map((meal) => {
        const entries = day.entries.filter((e) => e.meal === meal)
        if (entries.length === 0) return null
        const mealKcal = entries.reduce((sum, e) => sum + e.kcal, 0)
        return (
          <section key={meal}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-xs uppercase tracking-wide text-text-muted">{MEAL_LABELS[meal]}</h2>
              <span className="text-xs text-text-muted">{mealKcal} kcal</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              {entries.map((e, i) => (
                <button
                  key={e.id}
                  onClick={() => setSheet({ mode: e.items ? 'photo' : 'manual', entry: e })}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 ${
                    i > 0 ? 'border-t border-border' : ''
                  }`}
                >
                  <FoodThumb photo={e.photo} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-text">{e.name}</div>
                    <div className="text-xs text-text-muted">
                      P {e.proteinG} g · C {e.carbsG} g · G {e.fatG} g
                    </div>
                  </div>
                  <span className="text-sm font-medium text-text">{e.kcal}</span>
                </button>
              ))}
            </div>
          </section>
        )
      })}

      {day.entries.length === 0 && (
        <p className="text-center text-sm text-text-muted">
          {isToday ? 'Aún no has registrado comidas hoy.' : 'No hay comidas registradas este día.'}
        </p>
      )}

      {sheet && (
        <FoodEntrySheet
          profileId={activeProfileId}
          date={dateKey}
          mode={sheet.mode}
          entry={sheet.entry}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
