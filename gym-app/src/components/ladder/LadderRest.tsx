import { useEffect, useRef, useState } from 'react'
import { formatClock } from '../../lib/ladder'
import { playRestEndBeep, vibrateRestEnd } from '../../lib/sound'

interface LadderRestProps {
  endsAt: number // epoch ms
  totalSeconds: number
  nextRound: number
  rounds: number
  nextReps: number
  onDone: () => void
}

const TICK_MS = 250

// Full-screen rest between rounds; beeps and moves on by itself when it ends.
export function LadderRest({ endsAt, totalSeconds, nextRound, rounds, nextReps, onDone }: LadderRestProps) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)))
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  // Timestamp-based so it stays right if the interval is throttled or the screen locks.
  useEffect(() => {
    function recalc() {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0 && !doneRef.current) {
        doneRef.current = true
        playRestEndBeep()
        vibrateRestEnd()
        onDoneRef.current()
      }
    }
    recalc()
    const id = window.setInterval(recalc, TICK_MS)
    document.addEventListener('visibilitychange', recalc)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', recalc)
    }
  }, [endsAt])

  const progress = totalSeconds > 0 ? remaining / totalSeconds : 0

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <span className="text-xs uppercase tracking-wide text-text-muted">Descanso</span>
      <div className="font-display text-8xl font-medium leading-none tabular-nums text-text">{formatClock(remaining)}</div>
      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-linear" style={{ width: `${progress * 100}%` }} />
      </div>
      <p className="text-sm text-text-muted">
        Siguiente: ronda {nextRound} de {rounds} · <span className="text-accent">{nextReps} {nextReps === 1 ? 'repetición' : 'repeticiones'}</span>
      </p>
      <button
        onClick={() => {
          doneRef.current = true
          onDone()
        }}
        className="rounded-lg border border-border px-6 py-2.5 text-sm text-text-muted hover:text-text"
      >
        Saltar descanso
      </button>
    </div>
  )
}
