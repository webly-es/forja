import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ChevronRight, RotateCcw, Sparkles } from 'lucide-react'
import { getRoutineDraftsForProfile } from '../db/routines'
import { applyWeekSuggestion, getWeekReviewData } from '../db/weekReview'
import { reviewWeek, type WeekReview as Review } from '../lib/ai/weekReview'
import { canApply } from '../lib/routineDiff'
import { useAppStore } from '../store/useAppStore'

type Status = 'applied' | 'dismissed'

// The last review per profile survives leaving the page (e.g. to open a routine) until the app reloads.
const cache = new Map<number, { review: Review; status: Record<number, Status> }>()

// "Revisar mi semana": the coach looks at every routine together; each change is accepted on its own.
export function WeekReview() {
  const navigate = useNavigate()
  const profileId = useAppStore((s) => s.activeProfileId)!
  const weeklyGoal = useAppStore((s) => s.weeklyGoal)
  const geminiApiKey = useAppStore((s) => s.geminiApiKey)
  const geminiModel = useAppStore((s) => s.geminiModel)
  const drafts = useLiveQuery(() => getRoutineDraftsForProfile(profileId), [profileId])

  const [review, setReview] = useState<Review | null>(() => cache.get(profileId)?.review ?? null)
  const [status, setStatus] = useState<Record<number, Status>>(() => cache.get(profileId)?.status ?? {})
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setError(null)
    try {
      const data = await getWeekReviewData(profileId, weeklyGoal)
      if (!data) throw new Error('No se encontró el perfil.')
      const result = await reviewWeek(data, geminiApiKey, geminiModel, controller.signal)
      if (controller.signal.aborted) return
      cache.set(profileId, { review: result, status: {} })
      setReview(result)
      setStatus({})
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudo revisar la semana.')
    } finally {
      if (abortRef.current === controller) setRunning(false)
    }
  }, [profileId, weeklyGoal, geminiApiKey, geminiModel])

  // Runs once on open unless there's a review from earlier in this visit to the app.
  useEffect(() => {
    if (!geminiApiKey || cache.has(profileId)) return
    const timer = window.setTimeout(() => void run(), 0)
    return () => {
      window.clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [run, geminiApiKey, profileId])

  function mark(index: number, value: Status) {
    const next = { ...status, [index]: value }
    setStatus(next)
    if (review) cache.set(profileId, { review, status: next })
  }

  async function apply(index: number) {
    const s = review?.suggestions[index]
    if (!review || !s?.action) return
    if (await applyWeekSuggestion(s.routineId, s.action, s.title, review.verdict)) mark(index, 'applied')
  }

  const routineById = new Map((drafts ?? []).map((d) => [d.id!, d]))
  const groups = review
    ? [...new Set(review.suggestions.map((s) => s.routineId))].map((routineId) => ({
        routineId,
        items: review.suggestions.map((s, index) => ({ s, index })).filter(({ s }) => s.routineId === routineId),
      }))
    : []

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/workout/start')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-text-muted transition-colors hover:text-text"
          aria-label="Volver"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-accent">
            <Sparkles size={12} /> Entrenador IA
          </span>
          <h1 className="truncate font-display text-2xl uppercase leading-tight tracking-wide text-text">Revisar mi semana</h1>
        </div>
      </div>

      {!geminiApiKey ? (
        <div className="card-forged p-4 text-sm text-text-muted">
          Para revisar tus rutinas con IA necesitas tu clave gratuita de Gemini.{' '}
          <button onClick={() => navigate('/settings')} className="text-accent hover:underline">
            Configurarla en Ajustes
          </button>
        </div>
      ) : running ? (
        <div className="card-forged flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
          </span>
          <p className="text-sm text-text">Revisando todas tus rutinas…</p>
          <p className="text-xs text-text-muted">Volumen por músculo en la semana, lo que te saltas y tu historial.</p>
        </div>
      ) : error ? (
        <div className="card-forged flex flex-col items-center gap-3 p-4 text-center">
          <p className="text-sm text-danger">{error}</p>
          <button onClick={() => void run()} className="flex items-center gap-1.5 text-sm text-accent hover:underline">
            <RotateCcw size={14} /> Reintentar
          </button>
        </div>
      ) : (
        review && (
          <>
            <div className="card-forged flex flex-col gap-3 p-4">
              <p className="text-sm leading-relaxed text-text">{review.verdict}</p>
              {review.strengths.map((s, i) => (
                <p key={i} className="flex gap-2 text-xs leading-relaxed text-text-muted">
                  <Check size={13} className="mt-0.5 shrink-0 text-accent" />
                  {s}
                </p>
              ))}
            </div>

            {groups.length === 0 && <p className="px-1 text-sm text-text-muted">El coach no cambiaría nada esta semana.</p>}

            {groups.map(({ routineId, items }) => {
              const draft = routineById.get(routineId)
              return (
                <section key={routineId} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="font-display text-sm uppercase tracking-wide text-text">{draft?.name ?? 'Rutina'}</span>
                    {draft && (
                      <button
                        onClick={() => navigate(`/workout/routines/${routineId}/edit`)}
                        className="flex items-center gap-0.5 text-xs text-accent hover:underline"
                      >
                        Abrir <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                  {items.map(({ s, index }) => {
                    const state = status[index]
                    const applicable = s.action != null && draft != null && canApply(draft.items, s.action)
                    return (
                      <div
                        key={index}
                        className={`rounded-xl border border-border bg-surface-2 p-3 ${state === 'dismissed' ? 'opacity-50' : ''}`}
                      >
                        <span className="block text-sm font-medium text-text">{s.title}</span>
                        {s.detail && <span className="mt-0.5 block text-xs leading-relaxed text-text-muted">{s.detail}</span>}
                        <div className="mt-2.5 flex items-center justify-end gap-2">
                          {state === 'applied' ? (
                            <span className="flex items-center gap-1 text-xs text-accent">
                              <Check size={13} /> Aplicado
                            </span>
                          ) : state === 'dismissed' ? (
                            <span className="text-xs text-text-muted">Descartado</span>
                          ) : s.action && !applicable ? (
                            <span className="text-xs text-text-muted">Ya no aplica a la rutina actual</span>
                          ) : (
                            <>
                              <button
                                onClick={() => mark(index, 'dismissed')}
                                className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:text-text"
                              >
                                Descartar
                              </button>
                              {s.action && (
                                <button
                                  onClick={() => void apply(index)}
                                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-bg transition-transform active:scale-[0.97]"
                                >
                                  Aplicar
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </section>
              )
            })}

            <button
              onClick={() => void run()}
              className="flex items-center justify-center gap-1.5 self-center text-xs text-text-muted hover:text-text"
            >
              <RotateCcw size={12} /> Revisar otra vez
            </button>
            <p className="-mt-3 text-center text-xs text-text-muted">Cada cambio que aplicas se guarda al momento en su rutina.</p>
          </>
        )
      )}
    </div>
  )
}
