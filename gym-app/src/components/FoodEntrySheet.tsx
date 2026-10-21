import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Sparkles, Trash2, X } from 'lucide-react'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { resizeImageToBlob } from '../lib/image'
import { analyzeFood, type FoodAnalysis } from '../lib/ai/food'
import { MEAL_LABELS, MEAL_TYPES, mealForHour, type MealType } from '../lib/meals'
import { ConfirmDeleteRow } from './ConfirmDeleteRow'
import { applyAnswers, numberOrZero, scaleItem, sumItems } from '../lib/foodItems'
import { getFoodMemory, learnFromEntry } from '../db/foodMemory'
import type { FoodEntry, FoodItem, FoodQuestion } from '../types'

interface FoodEntrySheetProps {
  profileId: number
  date: string
  mode: 'photo' | 'manual'
  entry?: FoodEntry
  // Analysis already done by the composer (text, voice or photo); the sheet opens in review.
  initialAnalysis?: FoodAnalysis
  initialPhoto?: File
  initialNote?: string
  // Meal preselected when adding from an empty meal card.
  initialMeal?: MealType
  onClose: () => void
}

export function FoodEntrySheet({
  profileId,
  date,
  mode,
  entry,
  initialAnalysis,
  initialPhoto,
  initialNote,
  initialMeal,
  onClose,
}: FoodEntrySheetProps) {
  const navigate = useNavigate()
  const geminiApiKey = useAppStore((s) => s.geminiApiKey)
  const geminiModel = useAppStore((s) => s.geminiModel)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const usesItems = entry ? entry.items != null : mode === 'photo' || initialAnalysis != null
  // Described by text or voice: there is no photo to show or re-analyse.
  const fromDescription = initialAnalysis != null && initialPhoto == null

  const [name, setName] = useState(entry?.name ?? initialAnalysis?.dishName ?? '')
  const [meal, setMeal] = useState<MealType>(entry?.meal ?? initialMeal ?? mealForHour(new Date().getHours()))
  // The AI's items and its one-tap questions; what's shown is derived from the answers
  // until the person edits an item by hand, which takes over from the questions.
  const [base, setBase] = useState<FoodItem[]>(entry?.items ?? initialAnalysis?.items ?? [])
  const [questions, setQuestions] = useState<FoodQuestion[]>(initialAnalysis?.questions ?? [])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [editedItems, setEditedItems] = useState<FoodItem[] | null>(null)
  const proposed = applyAnswers(base, questions, answers)
  const items = editedItems ?? proposed
  const setItems = (update: (prev: FoodItem[]) => FoodItem[]) => setEditedItems(update(items))
  // Grams are scaled from the item as it was when the field got focus, so typing "1", "12", "120"
  // (or clearing the field first) doesn't compound rounding or zero the kcal.
  const gramsFrom = useRef<FoodItem | null>(null)
  const [manual, setManual] = useState({
    kcal: entry && !entry.items ? String(entry.kcal) : '',
    proteinG: entry && !entry.items ? String(entry.proteinG || '') : '',
    carbsG: entry && !entry.items ? String(entry.carbsG || '') : '',
    fatG: entry && !entry.items ? String(entry.fatG || '') : '',
  })

  const [note, setNote] = useState(initialNote ?? '')
  const [photoFile, setPhotoFile] = useState<File | null>(initialPhoto ?? null)
  const [thumbnail, setThumbnail] = useState<Blob | undefined>(entry?.photo)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    if (initialPhoto) void resizeImageToBlob(initialPhoto, 320, 0.7).then(setThumbnail)
  }, [initialPhoto])

  useEffect(() => {
    if (!thumbnail) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(thumbnail)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [thumbnail])

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setPhotoFile(file)
    setThumbnail(await resizeImageToBlob(file, 320, 0.7))
  }

  async function handleAnalyze() {
    if (!photoFile) return
    setAnalyzing(true)
    setError(null)
    try {
      const image = await resizeImageToBlob(photoFile, 1024, 0.8)
      const memory = await getFoodMemory(profileId)
      const result = await analyzeFood({ image, text: note }, geminiApiKey, geminiModel, undefined, memory)
      setBase(result.items)
      setQuestions(result.questions)
      setAnswers({})
      setEditedItems(null)
      if (!name.trim()) setName(result.dishName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo analizar la foto.')
    } finally {
      setAnalyzing(false)
    }
  }

  function updateItem(index: number, patch: Partial<FoodItem>) {
    // A hand-corrected item is reviewed: it no longer needs the "Revisa" label.
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch, confidence: undefined } : item)))
  }

  const totals = usesItems
    ? sumItems(items)
    : {
        kcal: numberOrZero(manual.kcal),
        proteinG: numberOrZero(manual.proteinG),
        carbsG: numberOrZero(manual.carbsG),
        fatG: numberOrZero(manual.fatG),
      }

  const canSave = !saving && name.trim() !== '' && totals.kcal > 0

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    const data = {
      meal,
      name: name.trim(),
      items: usesItems ? items : undefined,
      kcal: Math.round(totals.kcal),
      proteinG: Math.round(totals.proteinG),
      carbsG: Math.round(totals.carbsG),
      fatG: Math.round(totals.fatG),
      photo: thumbnail,
    }
    // Learn the foods as the person left them (new AI meals, or AI meals they edited).
    if (usesItems && (!entry || editedItems)) await learnFromEntry(profileId, items, proposed)
    if (entry?.id != null) {
      await db.foodEntries.update(entry.id, data)
    } else {
      await db.foodEntries.add({
        ...data,
        profileId,
        date,
        loggedAt: new Date().toISOString(),
        source: usesItems ? 'ai' : 'manual',
      })
    }
    onClose()
  }

  async function handleDelete() {
    if (entry?.id == null) return
    await db.foodEntries.delete(entry.id)
    onClose()
  }

  const needsKey = usesItems && !entry && !geminiApiKey

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-6">
      <div className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">
            {entry ? 'Editar comida' : initialAnalysis ? 'Revisar comida' : usesItems ? 'Foto del plato' : 'Valores exactos'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {usesItems && (
          <div className="mt-4 flex flex-col gap-3">
            {(thumbnail || (!entry && !fromDescription)) && (
              <div className="flex items-center gap-3">
                {/* Whole row is the tap target while adding: the camera icon is what people reach for. */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!!entry}
                  className="group flex flex-1 items-center gap-3 text-left disabled:cursor-default"
                >
                  <div
                    className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-surface-2 transition-colors ${
                      entry ? 'border-border text-text-muted' : 'border-accent-muted text-accent group-hover:border-accent'
                    }`}
                  >
                    {previewUrl ? (
                      <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Camera size={26} />
                    )}
                  </div>
                  {!entry && (
                    <span className="text-sm text-accent group-hover:underline">
                      {photoFile ? 'Cambiar foto' : 'Hacer o elegir foto'}
                    </span>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={handlePhotoChange}
                />
              </div>
            )}

            {needsKey ? (
              <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm text-text-muted">
                Para analizar fotos necesitas tu clave gratuita de Gemini.{' '}
                <button onClick={() => navigate('/settings')} className="text-accent hover:underline">
                  Configurarla en Ajustes
                </button>
              </div>
            ) : (
              !entry &&
              !fromDescription && (
                <>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="input"
                    placeholder="Nota opcional: ej. arroz con pollo, unos 200 g"
                  />
                  <button
                    onClick={handleAnalyze}
                    disabled={!photoFile || analyzing}
                    className="flex items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-bg transition-opacity hover:bg-accent-hover disabled:opacity-30"
                  >
                    <Sparkles size={16} className={analyzing ? 'animate-pulse' : ''} />
                    {analyzing ? 'Analizando…' : items.length > 0 ? 'Volver a analizar' : 'Analizar con IA'}
                  </button>
                </>
              )
            )}

            {error && <p className="text-xs text-danger">{error}</p>}

            {questions.length > 0 && !editedItems && (
              <div className="flex flex-col gap-3 rounded-xl border border-accent-muted bg-accent-muted/20 p-3">
                <span className="text-[11px] font-medium uppercase tracking-wide text-accent">Para afinar</span>
                {questions.map((q, qi) => (
                  <div key={qi}>
                    <p className="mb-1.5 text-sm text-text">{q.text}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {q.options.map((o, oi) => (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            (answers[qi] ?? 0) === oi
                              ? 'border-accent bg-accent/15 text-accent'
                              : 'border-border bg-surface-2 text-text-muted hover:text-text'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-xs uppercase tracking-wide text-text-muted">Alimentos (puedes corregirlos)</div>
                {items.map((item, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border bg-surface-2 p-3 ${item.confidence === 'low' ? 'border-accent-muted' : 'border-border'}`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(i, { name: e.target.value })}
                        className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none"
                      />
                      {item.confidence === 'low' && (
                        <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                          Revisa
                        </span>
                      )}
                      <button
                        onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                        className="text-text-muted hover:text-text"
                        aria-label="Quitar alimento"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {item.note && <p className="mt-0.5 text-[11px] leading-snug text-text-muted">{item.note}</p>}
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <label className="flex flex-col gap-0.5 text-[11px] text-text-muted">
                        Gramos
                        <input
                          type="number"
                          inputMode="decimal"
                          value={item.grams || ''}
                          onFocus={() => (gramsFrom.current = item)}
                          onBlur={() => (gramsFrom.current = null)}
                          onChange={(e) => {
                            const from = gramsFrom.current ?? item
                            setItems((prev) =>
                              prev.map((it, j) => (j === i ? { ...scaleItem(from, numberOrZero(e.target.value)), confidence: undefined } : it)),
                            )
                          }}
                          className="input !py-1.5 text-sm"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5 text-[11px] text-text-muted">
                        kcal
                        <input
                          type="number"
                          inputMode="decimal"
                          value={item.kcal || ''}
                          onChange={(e) => updateItem(i, { kcal: numberOrZero(e.target.value) })}
                          className="input !py-1.5 text-sm"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5 text-[11px] text-text-muted">
                        Proteína g
                        <input
                          type="number"
                          inputMode="decimal"
                          value={item.proteinG || ''}
                          onChange={(e) => updateItem(i, { proteinG: numberOrZero(e.target.value) })}
                          className="input !py-1.5 text-sm"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(!usesItems || items.length > 0) && (
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Ej. Avena con plátano"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Tipo</label>
              <select value={meal} onChange={(e) => setMeal(e.target.value as MealType)} className="input">
                {MEAL_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {MEAL_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            {usesItems ? (
              <div className="rounded-xl border border-border bg-surface-2 p-3 text-center">
                <div className="text-2xl font-semibold text-accent">{Math.round(totals.kcal)} kcal</div>
                <div className="mt-1 text-xs text-text-muted">
                  P {Math.round(totals.proteinG)} g · C {Math.round(totals.carbsG)} g · G {Math.round(totals.fatG)} g
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['kcal', 'Calorías (kcal)'],
                    ['proteinG', 'Proteína (g)'],
                    ['carbsG', 'Carbohidratos (g)'],
                    ['fatG', 'Grasa (g)'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{label}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={manual[key]}
                      onChange={(e) => setManual((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="input"
                      placeholder={key === 'kcal' ? 'Obligatorio' : 'Opcional'}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm text-text-muted hover:text-text"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-medium text-bg transition-opacity disabled:opacity-30 hover:bg-accent-hover"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>

        {entry && (
          <div className="mt-3">
            {confirmingDelete ? (
              <div className="rounded-xl border border-border bg-surface p-4">
                <ConfirmDeleteRow
                  message="¿Borrar esta comida del registro?"
                  onCancel={() => setConfirmingDelete(false)}
                  onConfirm={handleDelete}
                  confirmLabel="Sí, borrar"
                />
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs text-danger hover:underline"
              >
                <Trash2 size={14} />
                Borrar comida
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
