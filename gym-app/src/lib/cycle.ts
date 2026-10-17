import type { CheckInPain, CheckInSleep, CycleCheckIn, CycleMethod, CycleSettings, NoPeriodReason, PeriodLog, PillPattern } from '../types'
import { shiftDateKey } from './dates'

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal'

export const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'Menstruación',
  follicular: 'Fase folicular',
  ovulation: 'Ovulación',
  luteal: 'Fase lútea',
}

export const PILL_PATTERNS: Record<PillPattern, { active: number; pause: number; label: string }> = {
  '21-7': { active: 21, pause: 7, label: '21 + 7 de descanso' },
  '24-4': { active: 24, pause: 4, label: '24 + 4 de descanso' },
  continuous: { active: 28, pause: 0, label: 'Continua, sin descanso' },
}

export const NO_PERIOD_LABELS: Record<NoPeriodReason, string> = {
  menopause: 'Menopausia',
  pregnancy: 'Embarazo',
  breastfeeding: 'Lactancia',
  other: 'Otro motivo',
}

export const CHECK_IN_PAIN_LABELS: Record<CheckInPain, string> = {
  none: 'Ninguno',
  mild: 'Leve',
  strong: 'Fuerte',
}

export const CHECK_IN_SLEEP_LABELS: Record<CheckInSleep, string> = {
  good: 'Bien',
  ok: 'Regular',
  bad: 'Mal',
}

export const CYCLE_METHOD_LABELS: Record<CycleMethod, { label: string; detail: string }> = {
  natural: { label: 'Ciclo natural', detail: 'Sin anticonceptivos hormonales (también DIU de cobre)' },
  combined: { label: 'Píldora, anillo o parche', detail: 'Anticonceptivo combinado con o sin semana de descanso' },
  progestin: { label: 'Solo progestágeno', detail: 'Minipíldora, DIU hormonal, implante o inyección' },
  none: { label: 'Sin regla', detail: 'Menopausia, embarazo, lactancia u otro motivo' },
  off: { label: 'No usar', detail: 'La función queda oculta' },
}

export function describeCheckIn(c: CycleCheckIn): string {
  return `Energía ${c.energy}/5 · dolor ${CHECK_IN_PAIN_LABELS[c.pain].toLowerCase()} · sueño ${CHECK_IN_SLEEP_LABELS[c.sleep].toLowerCase()}`
}

export const DEFAULT_CYCLE_LENGTH = 28
const DEFAULT_PERIOD_LENGTH = 5
const MIN_CYCLE = 18
const MAX_CYCLE = 60
const CYCLES_FOR_AVERAGE = 6
const LUTEAL_LENGTH = 14 // the luteal phase is far more stable than the follicular one
const LATE_LUTEAL_DAYS = 5
// An open period older than this was most likely never closed.
const MAX_OPEN_PERIOD = 10

export type CycleStatus =
  | { method: 'natural'; hasData: false }
  | {
      method: 'natural'
      hasData: true
      day: number // 1 = first day of the last period
      phase: CyclePhase
      lateLuteal: boolean // last days before the period, when symptoms and water retention peak
      onPeriod: boolean
      cycleLength: number
      estimated: boolean // fewer than 2 complete cycles logged, length is a guess
      nextPeriodInDays: number // negative when late
    }
  | { method: 'combined'; hasData: false; pattern: PillPattern }
  | {
      method: 'combined'
      hasData: true
      pattern: PillPattern
      packDay: number // 1-based day of the current pack
      activeDays: number
      packLength: number
      inPause: boolean
      daysLeft: number // days left in the current stretch (active or pause), today included
    }
  | { method: 'progestin'; bleeding: boolean; lastBleedStart?: string }
  | { method: 'none'; reason: NoPeriodReason }

function parseKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

// Whole days from a to b (b - a), immune to DST because both are UTC midnights.
export function daysBetween(a: string, b: string): number {
  return Math.round((parseKey(b) - parseKey(a)) / 86_400_000)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

// Lengths between consecutive period starts, dropping gaps that can't be one cycle (a missed log).
export function cycleLengths(starts: string[]): number[] {
  const sorted = [...new Set(starts)].sort()
  const lengths: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const length = daysBetween(sorted[i - 1], sorted[i])
    if (length >= MIN_CYCLE && length <= MAX_CYCLE) lengths.push(length)
  }
  return lengths
}

