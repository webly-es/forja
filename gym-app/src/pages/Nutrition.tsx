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
import { Bar, CalorieRing, MacroBar } from '../components/CalorieRing'
import type { FoodEntry } from '../types'
import {
  Apple,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardPaste,
  Coffee,
  Footprints,
  Moon,
  PenLine,
  Plus,
  RotateCcw,
  Sun,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

type SheetState = {
  mode: 'photo' | 'manual'
  entry?: FoodEntry
  meal?: MealType
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

function FoodThumb({
  photo,
  icon: Icon = Utensils,
  className = 'h-11 w-11',
}: {
  photo?: Blob
  icon?: LucideIcon
  className?: string
}) {
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
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-surface-2 text-text-muted ${className}`}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Icon size={16} strokeWidth={1.5} />}
    </div>
  )
}

function entryGrams(entry: FoodEntry): number {
  return entry.items?.reduce((sum, item) => sum + item.grams, 0) ?? 0
}

export function Nutrition() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const [dateKey, setDateKey] = useState(todayKey)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [showRecent, setShowRecent] = useState(false)
  const [showSpend, setShowSpend] = useState(false)
  const [openMeal, setOpenMeal] = useState<MealType | null>(null)
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
  const barScale = Math.max(targetKcal, day.consumed.kcal, day.energy.total)

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

  const linkButton =
    'flex items-center gap-1.5 text-xs text-accent underline decoration-accent/40 underline-offset-4 transition-colors hover:text-accent-hover'
  const card = 'card-forged'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Comida</h1>
        <div className="flex items-center rounded-full border border-white/10 bg-surface">
          <button
            onClick={() => setDateKey((d) => shiftDateKey(d, -1))}
            className="flex h-8 w-8 items-center justify-center text-text-muted hover:text-text"
            aria-label="Día anterior"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-14 text-center text-xs font-medium capitalize text-text">{formatDateKey(dateKey)}</span>
          <button
            onClick={() => setDateKey((d) => shiftDateKey(d, 1))}
            disabled={isToday}
            className="flex h-8 w-8 items-center justify-center text-text-muted hover:text-text disabled:opacity-30"
            aria-label="Día siguiente"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <section className={`${card} p-4`}>
        <div className="flex items-center gap-4">
          <CalorieRing consumed={day.consumed.kcal} target={targetKcal} />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-wide text-text-muted">Consumido</span>
                <span className="text-sm font-semibold text-text">{Math.round(day.consumed.kcal).toLocaleString('es')}</span>
              </div>
              <Bar value={day.consumed.kcal} target={barScale} muted />
            </div>
            <button onClick={() => setShowSpend((v) => !v)} aria-expanded={showSpend} className="text-left">
              <div className="mb-1 flex items-baseline justify-between">
                <span className="flex items-center gap-0.5 text-[11px] uppercase tracking-wide text-text-muted">
                  Gastado
                  <ChevronDown size={12} className={`transition-transform ${showSpend ? 'rotate-180' : ''}`} />
                </span>
                <span className="text-sm font-semibold text-text">{day.energy.total.toLocaleString('es')}</span>
              </div>
              <Bar value={day.energy.total} target={barScale} muted />
            </button>
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-wide text-text-muted">{balance <= 0 ? 'Déficit' : 'Superávit'}</span>
                <span className="text-sm font-semibold text-accent">{Math.abs(balance).toLocaleString('es')}</span>
              </div>
              <Bar value={Math.abs(balance)} target={barScale} />
            </div>
          </div>
        </div>

        {showSpend && (
          <div className="mt-4 grid grid-cols-4 gap-1 rounded-xl bg-surface py-2.5 text-center text-[11px] text-text-muted">
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

        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-white/10 pt-4">
          <MacroBar label="Proteína" value={day.consumed.proteinG} target={macros.proteinG} />
          <MacroBar label="Carbos" value={day.consumed.carbsG} target={macros.carbsG} />
          <MacroBar label="Grasa" value={day.consumed.fatG} target={macros.fatG} />
        </div>
      </section>

      <section>
        <FoodComposer onAnalyzed={(analysis, photo, note) => setSheet({ mode: 'photo', analysis, photo, note })} />
        <div className="mt-3 flex items-center justify-center gap-6">
          <button onClick={() => setShowRecent((v) => !v)} className={linkButton}>
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
            <div className={`overflow-hidden ${card}`}>
              {recent.map((e, i) => (
                <button
                  key={e.id}
                  onClick={() => repeatEntry(e)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface ${
                    i > 0 ? 'border-t border-white/10' : ''
                  }`}
                >
                  <FoodThumb photo={e.photo} icon={MEAL_ICONS[e.meal]} />
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

      <section className="grid grid-cols-2 gap-3">
        {MEAL_TYPES.map((meal) => {
          const entries = day.entries.filter((e) => e.meal === meal)
          const Icon = MEAL_ICONS[meal]

          if (entries.length === 0) {
            return (
              <button
                key={meal}
                onClick={() => setSheet({ mode: 'manual', meal })}
                className="flex min-h-36 flex-col rounded-2xl border border-dashed border-white/10 p-3 text-left transition-colors hover:border-accent-muted"
              >
                <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{MEAL_LABELS[meal]}</span>
                <span className="flex flex-1 flex-col items-center justify-center gap-1.5 text-text-muted/70">
                  <Icon size={18} strokeWidth={1.5} />
                  <span className="flex items-center gap-1 text-xs">
                    <Plus size={12} />
                    Añadir
                  </span>
                </span>
              </button>
            )
          }

          const kcal = entries.reduce((sum, e) => sum + e.kcal, 0)
          const grams = entries.reduce((sum, e) => sum + entryGrams(e), 0)

          if (openMeal === meal) {
            return (
              <div key={meal} className={`col-span-2 overflow-hidden ${card}`}>
                <button
                  onClick={() => setOpenMeal(null)}
                  aria-expanded
                  className="flex w-full items-center gap-2 border-b border-white/10 px-4 py-3 text-left"
                >
                  <span className="flex-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                    {MEAL_LABELS[meal]}
                  </span>
                  <span className="text-sm font-semibold text-accent">{kcal} kcal</span>
                  <ChevronUp size={15} className="text-text-muted" />
                </button>
                {entries.map((e, i) => (
                  <button
                    key={e.id}
                    onClick={() => setSheet({ mode: e.items ? 'photo' : 'manual', entry: e })}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface ${
                      i > 0 ? 'border-t border-white/10' : ''
                    }`}
                  >
                    <FoodThumb photo={e.photo} icon={Icon} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-text">{e.name}</div>
                      <div className="text-xs text-text-muted">
                        P {e.proteinG} g · C {e.carbsG} g · G {e.fatG} g
                      </div>
                    </div>
                    <span className="text-sm font-medium text-text">{e.kcal}</span>
                  </button>
                ))}
                <button
                  onClick={() => setSheet({ mode: 'manual', meal })}
                  className="flex w-full items-center justify-center gap-1 border-t border-white/10 py-2.5 text-xs text-text-muted transition-colors hover:text-accent"
                >
                  <Plus size={12} />
                  Añadir a {MEAL_LABELS[meal].toLowerCase()}
                </button>
              </div>
            )
          }

          return (
            <button
              key={meal}
              onClick={() => setOpenMeal(meal)}
              className={`flex min-h-36 flex-col gap-2 p-3 text-left transition-colors hover:border-accent-muted ${card}`}
            >
              <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{MEAL_LABELS[meal]}</span>
              <div className="flex gap-1.5">
                {entries.slice(0, 2).map((e) => (
                  <FoodThumb key={e.id} photo={e.photo} icon={Icon} className="h-12 flex-1" />
                ))}
              </div>
              <div className="mt-auto min-w-0">
                <div className="truncate text-sm text-text">
                  {entries[0].name}
                  {entries.length > 1 && <span className="text-text-muted"> +{entries.length - 1}</span>}
                </div>
                <div className="text-xs text-text-muted">
                  {grams > 0 && `${grams} g · `}
                  <span className="font-semibold text-accent">{kcal} kcal</span>
                </div>
              </div>
            </button>
          )
        })}
      </section>

      <section className={`${card} px-4 py-3`}>
        <div className="flex items-center gap-2">
          <Footprints size={16} className="text-text-muted" />
          <span className="flex-1 text-sm text-text">
            {day.steps > 0 ? `${day.steps.toLocaleString('es')} pasos` : 'Sin pasos registrados'}
          </span>
          <button
            onClick={handlePasteSteps}
            className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:text-text"
          >
            <ClipboardPaste size={13} />
            Pegar
          </button>
          <button
            onClick={() => setEditingSteps((v) => !v)}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:text-text"
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
          initialMeal={sheet.meal}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
