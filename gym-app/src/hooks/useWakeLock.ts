import { useEffect } from 'react'

// Keeps the screen on while `active` (e.g. during a timed circuit). The lock is
// dropped by the browser when the app goes to the background, so it is retaken on return.
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false

    async function acquire() {
      try {
        const next = await navigator.wakeLock.request('screen')
        if (cancelled) void next.release()
        else lock = next
      } catch {
        // Not allowed right now (battery saver, not visible): the circuit works without it.
      }
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void lock?.release().catch(() => {})
    }
  }, [active])
}
