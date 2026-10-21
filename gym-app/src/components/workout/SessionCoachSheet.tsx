import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { appendNotes, applyCoachActions } from '../../db/sessionCoach'
import { askSessionCoach, describeAction, type SessionCoachAnswer } from '../../lib/ai/sessionCoach'
import type { ChangeRequest } from '../../lib/ai/routineCoach'
import type { WorkoutEntry } from '../../lib/sessionIncidents'
import { useAppStore } from '../../store/useAppStore'
import { SettingsSheet } from '../settings/SettingsSheet'
import { AiComposer } from '../AiComposer'
import type { Profile, SkipReason, WorkoutSession } from '../../types'

const QUICK_MESSAGES = ['Tengo que irme ya', 'Me quedan 15 minutos', 'Estoy sin energía', 'Me duele algo', 'Gimnasio lleno']

interface SessionCoachSheetProps {
  session: WorkoutSession
  profile: Profile
  entries: WorkoutEntry[] // today's active exercises, coach changes applied
  onFinishNow: (reason: SkipReason) => void
  onClose: () => void
}

// Whole-session chat: tell the coach about a stop, a pain or a time limit and accept its changes.
export function SessionCoachSheet({ session, profile, entries, onFinishNow, onClose }: SessionCoachSheetProps) {
  const geminiApiKey = useAppStore((s) => s.geminiApiKey)
  const geminiModel = useAppStore((s) => s.geminiModel)
  const sessionId = session.id!
  const sets = useLiveQuery(() => db.sets.where('sessionId').equals(sessionId).toArray(), [sessionId], [])

  const [proposal, setProposal] = useState<SessionCoachAnswer | null>(null)
  const [asking, setAsking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const notes = session.notes ?? []

  useEffect(() => () => abortRef.current?.abort(), [])
  // Braces matter: newer browsers return a Promise from scrollIntoView, which React would take as a cleanup.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [notes.length, proposal])

  async function ask(question: ChangeRequest, signal?: AbortSignal) {
    const minutesIn = Math.max(1, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000))
    const result = await askSessionCoach(
      { profile, routineName: session.routineName, minutesIn, entries, sets: sets ?? [], notes },
      question,
      geminiApiKey,
      geminiModel,
      signal,
    )
    if (signal?.aborted) return
    const at = new Date().toISOString()
    await appendNotes(sessionId, [
      { at, role: 'user', text: result.heard },
      { at, role: 'coach', text: result.answer },
    ])
    setProposal(result.actions.length || result.finish ? result : null)
  }

  async function askQuick(text: string) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setAsking(text)
    setError(null)
    try {
      await ask({ text }, controller.signal)
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudo hablar con el coach.')
    } finally {
      if (abortRef.current === controller) setAsking(null)
    }
  }

  async function accept() {
    if (!proposal) return
    if (proposal.actions.length) await applyCoachActions(sessionId, proposal.actions)
    setProposal(null)
  }

  const names = new Map(entries.map((e) => [e.exercise.id!, e.exercise.name]))

  return (
    <SettingsSheet title="Habla con el coach" onClose={onClose}>
      <p className="-mt-2 text-xs leading-relaxed text-text-muted">
        Cuéntale si tienes que parar, te duele algo o vas justo de tiempo. Ajusta lo que queda y lo tendrá en cuenta al analizar la sesión.
      </p>

      {notes.length > 0 && (
        <div className="flex flex-col gap-2">
          {notes.map((n, i) => (
            <p
              key={i}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                n.role === 'user'
                  ? 'self-end rounded-br-md bg-accent/15 text-text'
                  : 'self-start rounded-bl-md border border-border bg-surface-2 text-text'
              }`}
            >
              {n.text}
            </p>
          ))}
        </div>
      )}

      {proposal && (
        <div className="rounded-xl border border-accent-muted bg-accent-muted/20 p-3">
          {proposal.actions.length > 0 && (
            <>
              <span className="text-[11px] font-medium uppercase tracking-wide text-accent">Cambios propuestos para hoy</span>
              <ul className="mt-1.5 flex flex-col gap-1">
                {proposal.actions.map((a, i) => (
                  <li key={i} className="text-sm text-text">
                    {describeAction(a, names)}
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => void accept()} className="rounded-lg bg-accent py-2 text-xs font-medium text-bg active:scale-[0.97]">
                  Aplicar cambios
                </button>
                <button
                  onClick={() => setProposal(null)}
                  className="rounded-lg border border-border py-2 text-xs text-text-muted active:scale-[0.97]"
                >
                  Ahora no
                </button>
              </div>
            </>
          )}
          {proposal.finish && (
            <button
              onClick={() => onFinishNow(proposal.finish!)}
              className={`w-full rounded-lg border border-accent py-2 text-xs font-medium text-accent active:scale-[0.97] ${proposal.actions.length ? 'mt-2' : ''}`}
            >
              Finalizar ahora
            </button>
          )}
        </div>
      )}
      <div ref={endRef} />

      <div className="flex flex-wrap gap-1.5">
        {QUICK_MESSAGES.map((q) => (
          <button
            key={q}
            onClick={() => void askQuick(q)}
            disabled={asking != null}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
              asking === q ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-surface-2 text-text-muted hover:text-text'
            }`}
          >
            {q}
          </button>
        ))}
      </div>

      <AiComposer
        placeholder="Ej. tengo que recoger a mi hijo en 10 minutos"
        purpose="hablar con el coach"
        onSubmit={async (input, signal) => {
          setError(null)
          await ask(input, signal)
        }}
      />

      {asking && <p className="text-xs text-text-muted">Pensando…</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </SettingsSheet>
  )
}
