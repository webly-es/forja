import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore, DEFAULT_GEMINI_MODEL } from '../store/useAppStore'
import { exportProfileData, importProfileData } from '../lib/exportImport'
import { GOAL_LABELS, getAge } from '../lib/metrics'
import { testGeminiKey } from '../lib/ai/geminiClient'
import { SettingsDisclosure, SettingsGroup, SettingsRow } from '../components/settings/SettingsParts'
import {
  Pencil,
  Download,
  Upload,
  Users,
  RefreshCw,
  KeyRound,
  HelpCircle,
  Footprints,
  Smartphone,
  CalendarCheck,
  LineChart,
} from 'lucide-react'

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
  const [status, setStatus] = useState<string | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  const geminiApiKey = useAppStore((s) => s.geminiApiKey)
  const geminiModel = useAppStore((s) => s.geminiModel)
  const setGeminiApiKey = useAppStore((s) => s.setGeminiApiKey)
  const setGeminiModel = useAppStore((s) => s.setGeminiModel)
  const stepGoal = useAppStore((s) => s.stepGoal)
  const setStepGoal = useAppStore((s) => s.setStepGoal)
  const weeklyGoal = useAppStore((s) => s.weeklyGoal)
  const setWeeklyGoal = useAppStore((s) => s.setWeeklyGoal)
  const [keyDraft, setKeyDraft] = useState(geminiApiKey)
  const [modelDraft, setModelDraft] = useState(geminiModel)
  const [keyStatus, setKeyStatus] = useState<string | null>(null)
  const [testingKey, setTestingKey] = useState(false)

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

      <section className="card-forged flex items-center gap-4 p-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-accent/60 bg-accent-muted/40 font-display text-2xl uppercase text-accent">
          {profile.name.trim().charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl uppercase tracking-wide text-text">{profile.name}</div>
          <div className="text-xs text-text-muted">
            {getAge(profile.birthDate)} años · {profile.heightCm} cm · {profile.weightKg} kg
          </div>
          <div className="mt-0.5 truncate text-xs text-accent">{GOAL_LABELS[profile.goal]}</div>
        </div>
        <button
          onClick={() => navigate(`/setup/${activeProfileId}/edit`)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-text-muted hover:text-text"
          aria-label="Editar perfil"
        >
          <Pencil size={15} />
        </button>
      </section>

      <SettingsGroup title="Entrenamiento">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accent">
              <CalendarCheck size={16} />
            </span>
            <div>
              <div className="text-sm text-text">Objetivo semanal</div>
              <div className="text-xs text-text-muted">Días con entreno o cardio que mantienen tu racha</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                onClick={() => setWeeklyGoal(n)}
                className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                  weeklyGoal === n ? 'bg-accent text-bg' : 'bg-surface-2 text-text-muted hover:text-text'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <SettingsRow
          icon={LineChart}
          label="Registrar peso y medidas"
          detail="Ahora se hace en Progreso, junto a sus gráficas"
          onClick={() => navigate('/progress')}
        />
      </SettingsGroup>

      <SettingsGroup title="Pasos">
        <SettingsRow
          icon={Footprints}
          label="Meta diaria de pasos"
          trailing={
            <input
              type="number"
              inputMode="numeric"
              min={1000}
              step={500}
              defaultValue={stepGoal}
              key={stepGoal}
              onBlur={(e) => {
                const value = Number(e.target.value)
                if (value >= 1000) setStepGoal(value)
                else e.target.value = String(stepGoal)
              }}
              className="input w-28 text-right"
            />
          }
        />
        <SettingsDisclosure icon={Smartphone} label="Pasos desde Salud del iPhone (Atajo)">
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
        </SettingsDisclosure>
      </SettingsGroup>

      <SettingsGroup title="Inteligencia artificial (Gemini)">
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accent">
              <KeyRound size={16} />
            </span>
            <p className="text-xs leading-relaxed text-text-muted">
              Analiza comidas, actividad y entrenos. La clave se guarda solo en este dispositivo. En el plan gratuito,
              Google puede usar lo enviado para mejorar sus modelos.
            </p>
          </div>
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
        <SettingsDisclosure icon={HelpCircle} label="Cómo crear tu clave de Gemini (gratis)">
          <p>Solo necesitas una cuenta de Google. Tarda un par de minutos y no pide tarjeta.</p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5">
            <li>
              Abre{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                aistudio.google.com/apikey
              </a>{' '}
              e inicia sesión con tu cuenta de Google.
            </li>
            <li>La primera vez, acepta las condiciones de Google AI Studio.</li>
            <li>
              Pulsa <span className="text-text">Create API key</span> (Crear clave de API). Si te pregunta por un
              proyecto, elige el que te propone o crea uno nuevo.
            </li>
            <li>
              Copia la clave que aparece (es un texto largo que empieza por <span className="text-text">AQ.</span> o{' '}
              <span className="text-text">AIza</span>).
            </li>
            <li>
              Vuelve aquí, pégala en <span className="text-text">Clave</span>, deja el modelo como está y pulsa{' '}
              <span className="text-text">Guardar y probar</span>.
            </li>
          </ol>
          <p className="mt-3">
            La clave se guarda solo en este dispositivo: si usas la app en otro móvil, pégala también allí. No la
            compartas con nadie; si crees que alguien la tiene, bórrala en AI Studio y crea otra.
          </p>
        </SettingsDisclosure>
      </SettingsGroup>

      <SettingsGroup title="Datos">
        <SettingsRow icon={Download} label="Exportar mis datos" detail="Copia de seguridad en JSON" onClick={handleExport} />
        <SettingsRow
          icon={Upload}
          label="Importar copia de seguridad"
          detail="Se añade como un perfil nuevo"
          onClick={() => fileInputRef.current?.click()}
        />
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
      </SettingsGroup>

      <SettingsGroup title="App">
        <SettingsRow
          icon={RefreshCw}
          iconClassName={checkingUpdate ? 'animate-spin' : ''}
          label="Buscar actualización y recargar"
          detail={`Versión instalada: ${BUILD_TIME_LABEL}`}
          onClick={handleUpdateCheck}
          disabled={checkingUpdate}
        />
        <SettingsRow icon={Users} label="Cambiar de usuario" onClick={switchUser} />
      </SettingsGroup>

      {status && <p className="text-center text-xs text-accent">{status}</p>}
    </div>
  )
}
