import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, HeartPulse } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { analyzeActivity, type ActivityItem } from '../lib/ai/activity'
import { estimateMet } from '../lib/met'
import { estimateCalories } from '../lib/calories'
import { todayKey } from '../lib/dates'
import { addCardioSessions } from '../db/queries'
import type { Profile } from '../types'
import { AiComposer } from './AiComposer'
import { ActivityReviewSheet } from './ActivityReviewSheet'
import { WorkoutFinishSummary } from './WorkoutFinishSummary'

type Finished = { sessionIds: number[]; minutes: number; calories: number }

// "Cardio y actividad" tab of Entrenar: describe it to the AI, or fall back to the manual form.
export function CardioPanel({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const geminiApiKey = useAppStore((s) => s.geminiApiKey)
  const geminiModel = useAppStore((s) => s.geminiModel)

  const [review, setReview] = useState<ActivityItem[] | null>(null)
  const [showManual, setShowManual] = useState(!geminiApiKey)
  const [activity, setActivity] = useState('')
  const [minutes, setMinutes] = useState('')
  const [finished, setFinished] = useState<Finished | null>(null)

  const canSaveManual = activity.trim() !== '' && Number(minutes) > 0

  async function saveManual() {
    if (!canSaveManual) return
    const durationMinutes = Number(minutes)
    const met = estimateMet(activity)
    const calories = estimateCalories(met, profile.weightKg, durationMinutes)
    const sessionIds = await addCardioSessions(profile.id!, todayKey(), [
      { activity, durationMinutes, met, caloriesBurned: calories },
    ])
    setActivity('')
    setMinutes('')
    setFinished({ sessionIds, minutes: durationMinutes, calories })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm text-text-muted">
          <HeartPulse size={16} className="text-accent" />
          Cuéntale a la IA qué has hecho y cuánto tiempo
        </div>
        <AiComposer
          placeholder="Ej. 1 h corriendo y 8 h limpiando"
          purpose="calcular tu actividad"
          onSubmit={async (input, signal) => {
            const items = await analyzeActivity(input, geminiApiKey, geminiModel, signal)
            if (!signal.aborted) setReview(items)
          }}
        />
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <button
          onClick={() => setShowManual((v) => !v)}
          aria-expanded={showManual}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-text-muted hover:text-text"
        >
          Añadir a mano
          <ChevronDown size={16} className={`transition-transform ${showManual ? 'rotate-180' : ''}`} />
        </button>
        {showManual && (
          <div className="flex flex-col gap-3 border-t border-border p-4">
            <input
              type="text"
              placeholder="Ej. piscina, correr, bicicleta..."
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              className="input"
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="Minutos"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="input"
            />
            <button
              onClick={saveManual}
              disabled={!canSaveManual}
              className="rounded-lg bg-accent py-2.5 text-sm font-medium text-bg transition-all disabled:opacity-30 hover:bg-accent-hover active:enabled:scale-[0.97]"
            >
              Guardar
            </button>
          </div>
        )}
      </div>

      {review && (
        <ActivityReviewSheet
          profileId={profile.id!}
          weightKg={profile.weightKg}
          items={review}
          onClose={() => setReview(null)}
          onSaved={(result) => {
            setReview(null)
            setFinished(result)
          }}
        />
      )}

      {finished && (
        <WorkoutFinishSummary
          title="Actividad registrada"
          durationMinutes={finished.minutes}
          calories={finished.calories}
          onClose={() => {
            setFinished(null)
            navigate('/home')
          }}
          onViewDetail={() =>
            navigate(
              finished.sessionIds.length === 1 ? `/history/cardio/${finished.sessionIds[0]}` : '/history',
            )
          }
        />
      )}
    </div>
  )
}
