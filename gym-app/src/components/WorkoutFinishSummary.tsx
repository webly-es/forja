import { Flame } from 'lucide-react'

interface WorkoutFinishSummaryProps {
  title: string
  durationMinutes: number
  calories: number
  onViewDetail: () => void
  onClose: () => void
}

export function WorkoutFinishSummary({
  title,
  durationMinutes,
  calories,
  onViewDetail,
  onClose,
}: WorkoutFinishSummaryProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted text-accent">
          <Flame size={22} />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-text">{title}</h2>
        <p className="mt-1 text-sm text-text-muted">Duración: {durationMinutes} min</p>

        <div className="mt-4 rounded-xl border border-border bg-surface-2 p-4">
          <div className="text-3xl font-semibold text-accent">~{calories}</div>
          <div className="mt-1 text-xs text-text-muted">kcal quemadas (estimado)</div>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Estimado según tu peso y la intensidad, puede variar de la realidad.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm text-text-muted hover:text-text"
          >
            Listo
          </button>
          <button
            onClick={onViewDetail}
            className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-medium text-bg hover:bg-accent-hover"
          >
            Ver detalle
          </button>
        </div>
      </div>
    </div>
  )
}
