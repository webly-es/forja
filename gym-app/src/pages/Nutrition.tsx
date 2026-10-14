import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { setDailySteps } from '../db/queries'
import { useAppStore } from '../store/useAppStore'
import { useDayBalance } from '../hooks/useDayBalance'
import { getMacros, getTargetCalories } from '../lib/metrics'
import { formatDateKey, shiftDateKey, todayKey } from '../lib/dates'
import { MEAL_LABELS, MEAL_TYPES, mealForHour, type MealType } from '../lib/meals'
import type { FoodAnalysis } from '../lib/gemini'
import { FoodEntrySheet } from '../components/FoodEntrySheet'
import { FoodComposer } from '../components/FoodComposer'
import { CalorieRing, MacroRing } from '../components/CalorieRing'
import type { FoodEntry } from '../types'
import {
  Apple,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Coffee,
  Footprints,
  Moon,
  PenLine,
  RotateCcw,
  Sun,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

type SheetState = {
  mode: 'photo' | 'manual'
  entry?: FoodEntry
  analysis?: FoodAnalysis
  photo?: File
  note?: string
} | null

const MEAL_ICONS: Record<MealType, LucideIcon> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Apple,
}

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

export function Nutrition() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const [dateKey, setDateKey] = useState(todayKey)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [showRecent, setShowRecent] = useState(false)
  const [showSpend, setShowSpend] = useState(false)
  const [editingSteps, setEditingSteps] = useState(false)
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

  function flashStepsStatus(message: string) {
    setStepsStatus(message)
    setTimeout(() => setStepsStatus(null), 3000)
  }

  async function saveSteps(steps: number) {
    await setDailySteps(activeProfileId, dateKey, steps)
    setStepsDraft('')
    setEditingSteps(false)
    flashStepsStatus('Pasos guardados')
  }

  async function handlePasteSteps() {
    try {
      const text = await navigator.clipboard.readText()
      const steps = Number(text.replace(/[^\d]/g, ''))
      if (!steps) {
        flashStepsStatus('No hay un número de pasos en el portapapeles')
        return
      }
      await saveSteps(steps)
    } catch {
      flashStepsStatus('No se pudo leer el portapapeles. Escríbelos a mano.')
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

  const linkButton = 'flex items-center gap-1.5 text-xs transition-colors hover:text-accent'

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

      <section className="rounded-2xl border border-accent-muted/60 bg-gradient-to-b from-surface to-surface-2 p-5">
        <div className="flex justify-center">
          <CalorieRing consumed={day.consumed.kcal} target={targetKcal} />
        </div>

        <div className="mt-5 grid grid-cols-3 text-center">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-text-muted">Consumido</div>
            <div className="mt-0.5 text-lg font-semibold text-text">{Math.round(day.consumed.kcal)}</div>
          </div>
          <button onClick={() => setShowSpend((v) => !v)} aria-expanded={showSpend}>
            <div className="flex items-center justify-center gap-0.5 text-[11px] uppercase tracking-wide text-text-muted">
              Gastado
              <ChevronDown size={12} className={`transition-transform ${showSpend ? 'rotate-180' : ''}`} />
            </div>
            <div className="mt-0.5 text-lg font-semibold text-text">{day.energy.total}</div>
          </button>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-text-muted">{balance <= 0 ? 'Déficit' : 'Superávit'}</div>
            <div className="mt-0.5 text-lg font-semibold text-accent">{Math.abs(balance)}</div>
          </div>
        </div>

        {showSpend && (
          <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-bg/40 py-2.5 text-center text-[11px] text-text-muted">
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
        )}

        <div className="mt-5 grid grid-cols-3 border-t border-border pt-5">
          <MacroRing label="Proteína" value={day.consumed.proteinG} target={macros.proteinG} />
          <MacroRing label="Carbos" value={day.consumed.carbsG} target={macros.carbsG} />
          <MacroRing label="Grasa" value={day.consumed.fatG} target={macros.fatG} />
        </div>
      </section>

      <section>
        <FoodComposer onAnalyzed={(analysis, photo, note) => setSheet({ mode: 'photo', analysis, photo, note })} />
        <div className="mt-3 flex items-center justify-center gap-6 text-text-muted">
          <button onClick={() => setShowRecent((v) => !v)} className={`${linkButton} ${showRecent ? 'text-accent' : ''}`}>
            <RotateCcw size={13} />
            Repetir reciente
          </button>
          <button onClick={() => setSheet({ mode: 'manual' })} className={linkButton}>
            <PenLine size={13} />
            Valores exactos
          </button>
        </div>
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
        const Icon = MEAL_ICONS[meal]
        const total = entries.reduce(
          (acc, e) => ({ kcal: acc.kcal + e.kcal, p: acc.p + e.proteinG, c: acc.c + e.carbsG, f: acc.f + e.fatG }),
          { kcal: 0, p: 0, c: 0, f: 0 },
        )
        return (
          <section key={meal} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-muted/50 text-accent">
                <Icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-text">{MEAL_LABELS[meal]}</div>
                <div className="text-[11px] text-text-muted">
                  P {total.p} g · C {total.c} g · G {total.f} g
                </div>
              </div>
              <div className="text-sm font-semibold text-accent">{total.kcal} kcal</div>
            </div>
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
          </section>
        )
      })}

      {day.entries.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-8 text-center">
          <Utensils size={22} className="text-accent" />
          <p className="text-sm text-text">
            {isToday ? 'Aún no has registrado comidas hoy' : 'No hay comidas registradas este día'}
          </p>
          <p className="text-xs text-text-muted">Escribe, habla o haz una foto y la IA calcula el resto.</p>
        </div>
      )}

      <section className="rounded-xl border border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <Footprints size={16} className="text-text-muted" />
          <span className="flex-1 text-sm text-text">
            {day.steps > 0 ? `${day.steps.toLocaleString('es')} pasos` : 'Sin pasos registrados'}
          </span>
          <button
            onClick={handlePasteSteps}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:text-text"
          >
            <ClipboardPaste size={13} />
            Pegar
          </button>
          <button
            onClick={() => setEditingSteps((v) => !v)}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:text-text"
          >
            Editar
          </button>
        </div>
        {editingSteps && (
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
        )}
        {stepsStatus && <p className="mt-2 text-xs text-accent">{stepsStatus}</p>}
      </section>

      {sheet && (
        <FoodEntrySheet
          profileId={activeProfileId}
          date={dateKey}
          mode={sheet.mode}
          entry={sheet.entry}
          initialAnalysis={sheet.analysis}
          initialPhoto={sheet.photo}
          initialNote={sheet.note}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
