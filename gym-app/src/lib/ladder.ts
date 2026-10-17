// Ladder circuit: every exercise back to back with no rest, a rest between rounds,
// and one rep fewer each round (6, 5, 4, 3, 2, 1 by default).

export const LADDER_DEFAULTS = { startReps: 6, restSeconds: 60 }
export const LADDER_REST_OPTIONS = [45, 60, 90]
export const LADDER_START_REPS_OPTIONS = [5, 6, 8]

export interface LadderStep {
  round: number // 1-based
  reps: number
  exerciseIndex: number
}

export function buildLadderPlan(exerciseCount: number, startReps: number): LadderStep[] {
  const steps: LadderStep[] = []
  for (let round = 1; round <= startReps; round++) {
    for (let exerciseIndex = 0; exerciseIndex < exerciseCount; exerciseIndex++) {
      steps.push({ round, reps: startReps - round + 1, exerciseIndex })
    }
  }
  return steps
}

export function ladderTotals(exerciseCount: number, startReps: number) {
  const repsPerExercise = (startReps * (startReps + 1)) / 2
  return { rounds: startReps, reps: repsPerExercise * exerciseCount }
}

// Rough working time per rep (incl. switching dumbbells between exercises), for the preview only.
const SECONDS_PER_REP = 3.5

export function estimateLadderMinutes(exerciseCount: number, startReps: number, restSeconds: number): number {
  const { rounds, reps } = ladderTotals(exerciseCount, startReps)
  return Math.round((reps * SECONDS_PER_REP + (rounds - 1) * restSeconds) / 60)
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export function sessionSeconds(startedAt: string, finishedAt: string): number {
  return Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000))
}
