import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { getMachineSetting, saveMachineSetting, type MachineSettingFields } from '../db/machineSettings'

interface MachineSettingsProps {
  profileId: number
  exerciseId: number
}

const EMPTY: MachineSettingFields = { seat: '', lever: '', note: '' }

// Seat/lever positions for this person on this machine, editable mid-workout.
export function MachineSettings({ profileId, exerciseId }: MachineSettingsProps) {
  const setting = useLiveQuery(() => getMachineSetting(profileId, exerciseId), [profileId, exerciseId])
  const [draft, setDraft] = useState<MachineSettingFields | null>(null)

  function startEditing() {
    setDraft(setting ? { seat: setting.seat, lever: setting.lever, note: setting.note } : EMPTY)
  }

  async function save() {
    if (!draft) return
    await saveMachineSetting(profileId, exerciseId, draft)
    setDraft(null)
  }

  if (draft) {
    const field =
      'w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent'
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        className="mt-3 rounded-lg border border-border bg-bg/40 p-3"
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-text-muted">Asiento</span>
            <input
              autoFocus
              value={draft.seat}
              onChange={(e) => setDraft({ ...draft, seat: e.target.value })}
              placeholder="Ej. 4"
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-text-muted">Palanca / máquina</span>
            <input
              value={draft.lever}
              onChange={(e) => setDraft({ ...draft, lever: e.target.value })}
              placeholder="Ej. 6"
              className={field}
            />
          </label>
        </div>
        <label className="mt-2 flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">Nota</span>
          <input
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            placeholder="Ej. agarre ancho, respaldo inclinado"
            className={field}
          />
        </label>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setDraft(null)}
            className="flex-1 rounded-lg border border-border py-1.5 text-xs text-text-muted hover:text-text"
          >
            Cancelar
          </button>
          <button type="submit" className="flex-1 rounded-lg bg-accent py-1.5 text-xs font-medium text-bg hover:bg-accent-hover">
            Guardar
          </button>
        </div>
      </form>
    )
  }

  if (!setting) {
    return (
      <button
        onClick={startEditing}
        className="mt-2 flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-accent"
      >
        <Plus size={12} />
        Ajustes de máquina
      </button>
    )
  }

  const chip = 'rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs text-text'
  return (
    <button onClick={startEditing} className="mt-3 flex w-full flex-wrap items-center gap-1.5 text-left" aria-label="Editar ajustes de máquina">
      <SlidersHorizontal size={13} className="text-accent" />
      {setting.seat && (
        <span className={chip}>
          <span className="text-text-muted">Asiento</span> {setting.seat}
        </span>
      )}
      {setting.lever && (
        <span className={chip}>
          <span className="text-text-muted">Palanca</span> {setting.lever}
        </span>
      )}
      {setting.note && <span className="text-xs text-text-muted">{setting.note}</span>}
    </button>
  )
}
