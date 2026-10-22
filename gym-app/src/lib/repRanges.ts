import type { Goal } from '../types'

// Double-progression rep range per goal; used when a routine doesn't prescribe its own.
export const REP_RANGES: Record<Goal, { min: number; max: number }> = {
  gain: { min: 6, max: 12 },
  recomp: { min: 8, max: 12 },
  maintain: { min: 8, max: 12 },
  lose: { min: 6, max: 10 },
}
