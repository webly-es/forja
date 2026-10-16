import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getActivityDays } from '../db/activity'
import { buildHeatmap, type HeatmapCell } from '../lib/streak'
import { todayKey } from '../lib/dates'

const WEEKS = 26

const LEVEL_CLASS: Record<HeatmapCell['level'], string> = {
  0: 'bg-surface-2',
  1: 'bg-accent/30',
  2: 'bg-accent/65',
  3: 'bg-accent',
}

function formatDay(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Last six months of training, one square per day; tap a day to see what was done.
export function ActivityHeatmap({ profileId }: { profileId: number }) {
  const today = todayKey()
  const data = useLiveQuery(async () => {
    const days = await getActivityDays(profileId)
    return { days, heatmap: buildHeatmap(days, WEEKS, today) }
  }, [profileId, today])
  const [selected, setSelected] = useState<string | null>(null)

  if (!data) return null
  const { days, heatmap } = data
  const selectedDay = selected ? days.get(selected) : undefined

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm text-text">
          <span className="font-display text-xl text-accent">{heatmap.activeDays}</span> días activos
        </span>
        <span className="text-[11px] text-text-muted">últimos 6 meses</span>
      </div>

      <div>
        <div>
          <div className="relative h-4">
            {heatmap.monthLabels.map((m) => (
              <span
                key={m.column}
                className="absolute text-[9px] leading-none text-text-muted"
                style={{ left: `${(m.column / WEEKS) * 100}%` }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
            {heatmap.columns.map((week, w) => (
              <div key={w} className="grid grid-rows-7 gap-[3px]">
                {week.map((cell) =>
                  cell.future ? (
                    <span key={cell.dateKey} className="aspect-square" />
                  ) : (
                    <button
                      key={cell.dateKey}
                      onClick={() => setSelected(cell.dateKey === selected ? null : cell.dateKey)}
                      className={`aspect-square rounded-[2px] ${LEVEL_CLASS[cell.level]} ${
                        cell.dateKey === selected ? 'ring-1 ring-text' : cell.dateKey === today ? 'ring-1 ring-accent/70' : ''
                      }`}
                      aria-label={formatDay(cell.dateKey)}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-text-muted">
          {selected ? (
            <>
              <span className="capitalize text-text">{formatDay(selected)}</span>
              {' · '}
              {selectedDay ? `${selectedDay.labels.join(', ')} · ${selectedDay.minutes} min` : 'Descanso'}
            </>
          ) : (
            'Toca un día para ver qué hiciste'
          )}
        </p>
        <div className="flex shrink-0 items-center gap-1 text-[9px] text-text-muted">
          Menos
          {([0, 1, 2, 3] as const).map((l) => (
            <span key={l} className={`h-2.5 w-2.5 rounded-[2px] ${LEVEL_CLASS[l]}`} />
          ))}
          Más
        </div>
      </div>
    </div>
  )
}
