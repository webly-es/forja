import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, RotateCcw, Sparkles } from 'lucide-react'
import { getTrainingContext, type TrainingContext } from '../../db/routineContext'
import { getRoutineDraftsForProfile } from '../../db/routines'
import { useAppStore } from '../../store/useAppStore'
import { analyzeRoutine, reviseRoutine, type RoutineRevision } from '../../lib/ai/routineAnalysis'
import { applyAction, canApply, routineFingerprint } from '../../lib/routineDiff'
import { shortDate } from '../../lib/format'
import { SettingsSheet } from '../settings/SettingsSheet'
import { AiComposer } from '../AiComposer'
import { RoutineDiff } from './RoutineDiff'
import type { Exercise, RoutineDraft, RoutineItem, RoutineReview } from '../../types'

interface RoutineAnalysisSheetProps {
  draft: RoutineDraft
  exercisesById: Map<number, Exercise>
  // New items (when a change is applied) and the review that goes with them.
  onChange: (next: { items?: RoutineItem[]; aiReview: RoutineReview }) => void
  onClose: () => void
}

const MAX_APPLIED = 8

// The review stored with the routine still describes it as it is now.
const currentReview = (draft: RoutineDraft) =>
  draft.aiReview && draft.aiReview.fingerprint === routineFingerprint(draft.items) ? draft.aiReview : null

