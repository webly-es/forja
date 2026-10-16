import { useNavigate } from 'react-router-dom'
import { ArrowDownRight, ArrowRight, ArrowUpRight, RotateCcw, Sparkles, Star } from 'lucide-react'
import { useWorkoutReview } from '../hooks/useWorkoutReview'
import type { ExerciseTrend } from '../types'

interface WorkoutReviewProps {
  sessionId: number
  autoStart?: boolean
}

const TREND_ICON: Record<ExerciseTrend, { icon: typeof ArrowUpRight; className: string; label: string }> = {
  up: { icon: ArrowUpRight, className: 'text-accent', label: 'Mejora' },
  flat: { icon: ArrowRight, className: 'text-text-muted', label: 'Igual' },
  down: { icon: ArrowDownRight, className: 'text-danger', label: 'Baja' },
  new: { icon: Star, className: 'text-accent', label: 'Nuevo' },
}

const kg = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })

// AI coach's take on a strength session: summary, per-exercise trend and next target.
export function WorkoutReview({ sessionId, autoStart = false }: WorkoutReviewProps) {
  const navigate = useNavigate()
  const { review, loaded, running, error, run, hasKey } = useWorkoutReview(sessionId, autoStart)

  const header = (
    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
      <Sparkles size={13} className="text-accent" />
      Análisis del entrenador
    </div>
  )

  if (!loaded) return null

  if (review) {
    return (
      <div className="text-left">
        {header}
        {review.summary && <p className="mt-2 text-sm leading-relaxed text-text">{review.summary}</p>}
        {review.highlights.length > 0 && (
          <ul className="mt-2 space-y-1">
            {review.highlights.map((h, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-text-muted">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {h}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-2">
          {review.exercises.map((ex) => {
            const trend = TREND_ICON[ex.trend]
            const Icon = trend.icon
            return (
              <div key={ex.exerciseId} className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Icon size={15} className={`shrink-0 ${trend.className}`} aria-label={trend.label} />
                  <span className="min-w-0 flex-1 truncate text-sm text-text">{ex.exerciseName}</span>
                  {ex.nextWeightKg > 0 && (
                    <span className="shrink-0 text-xs font-semibold text-accent">
                      {kg(ex.nextWeightKg)} kg × {ex.nextReps}
                    </span>
                  )}
                </div>
                {ex.comment && <p className="mt-1 pl-[23px] text-xs leading-relaxed text-text-muted">{ex.comment}</p>}
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-text-muted">El peso de la derecha es tu objetivo para la próxima vez.</p>
      </div>
    )
  }

  if (!hasKey) {
    return (
      <div className="text-left">
        {header}
        <p className="mt-2 text-xs text-text-muted">
          Añade tu clave de Gemini para que la IA analice tus entrenos.{' '}
          <button onClick={() => navigate('/settings')} className="text-accent hover:underline">
            Ir a Ajustes
          </button>
        </p>
      </div>
    )
  }

  if (running) {
    return (
      <div className="text-left">
        {header}
        <div className="relative mt-2 overflow-hidden rounded-xl border border-accent-muted bg-surface-2 px-3 py-4 text-sm text-text-muted">
          <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-accent/10 to-transparent" />
          Analizando tu sesión…
        </div>
      </div>
    )
  }

  return (
    <div className="text-left">
      {header}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <button
        onClick={() => void run()}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-accent-muted py-2.5 text-sm text-accent transition-colors hover:bg-accent-muted/30"
      >
        {error ? <RotateCcw size={14} /> : <Sparkles size={14} />}
        {error ? 'Reintentar' : 'Analizar con IA'}
      </button>
    </div>
  )
}
