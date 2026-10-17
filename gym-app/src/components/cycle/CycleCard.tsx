import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Droplet, HeartPulse, Settings2 } from 'lucide-react'
import { db } from '../../db/db'
import { getCheckIn, getPeriodLogs, logPeriodEnd, logPeriodStart, saveCycleSettings, setPackStart } from '../../db/cycle'
import {
  NO_PERIOD_LABELS,
  PHASE_LABELS,
  activePeriod,
  describeCheckIn,
  expectsWaterRetention,
  getCycleStatus,
  type CycleStatus,
} from '../../lib/cycle'
import { todayKey } from '../../lib/dates'
import { CheckInSheet } from './CheckInSheet'

function daysLabel(n: number) {
  return n === 1 ? '1 día' : `${n} días`
}

function inDays(n: number) {
  return n === 1 ? 'mañana' : `en ${n} días`
}

function naturalSubtitle(s: Extract<CycleStatus, { method: 'natural'; hasData: true }>): string {
  if (s.onPeriod) return 'Regla en curso'
  if (s.nextPeriodInDays > 0) return `Próxima regla en ~${daysLabel(s.nextPeriodInDays)}`
  if (s.nextPeriodInDays === 0) return 'Regla prevista para hoy'
  return `Retraso de ${daysLabel(-s.nextPeriodInDays)}`
}

// Where in a natural cycle today falls, as a thin bar with the phases tinted.
function CycleBar({ day, length }: { day: number; length: number }) {
  const ovulation = length - 14
  const pct = (n: number) => `${Math.min(100, (n / length) * 100)}%`
  return (
    <div className="relative mt-3 h-1.5 rounded-full bg-white/[0.06]">
      <div className="absolute inset-y-0 left-0 rounded-full bg-accent/70" style={{ width: pct(5) }} />
      <div
        className="absolute inset-y-0 rounded-full bg-accent/40"
        style={{ left: pct(ovulation - 2), width: pct(3) }}
      />
      <div
        className="absolute -top-1 h-3.5 w-1 -translate-x-1/2 rounded-full bg-text shadow-[0_0_8px_rgba(255,255,255,0.4)]"
        style={{ left: pct(Math.min(day, length) - 0.5) }}
      />
    </div>
  )
}

const ACTION = 'rounded-lg border border-accent/50 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/10'

