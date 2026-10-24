import { useState } from 'react'
import { applyCoachActions } from '../../db/sessionCoach'
import { describeAction } from '../../lib/ai/sessionCoach'
import { estimateMinutes, fitToTime, TIME_OPTIONS } from '../../lib/timeBudget'
import type { WorkoutEntry } from '../../lib/sessionIncidents'
import { SettingsSheet } from '../settings/SettingsSheet'

interface TimeBudgetSheetProps {
  sessionId: number
  entries: WorkoutEntry[] // today's active exercises, coach changes applied
  doneSets: Map<number, number>
  onClose: () => void
}

// "Hoy tengo 40 minutos": fits what's left of the workout without asking the AI.
export function TimeBudgetSheet({ sessionId, entries, doneSets, onClose }: TimeBudgetSheetProps) {
  const [minutes, setMinutes] = useState<number | null>(null)
  const needed = estimateMinutes(entries, doneSets)
  const actions = minutes != null ? fitToTime(entries, doneSets, minutes) : []
  const names = new Map(entries.map((e) => [e.exercise.id!, e.exercise.name]))

  async function apply() {
    if (actions.length) await applyCoachActions(sessionId, actions)
    onClose()
  }

  return (
    <SettingsSheet title="¿Cuánto tiempo te queda?" onClose={onClose}>
      <p className="-mt-2 text-xs leading-relaxed text-text-muted">
        Lo que queda de la rutina son unos {needed} min. Primero se quitan series de los últimos ejercicios y, si no basta,
        los últimos ejercicios; el primero y los que ya has empezado no se tocan.
      </p>

      <div className="grid grid-cols-4 gap-2">
        {TIME_OPTIONS.map((m) => (
          <button
            key={m}
            onClick={() => setMinutes(m)}
            className={`rounded-lg border py-2.5 text-sm transition-colors ${
              minutes === m ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-surface-2 text-text-muted hover:text-text'
            }`}
          >
            {m} min
          </button>
        ))}
      </div>

      {minutes != null && (
        <div className="rounded-xl border border-accent-muted bg-accent-muted/20 p-3">
          {actions.length === 0 ? (
            <p className="text-sm text-text">Te da tiempo a hacerla entera.</p>
          ) : (
            <>
              <span className="text-[11px] font-medium uppercase tracking-wide text-accent">Cambios para hoy</span>
              <ul className="mt-1.5 flex flex-col gap-1">
                {actions.map((a) => (
                  <li key={a.exerciseId} className="text-sm text-text">
                    {describeAction(a, names)}
                  </li>
                ))}
              </ul>
              {fitsAfter(entries, doneSets, actions) > minutes && (
                <p className="mt-2 text-xs text-text-muted">Aun así irás justo: prioriza los primeros.</p>
              )}
            </>
          )}
          <button
            onClick={() => void apply()}
            className="mt-3 w-full rounded-lg bg-accent py-2 text-xs font-medium text-bg active:scale-[0.97]"
          >
            {actions.length ? 'Aplicar cambios' : 'Entendido'}
          </button>
        </div>
      )}
    </SettingsSheet>
  )
}

// Minutes left once the changes are applied, to warn when even that doesn't fit.
function fitsAfter(entries: WorkoutEntry[], doneSets: Map<number, number>, actions: ReturnType<typeof fitToTime>): number {
  const dropped = new Set(actions.filter((a) => a.type === 'drop').map((a) => a.exerciseId))
  const sets = new Map(actions.flatMap((a) => (a.type === 'sets' ? [[a.exerciseId, a.sets] as const] : [])))
  return estimateMinutes(
    entries
      .filter((e) => !dropped.has(e.exercise.id!))
      .map((e) => (sets.has(e.exercise.id!) ? { ...e, plan: { ...e.plan, sets: sets.get(e.exercise.id!) } } : e)),
    doneSets,
  )
}
