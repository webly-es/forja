import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface MuscleGroupAccordionProps {
  label: string
  count: number
  defaultOpen?: boolean
  children: ReactNode
}

export function MuscleGroupAccordion({ label, count, defaultOpen = false, children }: MuscleGroupAccordionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-1.5 text-left"
        aria-expanded={open}
      >
        <span className="text-xs uppercase tracking-wide text-text-muted">
          {label} <span className="text-text-muted/60">({count})</span>
        </span>
        <ChevronDown
          size={16}
          className={`text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-1.5 pt-1.5 pb-1">{children}</div>
        </div>
      </div>
    </div>
  )
}