// Home card for female profiles that track their cycle. Hidden when the feature is off.
export function CycleCard({ profileId }: { profileId: number }) {
  const navigate = useNavigate()
  const today = todayKey()
  const [checkInOpen, setCheckInOpen] = useState(false)

  const data = useLiveQuery(async () => {
    const [profile, logs, checkIn] = await Promise.all([
      db.profiles.get(profileId),
      getPeriodLogs(profileId),
      getCheckIn(profileId, today),
    ])
    if (!profile || profile.sex !== 'F') return null
    if (!profile.cycle) return { invite: true as const }
    return { invite: false as const, status: getCycleStatus(profile.cycle, logs, today), openLog: activePeriod(logs, today), checkIn }
  }, [profileId, today])

  if (!data) return null
  if (data.invite) {
    return (
      <div className="card-forged p-4">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-text-muted">
          <Droplet size={13} className="text-accent" />
          Ciclo
        </div>
        <p className="mt-2 text-sm text-text">¿Quieres que la app tenga en cuenta tu ciclo?</p>
        <p className="mt-1 text-xs text-text-muted">
          El entrenador adapta sus consejos a tu fase o a tu anticonceptivo. Los datos se quedan en este dispositivo.
        </p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => navigate('/settings?sheet=cycle')} className={ACTION}>
            Configurar
          </button>
          <button
            onClick={() => void saveCycleSettings(profileId, { method: 'off' })}
            className="rounded-lg px-3 py-2 text-xs text-text-muted transition-colors hover:text-text"
          >
            No, gracias
          </button>
        </div>
      </div>
    )
  }
  if (!data.status) return null
  const { status, openLog, checkIn } = data
  const bleedingOpen = openLog && !openLog.endDate ? openLog : undefined

  let label = 'Ciclo'
  let title: string
  let subtitle: string | null = null
  let action: { text: string; run: () => Promise<unknown> } | null = null

  switch (status.method) {
    case 'natural':
      if (!status.hasData) {
        title = 'Empieza tu registro'
        subtitle = 'Marca el primer día de tu regla y la app irá aprendiendo tu ciclo.'
        action = { text: 'Me ha bajado la regla hoy', run: () => logPeriodStart(profileId, today) }
      } else {
        label = `Día ${status.day} del ciclo`
        title = PHASE_LABELS[status.phase]
        subtitle = naturalSubtitle(status) + (status.estimated ? ' · estimación hasta tener 2 ciclos' : '')
        action = bleedingOpen
          ? { text: 'Ha terminado la regla', run: () => logPeriodEnd(bleedingOpen.id!, today) }
          : status.onPeriod
            ? null
            : { text: 'Me ha bajado la regla', run: () => logPeriodStart(profileId, today) }
      }
      break
    case 'combined':
      label = 'Anticonceptivo'
      if (!status.hasData) {
        title = 'Marca tu blíster'
        subtitle = 'Indica el día en que empezaste el blíster actual. Si no fue hoy, cámbialo en Ajustes.'
        action = { text: 'Lo he empezado hoy', run: () => setPackStart(profileId, today) }
      } else if (status.inPause) {
        title = `Descanso · día ${status.packDay - status.activeDays} de ${status.packLength - status.activeDays}`
        subtitle = `Blíster nuevo ${inDays(status.daysLeft)}`
        if (status.daysLeft <= 1) action = { text: 'He empezado el blíster nuevo', run: () => setPackStart(profileId, today) }
      } else {
        title = `Día ${status.packDay} de ${status.activeDays}`
        subtitle =
          status.packLength === status.activeDays
            ? 'Toma continua, sin fases naturales'
            : `Toma activa · descanso ${inDays(status.daysLeft)}`
      }
      break
    case 'progestin':
      label = 'Anticonceptivo'
      title = status.bleeding ? 'Sangrado en curso' : 'Sin sangrado'
      subtitle = 'Con este método no hay fases; registra los sangrados si los tienes.'
      action = bleedingOpen
        ? { text: 'Ha terminado', run: () => logPeriodEnd(bleedingOpen.id!, today) }
        : status.bleeding
          ? null
          : { text: 'Tengo sangrado hoy', run: () => logPeriodStart(profileId, today) }
      break
    case 'none':
      title = NO_PERIOD_LABELS[status.reason]
      subtitle =
        status.reason === 'pregnancy'
          ? 'Sigue siempre las indicaciones de tu profesional sanitario sobre el ejercicio.'
          : 'El chequeo diario ayuda al entrenador a ajustar tu sesión.'
      break
  }

  return (
    <div className="card-forged p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-text-muted">
            <Droplet size={13} className="text-accent" />
            {label}
          </div>
          <div className="mt-1 font-display text-2xl font-medium uppercase tracking-wide text-text">{title}</div>
          {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
        </div>
        <button
          onClick={() => navigate('/settings?sheet=cycle')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-text-muted hover:text-text"
          aria-label="Ajustes del ciclo"
        >
          <Settings2 size={14} />
        </button>
      </div>

      {status.method === 'natural' && status.hasData && <CycleBar day={status.day} length={status.cycleLength} />}

      {expectsWaterRetention(status) && (
        <p className="mt-3 text-xs text-text-muted">
          Estos días es normal que el peso suba algo por retención de líquidos; no es grasa.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {action && (
          <button onClick={() => void action.run()} className={ACTION}>
            {action.text}
          </button>
        )}
        <button
          onClick={() => setCheckInOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-1 py-2 text-left text-xs text-text-muted transition-colors hover:text-text"
        >
          <HeartPulse size={14} className="shrink-0 text-accent" />
          {checkIn ? describeCheckIn(checkIn) : '¿Cómo te sientes hoy?'}
        </button>
      </div>

      {checkInOpen && <CheckInSheet profileId={profileId} date={today} onClose={() => setCheckInOpen(false)} />}
    </div>
  )
}
