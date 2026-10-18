import { useEffect, useRef } from 'react'
import { MUSCLE_GROUPS, type MuscleGroup } from '../../lib/muscleGroups'

interface MuscleChipsProps {
  groups: readonly MuscleGroup[] // groups that have at least one exercise
  selected: MuscleGroup | null
  onSelect: (group: MuscleGroup | null) => void
}

// One scrollable row of shortcuts: Todos + every muscle group.
export function MuscleChips({ groups, selected, onSelect }: MuscleChipsProps) {
  const rowRef = useRef<HTMLDivElement>(null)

  // Keep the selected shortcut visible (it may sit past the right edge, e.g. a remembered "Glúteos").
  useEffect(() => {
    const row = rowRef.current
    const active = row?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (row && active) row.scrollTo({ left: active.offsetLeft - row.clientWidth / 2 + active.offsetWidth / 2, behavior: 'smooth' })
  }, [selected])

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
      active ? 'border-accent bg-accent font-medium text-bg' : 'border-border bg-surface text-text-muted hover:text-text'
    }`

  return (
    <div ref={rowRef} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      <button onClick={() => onSelect(null)} className={chip(selected === null)} aria-pressed={selected === null}>
        Todos
      </button>
      {MUSCLE_GROUPS.filter((g) => groups.includes(g)).map((g) => (
        <button key={g} onClick={() => onSelect(g)} className={chip(selected === g)} aria-pressed={selected === g}>
          {g}
        </button>
      ))}
    </div>
  )
}
