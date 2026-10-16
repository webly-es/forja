import { niceTicks } from './axis'
import { Bar, BarChart, CartesianGrid, Rectangle, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface BalancePoint {
  label: string
  balance: number // consumed − spent: negative = deficit
  consumed: number
  spent: number
}

const DEFICIT = 'var(--color-accent)'
const SURPLUS = '#6f6f6f'
const GRID = 'var(--color-border)'
const MUTED = 'var(--color-text-muted)'

const fmt = (n: number) => Math.round(n).toLocaleString('es')

// Daily energy balance as bars from zero: deficit below the line, surplus above.
export function BalanceBars({ points, height = 170 }: { points: BalancePoint[]; height?: number }) {
  // Always include 0 so every bar grows from the zero line.
  const values = points.map((p) => p.balance)
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values))
  return (
    <div>
      <div style={{ height }} className="-ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="25%">
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis
              dataKey="label"
              tick={{ fill: MUTED, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={18}
            />
            <YAxis
              tick={{ fill: MUTED, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={40}
              domain={[ticks[0], ticks[ticks.length - 1]]}
              ticks={ticks}
              tickFormatter={fmt}
            />
            <ReferenceLine y={0} stroke={MUTED} strokeWidth={1} />
            <Tooltip
              cursor={{ fill: 'rgb(255 255 255 / 0.04)' }}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as BalancePoint | undefined) : undefined
                if (!p) return null
                return (
                  <div className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg">
                    <div className="capitalize text-text-muted">{p.label}</div>
                    <div className="font-semibold tabular-nums text-text">
                      {p.balance <= 0 ? 'Déficit' : 'Superávit'} {fmt(Math.abs(p.balance))} kcal
                    </div>
                    <div className="tabular-nums text-text-muted">
                      {fmt(p.consumed)} comidas / {fmt(p.spent)} gastadas
                    </div>
                  </div>
                )
              }}
            />
            <Bar
              dataKey="balance"
              maxBarSize={24}
              isAnimationActive={false}
              shape={(props: unknown) => {
                const p = props as { payload: BalancePoint } & Record<string, unknown>
                const deficit = p.payload.balance <= 0
                // Round the free end only: bottom for bars hanging below zero, top for bars above.
                return (
                  <Rectangle
                    {...(p as object)}
                    fill={deficit ? DEFICIT : SURPLUS}
                    radius={deficit ? [0, 0, 4, 4] : [4, 4, 0, 0]}
                  />
                )
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-end gap-4 text-[11px] text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: DEFICIT }} />
          Déficit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SURPLUS }} />
          Superávit
        </span>
      </div>
    </div>
  )
}
