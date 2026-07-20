import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { exportProfileData, importProfileData } from '../lib/exportImport'
import { Pencil, Download, Upload, Users, RefreshCw } from 'lucide-react'

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
  const [status, setStatus] = useState<string | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  async function logTodayWeight() {
    const weightKg = Number(todayWeight)
    if (!weightKg || weightKg <= 0) return
    const today = new Date().toISOString().slice(0, 10)
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
      await reg?.update()
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
        <h2 className="mb-2 text-xs uppercase tracking-wide text-text-muted">Registrar peso de hoy</h2>
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

      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wide text-text-muted">Datos</h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left text-sm text-text hover:border-accent"
        >
          <Download size={18} className="text-text-muted" />
          Exportar mis datos (backup JSON)
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left text-sm text-text hover:border-accent"
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
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left text-sm text-text hover:border-accent disabled:opacity-60"
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
        className="flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm text-text-muted hover:text-text"
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
