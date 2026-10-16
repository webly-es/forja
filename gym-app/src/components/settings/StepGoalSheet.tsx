import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { SettingsSheet } from './SettingsSheet'
import { SheetHelp } from './SettingsParts'

const MIN_STEP_GOAL = 1000

export function StepGoalSheet({ onClose }: { onClose: () => void }) {
  const stepGoal = useAppStore((s) => s.stepGoal)
  const setStepGoal = useAppStore((s) => s.setStepGoal)
  const [draft, setDraft] = useState(String(stepGoal))
  const valid = Number(draft) >= MIN_STEP_GOAL

  function save() {
    if (!valid) return
    setStepGoal(Math.round(Number(draft)))
    onClose()
  }

  return (
    <SettingsSheet title="Meta diaria de pasos" onClose={onClose}>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={MIN_STEP_GOAL}
          step={500}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          className="input min-w-0 flex-1"
        />
        <button
          onClick={save}
          disabled={!valid}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-hover disabled:opacity-30"
        >
          Guardar
        </button>
      </div>
      <SheetHelp label="Pasos desde Salud del iPhone (Atajo)">
        <p>Las apps web no pueden leer Salud directamente, así que un Atajo copia tus pasos y aquí los pegas.</p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5">
          <li>Abre la app Atajos y crea un atajo nuevo llamado "Pasos Forja".</li>
          <li>
            Añade la acción <span className="text-text">Buscar muestras de salud</span>: tipo Pasos, fecha de inicio
            "es hoy".
          </li>
          <li>
            Añade <span className="text-text">Calcular estadísticas</span>: Suma.
          </li>
          <li>
            Añade <span className="text-text">Redondear número</span> y después{' '}
            <span className="text-text">Copiar al portapapeles</span>.
          </li>
          <li>Ejecútalo (la primera vez pedirá permiso para leer Salud), abre Forja → Nutrición → "Pegar de Salud".</li>
        </ol>
        <p className="mt-3">
          Opcional: en Atajos → Automatización, crea una automatización "Hora del día" (por ejemplo 22:00) que
          ejecute este atajo, y solo tendrás que pegar.
        </p>
      </SheetHelp>
    </SettingsSheet>
  )
}