// Median of the last cycles: one odd month shouldn't move the prediction much.
export function averageCycleLength(starts: string[]): { length: number; estimated: boolean } {
  const lengths = cycleLengths(starts).slice(-CYCLES_FOR_AVERAGE)
  if (lengths.length === 0) return { length: DEFAULT_CYCLE_LENGTH, estimated: true }
  return { length: median(lengths), estimated: lengths.length < 2 }
}

function averagePeriodLength(logs: PeriodLog[]): number {
  const lengths = logs
    .filter((l) => l.endDate)
    .map((l) => daysBetween(l.startDate, l.endDate!) + 1)
    .filter((n) => n >= 1 && n <= MAX_OPEN_PERIOD)
  return lengths.length ? median(lengths.slice(-CYCLES_FOR_AVERAGE)) : DEFAULT_PERIOD_LENGTH
}

// The log covering the date, if any: closed periods up to their end, open ones up to MAX_OPEN_PERIOD days.
export function activePeriod(logs: PeriodLog[], date: string): PeriodLog | undefined {
  return logs.find((l) => {
    if (l.startDate > date) return false
    if (l.endDate) return date <= l.endDate
    return daysBetween(l.startDate, date) < MAX_OPEN_PERIOD
  })
}

function naturalStatus(logs: PeriodLog[], date: string): CycleStatus {
  const past = logs.filter((l) => l.startDate <= date).sort((a, b) => a.startDate.localeCompare(b.startDate))
  const last = past[past.length - 1]
  if (!last) return { method: 'natural', hasData: false }

  const day = daysBetween(last.startDate, date) + 1
  // Too long ago to be the current cycle: some periods were not logged.
  if (day > MAX_CYCLE) return { method: 'natural', hasData: false }
  const { length, estimated } = averageCycleLength(past.map((l) => l.startDate))
  const onPeriod = last.endDate ? date <= last.endDate : day <= Math.min(averagePeriodLength(past), MAX_OPEN_PERIOD)
  const ovulationDay = length - LUTEAL_LENGTH
  const phase: CyclePhase = onPeriod
    ? 'menstrual'
    : day < ovulationDay - 1
      ? 'follicular'
      : day <= ovulationDay + 1
        ? 'ovulation'
        : 'luteal'

  return {
    method: 'natural',
    hasData: true,
    day,
    phase,
    lateLuteal: phase === 'luteal' && day > length - LATE_LUTEAL_DAYS,
    onPeriod,
    cycleLength: length,
    estimated,
    nextPeriodInDays: length - day + 1,
  }
}

// Packs run back to back on schedule; starting a new pack early or late just resets the start date.
function combinedStatus(settings: CycleSettings, date: string): CycleStatus {
  const pattern = settings.pillPattern ?? '21-7'
  const start = settings.packStartDate
  if (!start || start > date) return { method: 'combined', hasData: false, pattern }

  const { active, pause } = PILL_PATTERNS[pattern]
  const packLength = active + pause
  const packDay = (daysBetween(start, date) % packLength) + 1
  const inPause = packDay > active
  return {
    method: 'combined',
    hasData: true,
    pattern,
    packDay,
    activeDays: active,
    packLength,
    inPause,
    daysLeft: (inPause ? packLength : active) - packDay + 1,
  }
}

export function getCycleStatus(settings: CycleSettings | undefined, logs: PeriodLog[], date: string): CycleStatus | null {
  switch (settings?.method) {
    case 'natural':
      return naturalStatus(logs, date)
    case 'combined':
      return combinedStatus(settings, date)
    case 'progestin': {
      const last = logs.filter((l) => l.startDate <= date).sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
      return { method: 'progestin', bleeding: !!activePeriod(logs, date), lastBleedStart: last?.startDate }
    }
    case 'none':
      return { method: 'none', reason: settings.noPeriodReason ?? 'other' }
    default:
      return null
  }
}

// Days when a higher reading on the scale is usually water, not fat.
export function expectsWaterRetention(status: CycleStatus | null): boolean {
  if (!status) return false
  if (status.method === 'natural') return status.hasData && (status.lateLuteal || (status.onPeriod && status.day <= 2))
  if (status.method === 'combined') return status.hasData && status.inPause
  return false
}

// Next expected period start for natural cycles, as a date key.
export function nextPeriodDate(status: CycleStatus, date: string): string | null {
  if (status.method !== 'natural' || !status.hasData) return null
  return shiftDateKey(date, status.nextPeriodInDays)
}
