import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { db } from '../../db/db'
import { addPeriodLog, deletePeriodLog, getPeriodLogs, saveCycleSettings, updatePeriodLog } from '../../db/cycle'
import { CYCLE_METHOD_LABELS, NO_PERIOD_LABELS, PILL_PATTERNS, activePeriod } from '../../lib/cycle'
import { todayKey } from '../../lib/dates'
import type { CycleMethod, CycleSettings, NoPeriodReason, PeriodLog, PillPattern } from '../../types'
import { DeleteWithConfirm } from '../DeleteWithConfirm'
import { SettingsSheet } from './SettingsSheet'
import { SheetHelp } from './SettingsParts'

const METHODS = Object.keys(CYCLE_METHOD_LABELS) as CycleMethod[]
const PATTERNS = Object.keys(PILL_PATTERNS) as PillPattern[]
const REASONS = Object.keys(NO_PERIOD_LABELS) as NoPeriodReason[]
const VISIBLE_LOGS = 12

function shortDate(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

function chipClass(selected: boolean) {
  return `rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    selected ? 'bg-accent text-bg' : 'bg-surface-2 text-text-muted hover:text-text'
  }`
}

// Edits one past period in place; also used to add a new one (log undefined).
function PeriodEditor({ profileId, log, onDone }: { profileId: number; log?: PeriodLog; onDone: () => void }) {
  const today = todayKey()
  const [start, setStart] = useState(log?.startDate ?? today)
  const [end, setEnd] = useState(log?.endDate ?? '')
  const valid = start !== '' && start <= today && (end === '' || end >= start)

  async function save() {
    if (!valid) return
    const fields = { startDate: start, endDate: end || undefined }
    if (log) await updatePeriodLog(log.id!, fields)
    else await addPeriodLog({ profileId, ...fields })
    onDone()
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2/50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Inicio
          <input type="date" value={start} max={today} onChange={(e) => setStart(e.target.value)} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Fin (opcional)
          <input type="date" value={end} min={start} max={today} onChange={(e) => setEnd(e.target.value)} className="input" />
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={onDone} className="flex-1 rounded-lg border border-border py-2 text-sm text-text-muted">
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={!valid}
          className="flex-1 rounded-lg bg-accent py-2 text-sm font-medium text-bg hover:bg-accent-hover disabled:opacity-30"
        >
          Guardar
        </button>
      </div>
      {log && (
        <DeleteWithConfirm
          label="Borrar este registro"
          confirmMessage="¿Borrar este registro?"
          onConfirm={async () => {
            await deletePeriodLog(log.id!)
            onDone()
          }}
        />
      )}
    </div>
  )
}

function PeriodHistory({ profileId, bleedLabel }: { profileId: number; bleedLabel: string }) {
  const logs = useLiveQuery(() => getPeriodLogs(profileId), [profileId], [])
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const recent = [...logs].reverse().slice(0, VISIBLE_LOGS)
  const current = activePeriod(logs, todayKey())

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-text-muted">Historial</span>
        {editing !== 'new' && (
          <button onClick={() => setEditing('new')} className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover">
            <Plus size={13} />
            Añadir {bleedLabel}
          </button>
        )}
      </div>
      {editing === 'new' && <PeriodEditor profileId={profileId} onDone={() => setEditing(null)} />}
      {recent.length === 0 && editing !== 'new' && (
        <p className="text-sm text-text-muted">Sin registros. Añadir los últimos meses mejora la previsión desde el primer día.</p>
      )}
      {recent.map((log) =>
        editing === log.id ? (
          <PeriodEditor key={log.id} profileId={profileId} log={log} onDone={() => setEditing(null)} />
        ) : (
          <button
            key={log.id}
            onClick={() => setEditing(log.id!)}
            className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5 text-left text-sm text-text transition-colors hover:bg-white/[0.04]"
          >
            <span>{shortDate(log.startDate)}</span>
            <span className="text-xs text-text-muted">{log.endDate ? `hasta ${shortDate(log.endDate)}` : log === current ? 'en curso' : 'sin fecha de fin'}</span>
          </button>
        ),
      )}
    </div>
  )
}

export function CycleSheet({ profileId, onClose }: { profileId: number; onClose: () => void }) {
  const profile = useLiveQuery(() => db.profiles.get(profileId), [profileId])
  if (!profile) return null
  const cycle: CycleSettings = profile.cycle ?? { method: 'off' }
  const update = (fields: Partial<CycleSettings>) => saveCycleSettings(profileId, { ...cycle, ...fields })

  return (
    <SettingsSheet title="Ciclo" onClose={onClose}>
      <p className="text-sm text-text-muted">
        Elige tu situación. Solo con un ciclo natural hay fases; con anticonceptivos hormonales la app sigue tu blíster o tus sangrados.
      </p>

      <div className="flex flex-col gap-1.5">
        {METHODS.map((m) => (
          <button
            key={m}
            onClick={() => void update({ method: m })}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              cycle.method === m ? 'border-accent bg-accent/10' : 'border-border bg-surface-2/50 hover:border-accent-muted'
            }`}
          >
            <span className={`block text-sm font-medium ${cycle.method === m ? 'text-accent' : 'text-text'}`}>
              {CYCLE_METHOD_LABELS[m].label}
            </span>
            <span className="mt-0.5 block text-xs text-text-muted">{CYCLE_METHOD_LABELS[m].detail}</span>
          </button>
        ))}
      </div>

      {cycle.method === 'combined' && (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-text-muted">Pauta</span>
            <div className="flex flex-col gap-1.5">
              {PATTERNS.map((p) => (
                <button
                  key={p}
                  onClick={() => void update({ pillPattern: p })}
                  className={`text-left ${chipClass((cycle.pillPattern ?? '21-7') === p)}`}
                >
                  {PILL_PATTERNS[p].label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-wide text-text-muted">
            Inicio del blíster actual
            <input
              type="date"
              value={cycle.packStartDate ?? ''}
              max={todayKey()}
              onChange={(e) => e.target.value && void update({ packStartDate: e.target.value })}
              className="input normal-case tracking-normal"
            />
          </label>
        </>
      )}

      {cycle.method === 'none' && (
        <div className="grid grid-cols-2 gap-1.5">
          {REASONS.map((r) => (
            <button key={r} onClick={() => void update({ noPeriodReason: r })} className={chipClass((cycle.noPeriodReason ?? 'other') === r)}>
              {NO_PERIOD_LABELS[r]}
            </button>
          ))}
        </div>
      )}

      {cycle.method === 'natural' && <PeriodHistory profileId={profileId} bleedLabel="regla" />}
      {cycle.method === 'progestin' && <PeriodHistory profileId={profileId} bleedLabel="sangrado" />}

      {cycle.method === 'natural' && (
        <SheetHelp label="Cómo se calcula">
          La duración de tu ciclo es la mediana de los últimos 6, así un mes raro no descoloca la previsión. Hasta tener dos ciclos
          completos se usa 28 días como estimación. La ovulación se sitúa unos 14 días antes de la siguiente regla. Es una guía para
          entrenar, no un método anticonceptivo.
        </SheetHelp>
      )}
      <SheetHelp label="Privacidad">
        Estos datos se guardan solo en este dispositivo y solo se ven en tu perfil. Al analizar un entreno, el entrenador IA recibe
        únicamente la fase o el tramo del blíster y tu chequeo del día, sin fechas. Se incluyen en tu copia de seguridad.
      </SheetHelp>
    </SettingsSheet>
  )
}
