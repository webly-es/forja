import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db'
import { deleteCardioSession } from '../db/queries'
import { DetailHero, StatTiles } from '../components/DetailHero'
import { DeleteWithConfirm } from '../components/DeleteWithConfirm'
import { HeartPulse } from 'lucide-react'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function CardioDetail() {
  const { sessionId } = useParams()
  const id = Number(sessionId)
  const navigate = useNavigate()

  const session = useLiveQuery(() => db.cardioSessions.get(id), [id])

  if (!session) return null

  async function handleDelete() {
    await deleteCardioSession(id)
    navigate('/history')
  }

  return (
    <div className="flex flex-col gap-5">
      <DetailHero
        title={session.activity}
        subtitle={formatDate(session.date)}
        backTo="/history"
        icon={
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-muted text-accent">
            <HeartPulse size={22} />
          </span>
        }
      />

      <StatTiles
        items={[
          { label: 'minutos', value: String(session.durationMinutes) },
          { label: 'kcal', value: `~${session.caloriesBurned}` },
          { label: 'intensidad (MET)', value: session.met.toLocaleString('es', { maximumFractionDigits: 1 }) },
        ]}
      />

      <p className="text-xs leading-relaxed text-text-muted">
        Kcal estimadas con tu peso y la intensidad. En el balance diario solo cuenta lo que supera el gasto en reposo.
      </p>

      <DeleteWithConfirm
        label="Eliminar actividad"
        confirmMessage={`¿Eliminar "${session.activity}"?`}
        onConfirm={handleDelete}
      />
    </div>
  )
}
