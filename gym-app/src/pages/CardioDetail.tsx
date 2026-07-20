import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db'
import { ArrowLeft, HeartPulse } from 'lucide-react'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function CardioDetail() {
  const { sessionId } = useParams()
  const id = Number(sessionId)
  const navigate = useNavigate()

  const session = useLiveQuery(() => db.cardioSessions.get(id), [id])

  if (!session) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/history')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-text"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-medium text-text">{session.activity}</h1>
          <p className="text-xs text-text-muted">{formatDateTime(session.date)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2 text-accent">
          <HeartPulse size={18} />
          <span className="text-sm text-text-muted">Cardio</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-text-muted">Duración</div>
            <div className="mt-1 text-xl font-semibold text-text">{session.durationMinutes} min</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-text-muted">Calorías</div>
            <div className="mt-1 text-xl font-semibold text-text">~{session.caloriesBurned}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
