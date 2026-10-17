import { useEffect, useState } from 'react'
import { getCheckIn, saveCheckIn } from '../../db/cycle'
import type { CheckInPain, CheckInSleep } from '../../types'
import { SettingsSheet } from '../settings/SettingsSheet'
import { CHECK_IN_PAIN_LABELS, CHECK_IN_SLEEP_LABELS } from '../../lib/cycle'

function Chips<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>
  value: T | null
  onChange: (value: T) => void
}) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg py-2.5 text-sm font-medium transition-colors ${
            value === o.value ? 'bg-accent text-bg' : 'bg-surface-2 text-text-muted hover:text-text'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const ENERGY = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))
const PAIN = (Object.keys(CHECK_IN_PAIN_LABELS) as CheckInPain[]).map((value) => ({ value, label: CHECK_IN_PAIN_LABELS[value] }))
const SLEEP = (Object.keys(CHECK_IN_SLEEP_LABELS) as CheckInSleep[]).map((value) => ({ value, label: CHECK_IN_SLEEP_LABELS[value] }))

// Optional daily check-in; the coach reads it to explain a weaker session.
export function CheckInSheet({ profileId, date, onClose }: { profileId: number; date: string; onClose: () => void }) {
  const [energy, setEnergy] = useState<number | null>(null)
  const [pain, setPain] = useState<CheckInPain | null>(null)
  const [sleep, setSleep] = useState<CheckInSleep | null>(null)

  useEffect(() => {
    void getCheckIn(profileId, date).then((c) => {
      if (!c) return
      setEnergy(c.energy)
      setPain(c.pain)
      setSleep(c.sleep)
    })
  }, [profileId, date])

  const canSave = energy != null && pain != null && sleep != null

  async function save() {
    if (!canSave) return
    await saveCheckIn({ profileId, date, energy, pain, sleep })
    onClose()
  }

  return (
    <SettingsSheet title="¿Cómo te sientes hoy?" onClose={onClose}>
      <p className="text-sm text-text-muted">Opcional. El entrenador lo tiene en cuenta al analizar tu sesión.</p>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between text-xs uppercase tracking-wide text-text-muted">
          Energía
          <span className="normal-case tracking-normal">1 muy baja · 5 muy alta</span>
        </div>
        <Chips options={ENERGY} value={energy} onChange={setEnergy} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-text-muted">Dolor o molestias</span>
        <Chips options={PAIN} value={pain} onChange={setPain} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-text-muted">Sueño</span>
        <Chips options={SLEEP} value={sleep} onChange={setSleep} />
      </div>
      <button
        onClick={save}
        disabled={!canSave}
        className="rounded-xl bg-accent py-3 font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-30"
      >
        Guardar
      </button>
    </SettingsSheet>
  )
}
