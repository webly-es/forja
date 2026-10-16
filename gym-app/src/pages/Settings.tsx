import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { GOAL_LABELS, getAge } from '../lib/metrics'
import { SettingsGroup, SettingsRow } from '../components/settings/SettingsParts'
import { WeeklyGoalSheet } from '../components/settings/WeeklyGoalSheet'
import { StepGoalSheet } from '../components/settings/StepGoalSheet'
import { GeminiSheet } from '../components/settings/GeminiSheet'
import { BackupSheet } from '../components/settings/BackupSheet'
import { Pencil, Users, RefreshCw, KeyRound, Footprints, CalendarCheck, DatabaseBackup } from 'lucide-react'

const BUILD_TIME_LABEL = new Date(__APP_BUILD_TIME__).toLocaleString('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

type Sheet = 'weekly' | 'steps' | 'gemini' | 'backup'

export function Settings() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const setActiveProfileId = useAppStore((s) => s.setActiveProfileId)
  const navigate = useNavigate()

  const profile = useLiveQuery(() => db.profiles.get(activeProfileId), [activeProfileId])
  const [openSheet, setOpenSheet] = useState<Sheet | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  const geminiApiKey = useAppStore((s) => s.geminiApiKey)
  const stepGoal = useAppStore((s) => s.stepGoal)
  const weeklyGoal = useAppStore((s) => s.weeklyGoal)

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

  const closeSheet = () => setOpenSheet(null)

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

      <SettingsGroup title="Objetivos">
        <SettingsRow
          icon={CalendarCheck}
          label="Objetivo semanal"
          value={`${weeklyGoal} ${weeklyGoal === 1 ? 'día' : 'días'}`}
          onClick={() => setOpenSheet('weekly')}
        />
        <SettingsRow
          icon={Footprints}
          label="Meta de pasos"
          value={stepGoal.toLocaleString('es')}
          onClick={() => setOpenSheet('steps')}
        />
      </SettingsGroup>

      <SettingsGroup title="Inteligencia artificial">
        <SettingsRow
          icon={KeyRound}
          label="Gemini"
          value={
            geminiApiKey ? (
              'Configurada'
            ) : (
              <span className="text-text-muted">Sin configurar</span>
            )
          }
          onClick={() => setOpenSheet('gemini')}
        />
      </SettingsGroup>

      <SettingsGroup title="Datos y app">
        <SettingsRow icon={DatabaseBackup} label="Copia de seguridad" onClick={() => setOpenSheet('backup')} />
        <SettingsRow
          icon={RefreshCw}
          iconClassName={checkingUpdate ? 'animate-spin' : ''}
          label="Buscar actualización"
          detail={`Versión instalada: ${BUILD_TIME_LABEL}`}
          onClick={handleUpdateCheck}
          disabled={checkingUpdate}
        />
        <SettingsRow icon={Users} label="Cambiar de usuario" onClick={switchUser} />
      </SettingsGroup>

      {openSheet === 'weekly' && <WeeklyGoalSheet onClose={closeSheet} />}
      {openSheet === 'steps' && <StepGoalSheet onClose={closeSheet} />}
      {openSheet === 'gemini' && <GeminiSheet onClose={closeSheet} />}
      {openSheet === 'backup' && <BackupSheet profileId={activeProfileId} onClose={closeSheet} />}
    </div>
  )
}
