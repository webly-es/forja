import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAppStore } from '../store/useAppStore'
import { db } from '../db/db'
import { getLadderHistory } from '../db/ladder'
import { reviewLadder } from '../lib/ai/ladderCoach'

// Circuits being analysed right now, so remounting the view doesn't fire a second request.
const inFlight = new Map<number, Promise<void>>()

// Same lifecycle as useWorkoutReview, for ladder circuits. Stored in workoutReviews
// with the `ladder` advice; never touches per-exercise targets.
export function useLadderReview(sessionId: number, autoStart = false) {
  const geminiApiKey = useAppStore((s) => s.geminiApiKey)
  const geminiModel = useAppStore((s) => s.geminiModel)
  const review = useLiveQuery(() => db.workoutReviews.get(sessionId), [sessionId], null)
  const [running, setRunning] = useState(() => inFlight.has(sessionId))
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(async () => {
    if (!geminiApiKey) return
    setError(null)
    setRunning(true)
    let job = inFlight.get(sessionId)
    if (!job) {
      job = (async () => {
        const history = await getLadderHistory(sessionId)
        if (!history) throw new Error('No se encontró el circuito.')
        await db.workoutReviews.put(await reviewLadder(history, geminiApiKey, geminiModel))
      })().finally(() => inFlight.delete(sessionId))
      inFlight.set(sessionId, job)
    }
    try {
      await job
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'No se pudo analizar el circuito.')
    } finally {
      if (mounted.current) setRunning(false)
    }
  }, [sessionId, geminiApiKey, geminiModel])

  // `review` is null while loading and undefined once we know there is none.
  const shouldAutoStart = autoStart && review === undefined && !running && !error && !!geminiApiKey
  useEffect(() => {
    if (shouldAutoStart) void run()
  }, [shouldAutoStart, run])

  return { review: review ?? undefined, loaded: review !== null, running, error, run, hasKey: !!geminiApiKey }
}
