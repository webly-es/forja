import { useAppStore } from '../store/useAppStore'
import { analyzeFood, type FoodAnalysis } from '../lib/ai/food'
import { getFoodMemory } from '../db/foodMemory'
import { AiComposer } from './AiComposer'

interface FoodComposerProps {
  profileId: number
  onAnalyzed: (analysis: FoodAnalysis, photo?: File, note?: string) => void
}

// "¿Qué has comido?" bar: text, voice or photo, all analysed by Gemini.
export function FoodComposer({ profileId, onAnalyzed }: FoodComposerProps) {
  const geminiApiKey = useAppStore((s) => s.geminiApiKey)
  const geminiModel = useAppStore((s) => s.geminiModel)

  return (
    <AiComposer
      placeholder="¿Qué has comido?"
      purpose="calcular comidas"
      allowPhoto
      photoLabel="Foto del plato"
      onSubmit={async ({ photo, ...input }, signal) => {
        const memory = await getFoodMemory(profileId)
        const analysis = await analyzeFood(input, geminiApiKey, geminiModel, signal, memory)
        if (!signal.aborted) onAnalyzed(analysis, photo, photo ? input.text : undefined)
      }}
    />
  )
}
