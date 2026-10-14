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
    <Ring value={consumed} target={target} size={184} stroke={12} over={over}>
      <div className={`text-4xl font-semibold tracking-tight ${over ? 'text-danger' : 'text-text'}`}>
        {Math.abs(remaining).toLocaleString('es')}
      </div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-text-muted">
        {over ? 'kcal por encima' : 'kcal restantes'}
      </div>
      <div className="mt-1 text-[11px] text-text-muted">de {Math.round(target).toLocaleString('es')}</div>
    </Ring>
  )
}

interface MacroRingProps {
  label: string
  value: number
  target: number
}

export function MacroRing({ label, value, target }: MacroRingProps) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Ring value={value} target={target} size={58} stroke={5}>
        <span className="text-sm font-semibold text-text">{Math.round(value)}</span>
      </Ring>
      <div className="text-center leading-tight">
        <div className="text-[11px] uppercase tracking-wide text-text-muted">{label}</div>
        <div className="text-[11px] text-text-muted">de {Math.round(target)} g</div>
      </div>
    </div>
  )
}
