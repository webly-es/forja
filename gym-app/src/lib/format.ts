// "14 oct" from a yyyy-mm-dd key or an ISO datetime, in local time.
export function shortDate(date: string, withYear = false): string {
  const d = date.length === 10 ? new Date(`${date}T00:00:00`) : new Date(date)
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
}

export const fmtNumber = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })
