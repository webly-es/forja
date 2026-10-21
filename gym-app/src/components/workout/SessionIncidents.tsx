import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown } from 'lucide-react'
import { db } from '../../db/db'
import { SKIP_REASON_LABELS } from '../../lib/sessionIncidents'
import type { WorkoutSession } from '../../types'

// What was left undone and what was told to the coach during the session (History detail).
export function SessionIncidents({ session }: { session: WorkoutSession }) {
  const skipped = session.skipped ?? []
  const notes = session.notes ?? []
  const [showChat, setShowChat] = useState(false)
  const exercises = useLiveQuery(() => db.exercises.bulkGet(skipped.map((s) => s.exerciseId)), [session.skipped])

  if (skipped.length === 0 && notes.length === 0) return null

  return (
    <section className="card-forged flex flex-col gap-2.5 p-4">
      <h2 className="font-display text-sm uppercase tracking-widest text-accent">Incidencias</h2>
      {skipped.length > 0 && (
        <ul className="flex flex-col gap-1">
          {skipped.map((s, i) => (
            <li key={s.exerciseId} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 text-text">{exercises?.[i]?.name ?? 'Ejercicio borrado'}</span>
              <span className="shrink-0 text-xs text-text-muted">{SKIP_REASON_LABELS[s.reason]}</span>
            </li>
          ))}
        </ul>
      )}
      {notes.length > 0 && (
        <>
          <button
            onClick={() => setShowChat((v) => !v)}
            className="flex items-center justify-between text-xs text-text-muted hover:text-text"
            aria-expanded={showChat}
          >
            Conversación con el coach ({notes.filter((n) => n.role === 'user').length})
            <ChevronDown size={14} className={`transition-transform ${showChat ? 'rotate-180' : ''}`} />
          </button>
          {showChat && (
            <div className="flex flex-col gap-1.5">
              {notes.map((n, i) => (
                <p key={i} className={`text-sm leading-relaxed ${n.role === 'user' ? 'text-text' : 'text-text-muted'}`}>
                  <span className="text-xs uppercase tracking-wide text-accent">{n.role === 'user' ? 'Tú' : 'Coach'}</span> {n.text}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
