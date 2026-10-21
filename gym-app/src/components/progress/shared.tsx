import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { SeriesPoint } from '../../db/progress'
import { fmtNumber, shortDate } from '../../lib/format'

export function ProgressSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wide text-text-muted">{title}</h2>
        {action}
      </div>
      <div className="card-forged p-4">{children}</div>
    </section>
  )
}

// Big current value + change over the shown period, above a chart.
// `better` says which direction is progress (gold); 'none' keeps the change neutral.
export function HeadlineValue({
  points,
  unit,
  better = 'up',
}: {
  points: SeriesPoint[]
  unit: string
  better?: 'up' | 'down' | 'none'
}) {
  const last = points[points.length - 1]
  const first = points[0]
  const change = Math.round((last.value - first.value) * 10) / 10
  const good = better !== 'none' && change !== 0 && (better === 'down' ? change < 0 : change > 0)
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-medium text-text">{fmtNumber(last.value)}</span>
        <span className="text-sm text-text-muted">{unit}</span>
      </div>
      {points.length > 1 && (
        <div className="text-right">
          <div className={`text-sm font-semibold ${change === 0 ? 'text-text-muted' : good ? 'text-accent' : 'text-text'}`}>
            {change > 0 ? '+' : ''}
            {fmtNumber(change)} {unit}
          </div>
          <div className="text-[11px] text-text-muted">desde el {shortDate(first.date)}</div>
        </div>
      )}
    </div>
  )
}

// Collapsible list of every record with its change — the table view behind each chart.
export function RecordsDisclosure({ points, unit }: { points: SeriesPoint[]; unit: string }) {
  const [open, setOpen] = useState(false)
  const rows = points.map((p, i) => ({ ...p, delta: i === 0 ? null : Math.round((p.value - points[i - 1].value) * 10) / 10 })).reverse()
  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-xs text-text-muted hover:text-text"
      >
        Ver registros ({points.length})
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 max-h-64 overflow-y-auto">
          {rows.map((row, i) => (
            <div key={row.date + i} className="flex items-center justify-between border-b border-white/5 py-2 text-sm last:border-0">
              <span className="text-text-muted">{shortDate(row.date, true)}</span>
              <span className="flex items-center gap-3 tabular-nums">
                <span className="text-text">
                  {fmtNumber(row.value)} {unit}
                </span>
                <span className="w-12 text-right text-xs text-text-muted">
                  {row.delta == null || row.delta === 0 ? '—' : `${row.delta > 0 ? '+' : ''}${fmtNumber(row.delta)}`}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="py-4 text-center text-sm text-text-muted">{children}</p>
}
