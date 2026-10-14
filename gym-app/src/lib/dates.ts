// Local-time date keys (yyyy-mm-dd). toISOString() would give the UTC date,
// which in Spain rolls back to "yesterday" between 00:00 and 01:00/02:00.
export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return toDateKey(new Date(y, m - 1, d + days))
}

export function formatDateKey(dateKey: string): string {
  const today = todayKey()
  if (dateKey === today) return 'Hoy'
  if (dateKey === shiftDateKey(today, -1)) return 'Ayer'
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
}
