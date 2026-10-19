import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight, RotateCcw, Sparkles, TrendingDown } from 'lucide-react'
import { getLatestReport, getTrainingReportData, saveReport } from '../db/trainingReport'
import { analyzeTraining } from '../lib/ai/trainingReport'
import { useAppStore } from '../store/useAppStore'

// Profiles being analysed right now: leaving History doesn't cancel the request, the result is still saved.
const inFlight = new Map<number, Promise<void>>()

function reportDate(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long' })
}

// Coach's diagnosis of the last weeks: what works, what holds progress back, and three actions.
export function TrainingReportCard() {
  const navigate = useNavigate()
  const profileId = useAppStore((s) => s.activeProfileId)!
  const weeklyGoal = useAppStore((s) => s.weeklyGoal)
  const geminiApiKey = useAppStore((s) => s.geminiApiKey)
  const geminiModel = useAppStore((s) => s.geminiModel)
  const report = useLiveQuery(() => getLatestReport(profileId), [profileId], null)

  const [running, setRunning] = useState(() => inFlight.has(profileId))
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function run() {
    setError(null)
    setRunning(true)
    let job = inFlight.get(profileId)
    if (!job) {
      job = (async () => {
        const data = await getTrainingReportData(profileId, weeklyGoal)
        if (!data) throw new Error('No se encontró el perfil.')
        await saveReport(await analyzeTraining(data, geminiApiKey, geminiModel))
      })().finally(() => inFlight.delete(profileId))
      inFlight.set(profileId, job)
    }
    try {
      await job
      if (mounted.current) setExpanded(true)
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'No se pudo analizar.')
    } finally {
      if (mounted.current) setRunning(false)
    }
  }

  if (report === null) return null

  const header = (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
        <Sparkles size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text">Análisis del entrenador</span>
        <span className="block text-xs text-text-muted">
          {report ? `Últimas ${report.weeks} semanas · ${reportDate(report.createdAt)}` : 'Qué va bien y qué te frena'}
        </span>
      </span>
    </div>
  )

  if (!geminiApiKey) {
    return (
      <div className="card-forged flex flex-col gap-3 p-4">
        {header}
        <p className="text-xs text-text-muted">
          Necesitas tu clave gratuita de Gemini.{' '}
          <button onClick={() => navigate('/settings')} className="text-accent hover:underline">
            Configurarla en Ajustes
          </button>
        </p>
      </div>
    )
  }

  if (running) {
    return (
      <div className="card-forged flex flex-col gap-3 p-4">
        {header}
        <div className="flex items-center gap-2.5 text-sm text-text-muted">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          Revisando tus entrenos, tu comida y tu peso…
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="card-forged flex flex-col gap-3 p-4">
        {header}
        <button
          onClick={() => void run()}
          className="rounded-lg bg-accent py-2.5 text-sm font-medium text-bg transition-transform active:scale-[0.97]"
        >
          Analizar mis entrenos
        </button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    )
  }

  return (
    <div className="card-forged flex flex-col gap-3 p-4">
      {header}
      <p className="text-sm leading-relaxed text-text">{report.summary}</p>

      {expanded && (
        <>
          {report.good.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-[11px] uppercase tracking-wide text-text-muted">Va bien</h3>
              {report.good.map((g, i) => (
                <p key={i} className="flex gap-2 text-xs leading-relaxed text-text-muted">
                  <Check size={13} className="mt-0.5 shrink-0 text-accent" />
                  {g}
                </p>
              ))}
            </section>
          )}
          {report.problems.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-[11px] uppercase tracking-wide text-text-muted">Lo que te frena</h3>
              {report.problems.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <TrendingDown size={14} className="mt-0.5 shrink-0 text-danger" />
                  <span>
                    <span className="block text-sm text-text">{p.title}</span>
                    <span className="block text-xs leading-relaxed text-text-muted">{p.detail}</span>
                  </span>
                </div>
              ))}
            </section>
          )}
          {report.actions.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-[11px] uppercase tracking-wide text-text-muted">Próximas semanas</h3>
              {report.actions.map((a, i) => (
                <div key={i} className="flex gap-2.5 rounded-lg border border-border bg-surface-2 p-2.5">
                  <span className="font-display text-sm text-accent">{i + 1}</span>
                  <span className="min-w-0 flex-1 text-sm leading-snug text-text">
                    {a.text}
                    {a.routineId != null && (
                      <button
                        onClick={() => navigate(`/workout/routines/${a.routineId}/edit`)}
                        className="mt-1 flex items-center gap-0.5 text-xs text-accent hover:underline"
                      >
                        Abrir la rutina <ChevronRight size={12} />
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </section>
          )}
          <button
            onClick={() => void run()}
            className="flex items-center justify-center gap-1.5 self-center text-xs text-text-muted hover:text-text"
          >
            <RotateCcw size={12} /> Volver a analizar
          </button>
          {error && <p className="text-center text-xs text-danger">{error}</p>}
        </>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-center gap-1 text-xs text-accent"
        aria-expanded={expanded}
      >
        {expanded ? 'Ver menos' : 'Ver análisis completo'}
        <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
    </div>
  )
}
