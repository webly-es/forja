import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { playRestEndBeep, vibrateRestEnd } from '../lib/sound'

const PRESETS = [90, 120, 180]
const TICK_MS = 250

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
  const endsAtRef = useRef(Date.now() + initialSeconds * 1000)
  const finishedRef = useRef(false)
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  // Timestamp-based countdown so the display stays correct even if the
  // interval is throttled or the screen locks mid-rest.
  useEffect(() => {
    function recalc() {
      const secondsLeft = Math.max(0, Math.round((endsAtRef.current - Date.now()) / 1000))
      setRemaining(secondsLeft)
      if (secondsLeft <= 0 && !finishedRef.current) {
        finishedRef.current = true
        playRestEndBeep()
        vibrateRestEnd()
      }
    }

    recalc()
    const id = window.setInterval(recalc, TICK_MS)
    document.addEventListener('visibilitychange', recalc)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', recalc)
    }
  }, [])

  // Keep the bar pinned to the visible viewport bottom (visualViewport),
  // not the full layout viewport, so it doesn't end up hidden behind the
  // on-screen keyboard when a weight/reps input is focused.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function updateOffset() {
      const offset = window.innerHeight - (vv!.height + vv!.offsetTop)
      setKeyboardOffset(Math.max(0, Math.round(offset)))
    }
    updateOffset()
    vv.addEventListener('resize', updateOffset)
    vv.addEventListener('scroll', updateOffset)
    return () => {
      vv.removeEventListener('resize', updateOffset)
      vv.removeEventListener('scroll', updateOffset)
    }
  }, [])

  function applyPreset(seconds: number) {
    setDuration(seconds)
    endsAtRef.current = Date.now() + seconds * 1000
    setRemaining(seconds)
    finishedRef.current = false
    onChangeDefault?.(seconds)
  }

  const progress = duration > 0 ? Math.max(0, remaining / duration) : 0
  const isDone = remaining <= 0

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-8px_24px_rgba(0,0,0,0.4)]"
      style={keyboardOffset > 0 ? { transform: `translateY(-${keyboardOffset}px)` } : undefined}
    >
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
