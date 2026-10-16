import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react'

// Titled forged card holding rows separated by hairlines.
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs uppercase tracking-wide text-text-muted">{title}</h2>
      <div className="card-forged divide-y divide-white/[0.06] overflow-hidden">{children}</div>
    </section>
  )
}

interface SettingsRowProps {
  icon: LucideIcon
  label: string
  detail?: ReactNode
  value?: ReactNode
  onClick?: () => void
  disabled?: boolean
  iconClassName?: string
  trailing?: ReactNode
}

export function SettingsRow({ icon: Icon, label, detail, value, onClick, disabled, iconClassName = '', trailing }: SettingsRowProps) {
  const content = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accent">
        <Icon size={16} className={iconClassName} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-text">{label}</span>
        {detail && <span className="mt-0.5 block text-xs text-text-muted">{detail}</span>}
      </span>
      {value != null && <span className="shrink-0 text-sm tabular-nums text-accent">{value}</span>}
      {trailing ?? (onClick && <ChevronRight size={16} className="shrink-0 text-text-muted" />)}
    </>
  )
  const className = 'flex w-full items-center gap-3 px-4 py-3 text-left'
  return onClick ? (
    <button onClick={onClick} disabled={disabled} className={`${className} transition-colors hover:bg-white/[0.02] disabled:opacity-40`}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}

// Collapsible help text inside a settings sheet.
export function SheetHelp({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-white/[0.06] pt-3">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left text-sm text-text">
        {label}
        <ChevronDown size={16} className={`shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-2 text-sm leading-relaxed text-text-muted">{children}</div>}
    </div>
  )
}
