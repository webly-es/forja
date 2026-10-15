import type { ReactNode } from 'react'

interface RingProps {
  value: number
  target: number
  size: number
  stroke: number
  over?: boolean
  children?: ReactNode
}

// Progress ring; the arc caps at a full circle and turns to the warning colour when over target.
export function Ring({ value, target, size, stroke, over, children }: RingProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = target > 0 ? Math.min(1, Math.max(0, value / target)) : 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-surface-2" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          className={`transition-[stroke-dashoffset] duration-700 ease-out ${over ? 'stroke-danger' : 'stroke-accent'}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

interface CalorieRingProps {
  consumed: number
  target: number
}

export function CalorieRing({ consumed, target }: CalorieRingProps) {
  const remaining = Math.round(target - consumed)
  const over = remaining < 0
  return (
    <Ring value={consumed} target={target} size={120} stroke={8} over={over}>
      <div className={`font-display text-3xl font-medium tabular-nums ${over ? 'text-danger' : 'text-accent'}`}>
        {Math.abs(remaining).toLocaleString('es')}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{over ? 'kcal de más' : 'kcal restantes'}</div>
      <div className="mt-0.5 text-[10px] text-text-muted">de {Math.round(target).toLocaleString('es')}</div>
    </Ring>
  )
}

interface BarProps {
  value: number
  target: number
  over?: boolean
  muted?: boolean
}

// Thin horizontal progress bar, same colour rules as Ring.
export function Bar({ value, target, over, muted }: BarProps) {
  const pct = target > 0 ? Math.min(1, Math.max(0, value / target)) : 0
  return (
    <div className="h-1 overflow-hidden rounded-full bg-surface-2">
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${
          over ? 'bg-danger' : muted ? 'bg-text-muted/60' : 'bg-accent'
        }`}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  )
}

interface MacroBarProps {
  label: string
  value: number
  target: number
}

export function MacroBar({ label, value, target }: MacroBarProps) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mb-1.5 mt-0.5 text-xs text-text">
        <span className="font-semibold">{Math.round(value)}</span>
        <span className="text-text-muted">/{Math.round(target)} g</span>
      </div>
      <Bar value={value} target={target} />
    </div>
  )
}
