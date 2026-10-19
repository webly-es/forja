import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RotateCcw, Sparkles } from 'lucide-react'
import { db } from '../db/db'
import { getTrainingContext, type TrainingContext } from '../db/routineContext'
import { saveProgram } from '../db/routines'
import { useAppStore } from '../store/useAppStore'
import { generateProgram, reviseProgram, type ProgramRequest } from '../lib/ai/routineCoach'
import { AiComposer } from '../components/AiComposer'
import { AiRoutineCard } from '../components/routines/AiRoutineCard'
import { ProgramForm } from '../components/routines/ProgramForm'
import type { AiProgram as Program } from '../types'

// Weekly program designed by the coach: questionnaire → proposal → changes on request → save.
export function AiProgram() {
  const navigate = useNavigate()
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const weeklyGoal = useAppStore((s) => s.weeklyGoal)
  const geminiApiKey = useAppStore((s) => s.geminiApiKey)
  const geminiModel = useAppStore((s) => s.geminiModel)
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [])

  const [ctx, setCtx] = useState<TrainingContext | null>(null)
  const [request, setRequest] = useState<ProgramRequest | null>(null)
  const [program, setProgram] = useState<Program | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    void getTrainingContext(activeProfileId).then((loaded) => {
      if (cancelled || !loaded) return
      setCtx(loaded)
      setRequest({
        daysPerWeek: Math.min(6, Math.max(2, weeklyGoal)),
        minutes: 60,
        level: loaded.sessions.length === 0 ? 'beginner' : 'intermediate',
        place: 'gym',
        priorities: [],
        notes: '',
      })
    })
    return () => {
      cancelled = true
      abortRef.current?.abort()
    }
  }, [activeProfileId, weeklyGoal])

  if (!ctx || !request) return null

  const exercisesById = new Map((exercises ?? []).map((e) => [e.id!, e]))

  async function handleGenerate() {
    if (!ctx || !request) return
    const controller = new AbortController()
    abortRef.current = controller
    setGenerating(true)
    setError(null)
    try {
      const result = await generateProgram(ctx, request, geminiApiKey, geminiModel, controller.signal)
      if (!controller.signal.aborted) setProgram(result)
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudo diseñar el programa.')
    } finally {
      if (abortRef.current === controller) setGenerating(false)
    }
  }

  function cancelGenerate() {
    abortRef.current?.abort()
    setGenerating(false)
  }

  async function handleSave() {
    if (!program) return
    setSaving(true)
    try {
      await saveProgram(
        program.days.map((day) => ({
          name: day.name,
          profileId: activeProfileId,
          notes: [program.name, day.focus].filter(Boolean).join('. '),
          items: day.items.map(({ reason: _reason, ...item }) => item),
        })),
      )
      navigate('/workout/start')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => (program ? setProgram(null) : navigate('/workout/start'))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-text-muted transition-colors hover:text-text"
          aria-label="Volver"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-accent">
            <Sparkles size={12} /> Entrenador IA
          </span>
          <h1 className="truncate font-display text-2xl uppercase leading-tight tracking-wide text-text">
            {program ? program.name : 'Crea tu programa'}
          </h1>
        </div>
      </div>

      {!geminiApiKey ? (
        <div className="card-forged p-4 text-sm text-text-muted">
          Para crear rutinas con IA necesitas tu clave gratuita de Gemini.{' '}
          <button onClick={() => navigate('/settings')} className="text-accent hover:underline">
            Configurarla en Ajustes
          </button>
        </div>
      ) : generating ? (
        <div className="card-forged flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
          </span>
          <p className="text-sm text-text">Diseñando tu programa…</p>
          <p className="text-xs text-text-muted">Tiene en cuenta tu perfil, tu objetivo y tus últimas {ctx.weeks} semanas.</p>
          <button onClick={cancelGenerate} className="mt-2 text-xs text-text-muted hover:text-text">
            Cancelar
          </button>
        </div>
      ) : program ? (
        <>
          {program.summary && <p className="text-sm leading-relaxed text-text-muted">{program.summary}</p>}
          {program.days.map((day, i) => (
            <AiRoutineCard key={i} routine={day} exercisesById={exercisesById} />
          ))}
          <div className="flex flex-col gap-2">
            <span className="px-1 text-xs uppercase tracking-wide text-text-muted">¿Quieres cambiar algo?</span>
            <AiComposer
              placeholder="Ej. cambia el press de banca por mancuernas"
              purpose="ajustar el programa"
              onSubmit={async (input, signal) => {
                const next = await reviseProgram(ctx, request, program, input, geminiApiKey, geminiModel, signal)
                if (!signal.aborted) setProgram(next)
              }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setProgram(null)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-3.5 text-sm text-text-muted transition-colors hover:text-text"
            >
              <RotateCcw size={15} />
              Rehacer
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl bg-accent py-3.5 text-sm font-medium text-bg shadow-[0_0_24px_-8px_var(--color-accent)] transition-all hover:bg-accent-hover active:enabled:scale-[0.97] disabled:opacity-40"
            >
              {saving ? 'Guardando…' : `Guardar ${program.days.length} rutinas`}
            </button>
          </div>
          <p className="-mt-2 text-center text-xs text-text-muted">Se guardan solo para ti. Luego puedes editarlas como cualquier rutina.</p>
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-text-muted">
            Ya conoce tu sexo, edad, peso, objetivo e historial. Solo le falta saber cómo puedes entrenar.
          </p>
          <ProgramForm value={request} onChange={setRequest} onSubmit={handleGenerate} />
          {error && <p className="text-center text-xs text-danger">{error}</p>}
        </>
      )}
    </div>
  )
}
