import { PATTERNS, groupsOf, type PatternKey } from '../../lib/exercisePatterns'
import type { MuscleGroup } from '../../lib/muscleGroups'

interface PatternTabsProps {
  pattern: PatternKey
  group: MuscleGroup | null
  onPattern: (pattern: PatternKey) => void
  onGroup: (group: MuscleGroup | null) => void
}

// Empuje / Tirón / Pierna / Core, plus the muscle chips of the selected pattern.
export function PatternTabs({ pattern, group, onPattern, onGroup }: PatternTabsProps) {
  const groups = groupsOf(pattern)
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
      active ? 'border-accent/60 bg-accent/15 text-accent' : 'border-border text-text-muted hover:text-text'
    }`

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/5 bg-surface p-1">
        {PATTERNS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPattern(p.key)}
            className={`rounded-lg py-2 font-display text-sm uppercase tracking-wide transition-colors ${
              p.key === pattern ? 'bg-accent text-bg' : 'text-text-muted hover:text-text'
            }`}
            aria-pressed={p.key === pattern}
          >
            {p.label}
          </button>
        ))}
      </div>
      {groups.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
          <button onClick={() => onGroup(null)} className={chip(group === null)}>
            Todos
          </button>
          {groups.map((g) => (
            <button key={g} onClick={() => onGroup(g)} className={chip(group === g)}>
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
