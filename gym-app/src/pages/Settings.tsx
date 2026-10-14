import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore, DEFAULT_GEMINI_MODEL } from '../store/useAppStore'
import { todayKey } from '../lib/dates'
import { exportProfileData, importProfileData } from '../lib/exportImport'
import { MEASUREMENT_TYPES, MEASUREMENT_LABELS } from '../lib/measurements'
import { testGeminiKey } from '../lib/gemini'
import { Pencil, Download, Upload, Users, RefreshCw, ChevronDown } from 'lucide-react'

const BUILD_TIME_LABEL = new Date(__APP_BUILD_TIME__).toLocaleString('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function Settings() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const setActiveProfileId = useAppStore((s) => s.setActiveProfileId)
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const profile = useLiveQuery(() => db.profiles.get(activeProfileId), [activeProfileId])
  const [todayWeight, setTodayWeight] = useState('')
  const [todayMeasurements, setTodayMeasurements] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<string | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  const geminiApiKey = useAppStore((s) => s.geminiApiKey)
  const geminiModel = useAppStore((s) => s.geminiModel)
  const setGeminiApiKey = useAppStore((s) => s.setGeminiApiKey)
  const setGeminiModel = useAppStore((s) => s.setGeminiModel)
  const [keyDraft, setKeyDraft] = useState(geminiApiKey)
  const [modelDraft, setModelDraft] = useState(geminiModel)
  const [keyStatus, setKeyStatus] = useState<string | null>(null)
  const [testingKey, setTestingKey] = useState(false)
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)

  async function handleSaveGemini() {
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

  async function logTodayWeight() {
    const weightKg = Number(todayWeight)
    if (!weightKg || weightKg <= 0) return
    const today = todayKey()
    const existing = await db.bodyWeightLogs
      .where('profileId')
      .equals(activeProfileId)
      .and((l) => l.date === today)
      .first()
    if (existing) {
      await db.bodyWeightLogs.update(existing.id!, { weightKg })
    } else {
      await db.bodyWeightLogs.add({ profileId: activeProfileId, date: today, weightKg })
    }
    await db.profiles.update(activeProfileId, { weightKg })
    setTodayWeight('')
    setStatus('Peso registrado')
    setTimeout(() => setStatus(null), 2000)
  }

  async function logTodayMeasurements() {
    const today = todayKey()
    const entries = MEASUREMENT_TYPES.filter((type) => {
      const raw = todayMeasurements[type]
      return raw != null && raw.trim() !== '' && Number(raw) > 0
    })
    if (entries.length === 0) return

    for (const type of entries) {
      const valueCm = Number(todayMeasurements[type])
      const existing = await db.bodyMeasurements
        .where('profileId')
        .equals(activeProfileId)
        .and((m) => m.date === today && m.type === type)
        .first()
      if (existing) {
        await db.bodyMeasurements.update(existing.id!, { valueCm })
      } else {
        await db.bodyMeasurements.add({ profileId: activeProfileId, date: today, type, valueCm })
      }
    }
    setTodayMeasurements({})
    setStatus('Medidas registradas')
    setTimeout(() => setStatus(null), 2000)
  }

  async function handleExport() {
    await exportProfileData(activeProfileId)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await importProfileData(file)
      setStatus('Backup importado como nuevo perfil')
    } catch {
      setStatus('No se pudo importar el archivo')
    }
    e.target.value = ''
    setTimeout(() => setStatus(null), 3000)
  }

  function switchUser() {
    setActiveProfileId(null)
    navigate('/select')
  }

  async function handleUpdateCheck() {
    setCheckingUpdate(true)
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      if (reg) {
        await reg.update()
        if (reg.installing || reg.waiting) {
          // Hay una versión nueva instalándose: esperamos a que tome el
          // control antes de recargar, si no, recargamos con el SW viejo
          // todavía activo y parece que el botón no hizo nada.
          await new Promise<void>((resolve) => {
            let settled = false
            const finish = () => {
              if (settled) return
              settled = true
              resolve()
            }
            navigator.serviceWorker.addEventListener('controllerchange', finish, { once: true })
            setTimeout(finish, 5000)
          })
        }
      }
    } catch {
      // sin service worker o sin conexión: igual recargamos abajo
    }
    window.location.reload()
  }

  if (!profile) return null

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-text">Ajustes</h1>

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-text">{profile.name}</div>
            <div className="text-xs text-text-muted">
              {profile.sex === 'M' ? 'Hombre' : 'Mujer'} · {profile.heightCm} cm
            </div>
          </div>
          <button
            onClick={() => navigate(`/setup/${activeProfileId}/edit`)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text"
            aria-label="Editar perfil"
          >
            <Pencil size={16} />
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-text-muted">Registrar peso de hoy</h2>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder={`${profile.weightKg} kg`}
            value={todayWeight}
            onChange={(e) => setTodayWeight(e.target.value)}
            className="input"
          />
          <button
            onClick={logTodayWeight}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-hover"
          >
            Guardar
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-text-muted">Medidas de hoy</h2>
        <div className="grid grid-cols-2 gap-2">
          {MEASUREMENT_TYPES.map((type) => (
            <label key={type} className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">{MEASUREMENT_LABELS[type]}</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="cm"
                value={todayMeasurements[type] ?? ''}
                onChange={(e) => setTodayMeasurements((prev) => ({ ...prev, [type]: e.target.value }))}
                className="input"
              />
            </label>
          ))}
        </div>
        <button
          onClick={logTodayMeasurements}
          className="mt-2 w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-hover"
        >
          Guardar medidas
        </button>
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-text-muted">Análisis de comida (Gemini)</h2>
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">
            Crea una clave gratuita en{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              Google AI Studio
            </a>{' '}
            (botón "Create API key") y pégala aquí. Se guarda solo en este dispositivo. En el plan gratuito, Google
            puede usar las fotos enviadas para mejorar sus modelos.
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
            onClick={handleSaveGemini}
            disabled={testingKey || keyDraft.trim() === ''}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-hover disabled:opacity-30"
          >
            {testingKey ? 'Comprobando…' : 'Guardar y probar'}
          </button>
          {keyStatus && <p className="text-xs text-accent">{keyStatus}</p>}
        </div>
      </section>

      <section>
        <button
          onClick={() => setShowShortcutHelp((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-surface p-4 text-left text-sm text-text transition-colors hover:border-accent"
        >
          Pasos desde Salud del iPhone (Atajo)
          <ChevronDown size={16} className={`text-text-muted transition-transform ${showShortcutHelp ? 'rotate-180' : ''}`} />
        </button>
        {showShortcutHelp && (
          <div className="mt-2 rounded-xl border border-border bg-surface p-4 text-sm text-text-muted">
            <p>Las apps web no pueden leer Salud directamente, así que un Atajo copia tus pasos y aquí los pegas.</p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5">
              <li>Abre la app Atajos y crea un atajo nuevo llamado "Pasos Forja".</li>
              <li>
                Añade la acción <span className="text-text">Buscar muestras de salud</span>: tipo Pasos, fecha
                de inicio "es hoy".
              </li>
              <li>
                Añade <span className="text-text">Calcular estadísticas</span>: Suma.
              </li>
              <li>
                Añade <span className="text-text">Redondear número</span> y después{' '}
                <span className="text-text">Copiar al portapapeles</span>.
              </li>
              <li>Ejecútalo (la primera vez pedirá permiso para leer Salud), abre Forja → Comida → "Pegar pasos".</li>
            </ol>
            <p className="mt-3">
              Opcional: en Atajos → Automatización, crea una automatización "Hora del día" (por ejemplo 22:00) que
              ejecute este atajo, y solo tendrás que pegar.
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wide text-text-muted">Datos</h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left text-sm text-text transition-colors hover:border-accent"
        >
          <Download size={18} className="text-text-muted" />
          Exportar mis datos (backup JSON)
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left text-sm text-text transition-colors hover:border-accent"
        >
          <Upload size={18} className="text-text-muted" />
          Importar backup
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wide text-text-muted">App</h2>
        <button
          onClick={handleUpdateCheck}
          disabled={checkingUpdate}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left text-sm text-text transition-colors hover:border-accent disabled:opacity-30"
        >
          <RefreshCw size={18} className={`text-text-muted ${checkingUpdate ? 'animate-spin' : ''}`} />
          <div>
            <div>Buscar actualización y recargar</div>
            <div className="mt-0.5 text-xs text-text-muted">Versión instalada: {BUILD_TIME_LABEL}</div>
          </div>
        </button>
      </section>

      <button
        onClick={switchUser}
        className="flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm text-text-muted transition-colors hover:text-text"
      >
        <Users size={16} />
        Cambiar de usuario
      </button>

      {status && (
        <p className="text-center text-xs text-accent">{status}</p>
      )}
    </div>
  )
}
