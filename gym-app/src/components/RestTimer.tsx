import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { playRestEndBeep, vibrateRestEnd } from '../lib/sound'

const PRESETS = [90, 120, 180]

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface RestTimerProps {
  initialSeconds: number
  onFinish: () => void
  onCancel: () => void
  onChangeDefault?: (seconds: number) => void
}

export function RestTimer({ initialSeconds, onFinish, onCancel, onChangeDefault }: RestTimerProps) {
  const [duration, setDuration] = useState(initialSeconds)
  const [remaining, setRemaining] = useState(initialSeconds)
  const finishedRef = useRef(false)

  useEffect(() => {
    if (remaining <= 0) {
      if (!finishedRef.current) {
        finishedRef.current = true
        playRestEndBeep()
        vibrateRestEnd()
      }
      return
    }
    const id = window.setInterval(() => {
      setRemaining((r) => r - 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [remaining])

  function applyPreset(seconds: number) {
    setDuration(seconds)
    setRemaining(seconds)
    finishedRef.current = false
    onChangeDefault?.(seconds)
  }

  const progress = duration > 0 ? Math.max(0, remaining / duration) : 0
  const isDone = remaining <= 0

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-8px_24px_rgba(0,0,0,0.4)]">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-text-muted">Descanso</span>
          <button
            onClick={onCancel}
            aria-label="Cerrar cronómetro"
            className="text-text-muted hover:text-text"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-1 flex items-center gap-4">
          <div className="text-4xl font-semibold tabular-nums text-text">
            {isDone ? 'Listo' : formatTime(remaining)}
          </div>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`flex-1 rounded-lg border py-2 text-sm transition-colors ${
                duration === p
                  ? 'border-accent bg-accent-muted text-accent'
                  : 'border-border bg-surface-2 text-text-muted hover:text-text'
              }`}
            >
              {formatTime(p)}
            </button>
          ))}
          <button
            onClick={onFinish}
            className="flex-1 rounded-lg bg-accent py-2 text-sm font-medium text-bg hover:bg-accent-hover"
          >
            Saltar
          </button>
        </div>
      </div>
    </div>
  )
}
