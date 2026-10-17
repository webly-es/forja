import { useState } from 'react'
import { Minus, Plus, Sparkles } from 'lucide-react'
import { MET_CIRCUIT_TRAINING, estimateCalories } from '../../lib/calories'
import { LADDER_REST_OPTIONS, LADDER_START_REPS_OPTIONS, estimateLadderMinutes, ladderTotals } from '../../lib/ladder'
import type { LadderStartValues } from '../../db/ladder'
import type { Exercise, LadderSetup as Setup } from '../../types'

interface LadderSetupProps {
  exercises: Exercise[]
  bodyWeightKg: number
  initial: LadderStartValues
  onStart: (setup: Omit<Setup, 'roundsDone'>) => void
}

const kg = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })
const STEP_KG = 0.5

// Before the circuit: dumbbell weight, starting reps and rest between rounds.
export function LadderSetup({ exercises, bodyWeightKg, initial, onStart }: LadderSetupProps) {
  const suggestion = initial.suggestion
  const [weightText, setWeightText] = useState(() => {
    const start = suggestion?.nextDumbbellKg ?? initial.dumbbellKg
    return start != null ? String(start).replace('.', ',') : ''
  })
  const [startReps, setStartReps] = useState(initial.startReps)
  const [restSeconds, setRestSeconds] = useState(suggestion?.nextRestSeconds ?? initial.restSeconds)

  const weight = Number(weightText.replace(',', '.'))
  const validWeight = Number.isFinite(weight) && weight > 0
  const { rounds, reps } = ladderTotals(exercises.length, startReps)
  const minutes = estimateLadderMinutes(exercises.length, startReps, restSeconds)
  const kcal = estimateCalories(MET_CIRCUIT_TRAINING, bodyWeightKg, minutes)

  function nudge(delta: number) {
    const base = validWeight ? weight : 0
    setWeightText(String(Math.max(0, base + delta)).replace('.', ','))
  }

  const chip = (selected: boolean) =>
    `flex-1 rounded-lg border py-2 text-sm transition-colors ${
      selected ? 'border-accent bg-accent-muted text-accent' : 'border-border bg-surface-2 text-text-muted hover:text-text'
    }`

  return (
    <div className="flex flex-col gap-4">
      <section className="card-forged p-4">
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Peso por mancuerna</span>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={() => nudge(-STEP_KG)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-muted hover:text-text"
            aria-label="Menos peso"
          >
            <Minus size={18} />
          </button>
          <div className="flex flex-1 items-baseline justify-center gap-1">
            <input
              inputMode="decimal"
              value={weightText}
              onChange={(e) => setWeightText(e.target.value)}
              placeholder="0"
              className="w-24 bg-transparent text-center font-display text-4xl font-medium tabular-nums text-text outline-none"
            />
            <span className="text-sm text-text-muted">kg</span>
          </div>
          <button
            onClick={() => nudge(STEP_KG)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-muted hover:text-text"
            aria-label="Más peso"
          >
            <Plus size={18} />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-text-muted">
          Un peso con el que harías unas {startReps} repeticiones de {exercises[0]?.name.toLowerCase() ?? 'el primer ejercicio'}.
        </p>
        {suggestion && (
          <div className="mt-3 flex gap-2 rounded-lg border border-accent-muted bg-accent-muted/20 px-3 py-2 text-xs text-text-muted">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-accent" />
            <span>
              <span className="text-accent">
                Sugerido por la IA: {kg(suggestion.nextDumbbellKg)} kg · {suggestion.nextRestSeconds} s.
              </span>{' '}
              {suggestion.comment}
            </span>
          </div>
        )}
        {!suggestion && initial.dumbbellKg != null && (
          <p className="mt-2 text-center text-xs text-text-muted">La última vez: {kg(initial.dumbbellKg)} kg.</p>
        )}
      </section>

      <section className="card-forged flex flex-col gap-3 p-4">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Empezar en</span>
          <div className="mt-2 flex gap-2">
            {LADDER_START_REPS_OPTIONS.map((n) => (
              <button key={n} onClick={() => setStartReps(n)} className={chip(startReps === n)}>
                {n} repeticiones
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Descanso entre rondas</span>
          <div className="mt-2 flex gap-2">
            {LADDER_REST_OPTIONS.map((s) => (
              <button key={s} onClick={() => setRestSeconds(s)} className={chip(restSeconds === s)}>
                {s} s
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card-forged p-4">
        <ol className="flex flex-col gap-1.5">
          {exercises.map((ex, i) => (
            <li key={ex.id} className="flex items-center gap-3 text-sm text-text">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs text-accent">
                {i + 1}
              </span>
              {ex.name}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs leading-relaxed text-text-muted">
          Todo seguido sin soltar las mancuernas, descanso y una repetición menos cada ronda: {startReps} → 1.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { value: String(rounds), label: 'rondas' },
            { value: String(reps), label: 'repeticiones' },
            { value: `~${kcal}`, label: `kcal · ~${minutes} min` },
          ].map((t) => (
            <div key={t.label} className="rounded-lg border border-border bg-surface-2 py-2">
              <div className="text-lg font-semibold text-accent">{t.value}</div>
              <div className="text-[11px] text-text-muted">{t.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-text-muted">Calorías estimadas según tu peso ({kg(bodyWeightKg)} kg).</p>
      </section>

      <button
        disabled={!validWeight || exercises.length === 0}
        onClick={() => onStart({ dumbbellKg: weight, startReps, restSeconds })}
        className="rounded-xl bg-accent py-3.5 text-base font-medium text-bg transition-transform hover:bg-accent-hover active:scale-[0.98] disabled:opacity-40"
      >
        Empezar
      </button>
    </div>
  )
}
