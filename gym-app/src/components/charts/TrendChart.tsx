import { useId } from 'react'
import { niceTicks } from './axis'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface TrendPoint {
  label: string // short date for the axis and tooltip
  value: number
}

interface TrendChartProps {
  points: TrendPoint[]
  unit: string
  height?: number
}

const ACCENT = 'var(--color-accent)'
const SURFACE = 'var(--color-surface)'
const GRID = 'var(--color-border)'
const MUTED = 'var(--color-text-muted)'

const fmt = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })

// Single-series trend: thin gold line, faint fill, labelled end point, tap for values.
export function TrendChart({ points, unit, height = 170 }: TrendChartProps) {
  const gradientId = useId()
  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.15, 0.5)
  const ticks = niceTicks(min - pad, max + pad)
  const lastIndex = points.length - 1

  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 22, right: 18, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis
            dataKey="label"
            tick={{ fill: MUTED, fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            domain={[ticks[0], ticks[ticks.length - 1]]}
            ticks={ticks}
            tick={{ fill: MUTED, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={34}
            tickFormatter={fmt}
          />
          <Tooltip
            cursor={{ stroke: MUTED, strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg">
                  <div className="text-text-muted">{label}</div>
                  <div className="font-semibold tabular-nums text-text">
                    {fmt(Number(payload[0].value))} {unit}
                  </div>
                </div>
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={ACCENT}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            activeDot={{ r: 5, fill: ACCENT, stroke: SURFACE, strokeWidth: 2 }}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = props
              if (index !== lastIndex || cx == null || cy == null) return <g key={`d-${index}`} />
              return (
                <g key={`d-${index}`}>
                  <circle cx={cx} cy={cy} r={5} fill={ACCENT} stroke={SURFACE} strokeWidth={2} />
                  <text x={cx} y={cy - 11} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--color-text)">
                    {fmt(points[lastIndex].value)} {unit}
                  </text>
                </g>
              )
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
