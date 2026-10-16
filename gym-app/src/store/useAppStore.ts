import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Alias Google keeps pointed at the current Flash model, so a model
// retirement doesn't break the app. Overridable in Ajustes.
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest'

interface AppState {
  activeProfileId: number | null
  activeSessionId: number | null
  restDurationDefault: number // seconds
  // Stays on this device only (localStorage) — never in code or backups.
  geminiApiKey: string
  geminiModel: string
  stepGoal: number
  setActiveProfileId: (id: number | null) => void
  setActiveSessionId: (id: number | null) => void
  setRestDurationDefault: (seconds: number) => void
  setGeminiApiKey: (key: string) => void
  setGeminiModel: (model: string) => void
  setStepGoal: (steps: number) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeProfileId: null,
      activeSessionId: null,
      restDurationDefault: 120,
      geminiApiKey: '',
      geminiModel: DEFAULT_GEMINI_MODEL,
      stepGoal: 10000,
      setActiveProfileId: (id) => set({ activeProfileId: id, activeSessionId: null }),
      setActiveSessionId: (id) => set({ activeSessionId: id }),
      setRestDurationDefault: (seconds) => set({ restDurationDefault: seconds }),
      setGeminiApiKey: (key) => set({ geminiApiKey: key.trim() }),
      setGeminiModel: (model) => set({ geminiModel: model.trim() || DEFAULT_GEMINI_MODEL }),
      setStepGoal: (steps) => set({ stepGoal: steps > 0 ? Math.round(steps) : 10000 }),
    }),
    { name: 'gym-app-store' },
  ),
)
