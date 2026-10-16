import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp, Camera, Mic, Square, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { toWav16kMono } from '../lib/audio'
import { resizeImageToBlob } from '../lib/image'
import { MAX_RECORDING_SECONDS, useVoiceRecorder } from '../hooks/useVoiceRecorder'

export interface ComposerInput {
  text?: string
  audio?: Blob
  // Resized copy for the model, plus the original file for the caller to keep.
  image?: Blob
  photo?: File
}

interface AiComposerProps {
  placeholder: string
  // Shown when there's no Gemini key yet, e.g. "calcular comidas".
  purpose: string
  allowPhoto?: boolean
  photoLabel?: string
  // Resolves when the result has been handed off; throws to show an error under the bar.
  onSubmit: (input: ComposerInput, signal: AbortSignal) => Promise<void>
}

function formatSeconds(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Chat-style input bar shared by every AI feature: text, voice and (optionally) photo.
export function AiComposer({ placeholder, purpose, allowPhoto, photoLabel = 'Foto', onSubmit }: AiComposerProps) {
  const navigate = useNavigate()
  const geminiApiKey = useAppStore((s) => s.geminiApiKey)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const recorder = useVoiceRecorder((audio) => void analyzeAudio(audio))

  async function run(input: () => Promise<ComposerInput>) {
    const controller = new AbortController()
    abortRef.current = controller
    setAnalyzing(true)
    setError(null)
    try {
      await onSubmit(await input(), controller.signal)
      if (controller.signal.aborted) return
      setText('')
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'No se pudo analizar.')
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setAnalyzing(false)
      }
    }
  }

  function analyzeText() {
    const value = text.trim()
    if (!value || analyzing) return
    void run(async () => ({ text: value }))
  }

  function analyzeAudio(audio: Blob) {
    void run(async () => ({ audio: await toWav16kMono(audio) }))
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    // Whatever is typed goes along as a note about the photo.
    void run(async () => ({ image: await resizeImageToBlob(file, 1024, 0.8), photo: file, text }))
  }

  function cancelAnalysis() {
    abortRef.current?.abort()
    abortRef.current = null
    setAnalyzing(false)
  }

  async function toggleRecording() {
    setError(null)
    if (recorder.recording) {
      const audio = await recorder.stop()
      if (audio) analyzeAudio(audio)
      return
    }
    try {
      await recorder.start()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo usar el micrófono.')
    }
  }

  if (!geminiApiKey) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-text-muted">
        Para {purpose} con IA necesitas tu clave gratuita de Gemini.{' '}
        <button onClick={() => navigate('/settings')} className="text-accent hover:underline">
          Configurarla en Ajustes
        </button>
      </div>
    )
  }

  const hasText = text.trim() !== '' && !analyzing && !recorder.recording
  const iconButton =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-30'

  return (
    <div>
      <div
        className={`relative flex items-center gap-1.5 overflow-hidden rounded-2xl border bg-gradient-to-r from-accent/[0.12] via-surface to-surface py-1.5 pl-4 pr-1.5 shadow-[0_0_24px_-10px_var(--color-accent)] transition-colors ${
          recorder.recording ? 'border-accent' : 'border-accent-muted focus-within:border-accent/70'
        }`}
      >
        {analyzing && (
          <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-accent/10 to-transparent" />
        )}
        {recorder.recording ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 py-2 text-sm text-text">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            Escuchando… {formatSeconds(recorder.seconds)}
            <span className="text-xs text-text-muted">/ {formatSeconds(MAX_RECORDING_SECONDS)}</span>
          </div>
        ) : (
          <input
            type="text"
            enterKeyHint="send"
            value={analyzing ? '' : text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && analyzeText()}
            disabled={analyzing}
            placeholder={analyzing ? 'Analizando…' : placeholder}
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-text outline-none placeholder:text-text-muted"
          />
        )}

        {/* With text typed, the mic gives way to "send"; the camera stays so the text can go as a photo note. */}
        {analyzing && (
          <button onClick={cancelAnalysis} className={`${iconButton} text-text-muted hover:text-text`} aria-label="Cancelar">
            <X size={18} />
          </button>
        )}
        {hasText || analyzing ? null : (
          <button
            onClick={toggleRecording}
            disabled={analyzing}
            className={`${iconButton} ${recorder.recording ? 'bg-accent text-bg' : 'text-accent hover:text-accent-hover'}`}
            aria-label={recorder.recording ? 'Parar y calcular' : 'Hablar'}
          >
            {recorder.recording ? <Square size={14} fill="currentColor" /> : <Mic size={19} />}
          </button>
        )}
        {allowPhoto && !recorder.recording && !analyzing && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={analyzing}
            className={`${iconButton} text-text-muted hover:text-accent`}
            aria-label={photoLabel}
          >
            <Camera size={19} />
          </button>
        )}
        {hasText && (
          <button onClick={analyzeText} className={`${iconButton} bg-accent text-bg`} aria-label="Calcular">
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        )}
        {allowPhoto && (
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handlePhoto} />
        )}
      </div>
      {error && <p className="mt-2 px-1 text-xs text-danger">{error}</p>}
    </div>
  )
}
