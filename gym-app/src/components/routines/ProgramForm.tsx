import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { MUSCLE_GROUPS, type MuscleGroup } from '../../lib/muscleGroups'
import { LEVEL_LABELS, PLACE_LABELS, type ProgramRequest, type TrainingLevel, type TrainingPlace } from '../../lib/ai/routineCoach'

const DAYS = [2, 3, 4, 5, 6]
const MINUTES = [30, 45, 60, 75, 90]

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-wide text-text-muted">{label}</span>
      {children}
    </div>
  )
}

const option = (active: boolean) =>
  `rounded-lg py-2.5 text-sm font-medium transition-colors active:scale-[0.97] ${
    active ? 'bg-accent text-bg' : 'bg-surface-2 text-text-muted hover:text-text'
  }`

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm transition-colors ${
    active ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-surface text-text-muted hover:text-text'
  }`

interface ProgramFormProps {
  value: ProgramRequest
  onChange: (next: ProgramRequest) => void
  onSubmit: () => void
}

// The few questions the coach can't answer from the app's own data.
export function ProgramForm({ value, onChange, onSubmit }: ProgramFormProps) {
  const set = (patch: Partial<ProgramRequest>) => onChange({ ...value, ...patch })
  const togglePriority = (g: MuscleGroup) =>
    set({ priorities: value.priorities.includes(g) ? value.priorities.filter((p) => p !== g) : [...value.priorities, g] })

  return (
    <div className="flex flex-col gap-5">
      <Field label="Días por semana">
        <div className="grid grid-cols-5 gap-1.5">
          {DAYS.map((d) => (
            <button key={d} onClick={() => set({ daysPerWeek: d })} className={option(value.daysPerWeek === d)}>
              {d}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Minutos por sesión">
        <div className="grid grid-cols-5 gap-1.5">
          {MINUTES.map((m) => (
            <button key={m} onClick={() => set({ minutes: m })} className={option(value.minutes === m)}>
              {m}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Nivel">
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(LEVEL_LABELS) as TrainingLevel[]).map((l) => (
            <button key={l} onClick={() => set({ level: l })} className={option(value.level === l)}>
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Dónde entrenas">
        <div className="flex flex-col gap-1.5">
          {(Object.keys(PLACE_LABELS) as TrainingPlace[]).map((p) => (
            <button key={p} onClick={() => set({ place: p })} className={`${option(value.place === p)} px-4 text-left`}>
              {PLACE_LABELS[p]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Músculos a priorizar (opcional)">
        <div className="flex flex-wrap gap-1.5">
          {MUSCLE_GROUPS.map((g) => (
            <button key={g} onClick={() => togglePriority(g)} className={chip(value.priorities.includes(g))} aria-pressed={value.priorities.includes(g)}>
              {g}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Lesiones, molestias o preferencias (opcional)">
        <textarea
          value={value.notes}
          onChange={(e) => set({ notes: e.target.value })}
          rows={3}
          className="input resize-none"
          placeholder="Ej. me molesta el hombro derecho en press por encima de la cabeza; no me gusta la sentadilla con barra"
        />
      </Field>

      <button
        onClick={onSubmit}
        className="flex items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-sm font-medium text-bg shadow-[0_0_24px_-8px_var(--color-accent)] transition-all hover:bg-accent-hover active:scale-[0.97]"
      >
        <Sparkles size={16} />
        Diseñar mi programa
      </button>
    </div>
  )
}