// The coach reviews the routine as it is in the builder; changes go to the draft, never straight to the database.
// A routine the coach already reviewed (or designed) and that hasn't changed since shows that review instead of asking again.
export function RoutineAnalysisSheet({ draft, exercisesById, onChange, onClose }: RoutineAnalysisSheetProps) {
  const navigate = useNavigate()
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const geminiApiKey = useAppStore((s) => s.geminiApiKey)
  const geminiModel = useAppStore((s) => s.geminiModel)

  const [context, setContext] = useState<{ ctx: TrainingContext; others: RoutineDraft[] } | null>(null)
  const [initialReview] = useState(() => currentReview(draft))
  const [analysis, setAnalysis] = useState<RoutineReview | null>(initialReview)
  const [fromBefore, setFromBefore] = useState(initialReview != null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState<RoutineRevision | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // The routine as it was analysed: later edits in the builder don't trigger a new request by themselves.
  const draftRef = useRef(draft)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    draftRef.current = draft
    onChangeRef.current = onChange
  }, [draft, onChange])

  const loadContext = useCallback(async () => {
    const [ctx, others] = await Promise.all([getTrainingContext(activeProfileId), getRoutineDraftsForProfile(activeProfileId)])
    if (!ctx) throw new Error('No se encontró el perfil.')
    const loaded = { ctx, others }
    setContext(loaded)
    return loaded
  }, [activeProfileId])

  const run = useCallback(async () => {
    if (!geminiApiKey) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setError(null)
    try {
      const { ctx, others } = await loadContext()
      const current = draftRef.current
      const result = await analyzeRoutine(ctx, current, others, current.aiReview, geminiApiKey, geminiModel, controller.signal)
      if (!controller.signal.aborted) {
        const review: RoutineReview = {
          ...result,
          fingerprint: routineFingerprint(current.items),
          by: 'analysis',
          at: new Date().toISOString(),
          applied: current.aiReview?.applied ?? [],
        }
        onChangeRef.current({ aiReview: review })
        setAnalysis(review)
        setFromBefore(false)
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudo analizar la rutina.')
    } finally {
      if (abortRef.current === controller) setRunning(false)
    }
  }, [geminiApiKey, geminiModel, loadContext])

  // Applies a change and records it, so the next analysis knows the coach asked for it.
  function apply(items: RoutineItem[], change: string) {
    if (!analysis) return
    const review = {
      ...analysis,
      fingerprint: routineFingerprint(items),
      applied: [...analysis.applied, change].slice(-MAX_APPLIED),
    }
    onChange({ items, aiReview: review })
    setAnalysis(review)
  }

  // Analyse once on open unless the stored review still applies; "Analizar otra vez" and "Reintentar" run it again.
  useEffect(() => {
    if (initialReview) return
    const timer = window.setTimeout(() => void run(), 0)
    return () => {
      window.clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [run, initialReview])

  return (
    <SettingsSheet title="Análisis del entrenador" onClose={onClose}>
      {!geminiApiKey ? (
        <p className="text-sm text-text-muted">
          Para analizar rutinas con IA necesitas tu clave gratuita de Gemini.{' '}
          <button onClick={() => navigate('/settings')} className="text-accent hover:underline">
            Configurarla en Ajustes
          </button>
        </p>
      ) : running ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
          </span>
          <p className="text-sm text-text">Revisando tu rutina…</p>
          <p className="text-xs text-text-muted">Equilibrio, orden, volumen y tu historial.</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-sm text-danger">{error}</p>
          <button onClick={() => void run()} className="flex items-center gap-1.5 text-sm text-accent hover:underline">
            <RotateCcw size={14} /> Reintentar
          </button>
        </div>
      ) : (
        analysis && (
          <>
            {fromBefore && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-accent-muted bg-accent-muted/20 px-3 py-2">
                <span className="text-xs text-text-muted">
                  {analysis.by === 'program' ? 'Diseñada por el coach en tu programa' : `Revisada por el coach el ${shortDate(analysis.at)}`}
                  {' '}· sin cambios desde entonces
                </span>
                <button onClick={() => void run()} className="flex shrink-0 items-center gap-1 text-xs text-accent hover:underline">
                  <RotateCcw size={12} /> Analizar otra vez
                </button>
              </div>
            )}
            <p className="text-sm leading-relaxed text-text">{analysis.verdict}</p>
            {analysis.strengths.length > 0 && (
              <ul className="space-y-1">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-relaxed text-text-muted">
                    <Check size={13} className="mt-0.5 shrink-0 text-accent" />
                    {s}
                  </li>
                ))}
              </ul>
            )}

            {analysis.suggestions.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wide text-text-muted">Mejoras</span>
                {analysis.suggestions.map((s, i) => {
                  const applicable = s.action != null && canApply(draft.items, s.action)
                  return (
                    <div key={i} className="rounded-xl border border-border bg-surface-2 p-3">
                      <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-text">{s.title}</span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-text-muted">{s.detail}</span>
                        </span>
                        {s.action &&
                          (applicable ? (
                            <button
                              onClick={() => apply(applyAction(draft.items, s.action!), s.title)}
                              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-bg transition-transform active:scale-[0.97]"
                            >
                              Aplicar
                            </button>
                          ) : (
                            <span className="flex shrink-0 items-center gap-1 px-1 py-1.5 text-xs text-accent">
                              <Check size={13} /> Hecho
                            </span>
                          ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-4">
              <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-text-muted">
                <Sparkles size={12} className="text-accent" /> Pídele un cambio
              </span>
              {revision ? (
                <>
                  {revision.explanation && <p className="text-sm leading-relaxed text-text">{revision.explanation}</p>}
                  <RoutineDiff before={draft.items} after={revision.items} exercisesById={exercisesById} />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRevision(null)}
                      className="flex-1 rounded-lg border border-border py-2.5 text-sm text-text-muted hover:text-text"
                    >
                      Descartar
                    </button>
                    <button
                      onClick={() => {
                        apply(
                          revision.items.map(({ reason: _reason, ...item }) => item),
                          revision.explanation || 'Cambio pedido por la persona',
                        )
                        setRevision(null)
                      }}
                      className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-medium text-bg active:scale-[0.97]"
                    >
                      Aplicar cambios
                    </button>
                  </div>
                </>
              ) : (
                <AiComposer
                  placeholder="Ej. cambia el último por uno de glúteo"
                  purpose="cambiar la rutina"
                  onSubmit={async (input, signal) => {
                    const { ctx, others } = context ?? (await loadContext())
                    const result = await reviseRoutine(ctx, draftRef.current, others, input, geminiApiKey, geminiModel, signal)
                    if (!signal.aborted) setRevision(result)
                  }}
                />
              )}
              <p className="text-[11px] text-text-muted">Los cambios van a la rutina de abajo; se guardan al pulsar Guardar.</p>
            </div>
          </>
        )
      )}
    </SettingsSheet>
  )
}
