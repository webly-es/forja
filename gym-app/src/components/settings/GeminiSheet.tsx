import { useState } from 'react'
import { useAppStore, DEFAULT_GEMINI_MODEL } from '../../store/useAppStore'
import { testGeminiKey } from '../../lib/ai/geminiClient'
import { SettingsSheet } from './SettingsSheet'
import { SheetHelp } from './SettingsParts'

export function GeminiSheet({ onClose }: { onClose: () => void }) {
  const geminiApiKey = useAppStore((s) => s.geminiApiKey)
  const geminiModel = useAppStore((s) => s.geminiModel)
  const setGeminiApiKey = useAppStore((s) => s.setGeminiApiKey)
  const setGeminiModel = useAppStore((s) => s.setGeminiModel)
  const [keyDraft, setKeyDraft] = useState(geminiApiKey)
  const [modelDraft, setModelDraft] = useState(geminiModel)
  const [keyStatus, setKeyStatus] = useState<string | null>(null)
  const [testingKey, setTestingKey] = useState(false)

  async function handleSave() {
    setGeminiApiKey(keyDraft)
    setGeminiModel(modelDraft)
    setTestingKey(true)
    setKeyStatus(null)
    try {
      await testGeminiKey(keyDraft.trim(), modelDraft.trim() || DEFAULT_GEMINI_MODEL)
      setKeyStatus('Clave guardada y funcionando')
    } catch (err) {
      setKeyStatus(err instanceof Error ? err.message : 'No se pudo comprobar la clave')
    } finally {
      setTestingKey(false)
    }
  }

  return (
    <SettingsSheet title="Gemini" onClose={onClose}>
      <p className="text-xs leading-relaxed text-text-muted">
        Analiza comidas, actividad y entrenos. La clave se guarda solo en este dispositivo. En el plan gratuito, Google
        puede usar lo enviado para mejorar sus modelos.
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-text-muted">Clave</span>
        <input
          type="password"
          autoComplete="off"
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          className="input"
          placeholder="Pega tu clave aquí"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-text-muted">Modelo</span>
        <input
          type="text"
          autoCapitalize="none"
          value={modelDraft}
          onChange={(e) => setModelDraft(e.target.value)}
          className="input"
          placeholder={DEFAULT_GEMINI_MODEL}
        />
      </label>
      <button
        onClick={handleSave}
        disabled={testingKey || keyDraft.trim() === ''}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-hover disabled:opacity-30"
      >
        {testingKey ? 'Comprobando…' : 'Guardar y probar'}
      </button>
      {keyStatus && <p className="text-xs text-accent">{keyStatus}</p>}
      <SheetHelp label="Cómo crear tu clave de Gemini (gratis)">
        <p>Solo necesitas una cuenta de Google. Tarda un par de minutos y no pide tarjeta.</p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5">
          <li>
            Abre{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              aistudio.google.com/apikey
            </a>{' '}
            e inicia sesión con tu cuenta de Google.
          </li>
          <li>La primera vez, acepta las condiciones de Google AI Studio.</li>
          <li>
            Pulsa <span className="text-text">Create API key</span> (Crear clave de API). Si te pregunta por un
            proyecto, elige el que te propone o crea uno nuevo.
          </li>
          <li>
            Copia la clave que aparece (es un texto largo que empieza por <span className="text-text">AQ.</span> o{' '}
            <span className="text-text">AIza</span>).
          </li>
          <li>
            Vuelve aquí, pégala en <span className="text-text">Clave</span>, deja el modelo como está y pulsa{' '}
            <span className="text-text">Guardar y probar</span>.
          </li>
        </ol>
        <p className="mt-3">
          La clave se guarda solo en este dispositivo: si usas la app en otro móvil, pégala también allí. No la
          compartas con nadie; si crees que alguien la tiene, bórrala en AI Studio y crea otra.
        </p>
      </SheetHelp>
    </SettingsSheet>
  )
}
