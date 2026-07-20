import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  activeProfileId: number | null
  activeSessionId: number | null
  restDurationDefault: number // seconds
  setActiveProfileId: (id: number | null) => void
  setActiveSessionId: (id: number | null) => void
  setRestDurationDefault: (seconds: number) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeProfileId: null,
      activeSessionId: null,
      restDurationDefault: 120,
      setActiveProfileId: (id) => set({ activeProfileId: id, activeSessionId: null }),
      setActiveSessionId: (id) => set({ activeSessionId: id }),
      setRestDurationDefault: (seconds) => set({ restDurationDefault: seconds }),
    }),
    { name: 'gym-app-store' },
  ),
)
