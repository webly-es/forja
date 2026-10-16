import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAppStore } from '../store/useAppStore'
import { getSessionHistory, getWorkoutReview, saveWorkoutReview } from '../db/workoutReviews'
import { reviewWorkout } from '../lib/ai/workoutCoach'

// Sessions being analysed right now, so remounting the view doesn't fire a second request.
const inFlight = new Map<number, Promise<void>>()

// Stored AI review of a session, plus a way to (re)run it. The request keeps
// going if the view unmounts, so closing the summary early still saves the result.
export function useWorkoutReview(sessionId: number, autoStart = false) {
  const geminiApiKey = useAppStore((s) => s.geminiApiKey)
  const geminiModel = useAppStore((s) => s.geminiModel)
  const review = useLiveQuery(() => getWorkoutReview(sessionId), [sessionId], null)
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
        const history = await getSessionHistory(sessionId)
        if (!history) throw new Error('No se encontró la sesión.')
        await saveWorkoutReview(await reviewWorkout(history, geminiApiKey, geminiModel))
      })().finally(() => inFlight.delete(sessionId))
      inFlight.set(sessionId, job)
    }
    try {
      await job
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'No se pudo analizar la sesión.')
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
