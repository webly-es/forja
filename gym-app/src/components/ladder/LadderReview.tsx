import { useNavigate } from 'react-router-dom'
import { RotateCcw, Sparkles } from 'lucide-react'
import { useLadderReview } from '../../hooks/useLadderReview'

interface LadderReviewProps {
  sessionId: number
  autoStart?: boolean
}

const kg = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })

// AI coach's take on a ladder circuit: summary plus the weight and rest for next time.
export function LadderReview({ sessionId, autoStart = false }: LadderReviewProps) {
  const navigate = useNavigate()
  const { review, loaded, running, error, run, hasKey } = useLadderReview(sessionId, autoStart)

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
        {review.ladder && (
          <div className="mt-3 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-text">Próxima vez</span>
              <span className="text-xs font-semibold text-accent">
                {kg(review.ladder.nextDumbbellKg)} kg por mancuerna · descanso {review.ladder.nextRestSeconds} s
              </span>
            </div>
            {review.ladder.comment && <p className="mt-1 text-xs leading-relaxed text-text-muted">{review.ladder.comment}</p>}
          </div>
        )}
      </div>
    )
  }

  if (!hasKey) {
    return (
      <div className="text-left">
        {header}
        <p className="mt-2 text-xs text-text-muted">
          Añade tu clave de Gemini para que la IA analice tus circuitos.{' '}
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
          Analizando tu circuito…
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
