import { db } from './db'
import { getTrainingContext } from './routineContext'
import { getRoutineDraft, getRoutineDraftsForProfile, getRoutinesForProfile, saveRoutine } from './routines'
import { applyAction, canApply, routineFingerprint, type RoutineAction } from '../lib/routineDiff'
import { skipPatterns } from '../lib/skipPatterns'
import type { WeekReviewData } from '../lib/ai/weekReview'

const MAX_APPLIED = 8 // same as the routine analysis sheet

export async function getWeekReviewData(profileId: number, weeklyGoal: number): Promise<WeekReviewData | undefined> {
  const [ctx, routines, drafts] = await Promise.all([
    getTrainingContext(profileId),
    getRoutinesForProfile(profileId),
    getRoutineDraftsForProfile(profileId),
  ])
  if (!ctx) return undefined
  const ladder = new Set(routines.filter((r) => r.format === 'ladder').map((r) => r.id!))
  const normal = drafts.filter((d) => !ladder.has(d.id!) && d.items.length > 0)
  return { ctx, weeklyGoal, routines: normal, skips: skipPatterns(ctx.sessions, ctx.sets, normal) }
}

// Applies one suggestion of the weekly review straight to its routine and records it in the
// routine's review, so analysing that routine later doesn't undo it. False if it no longer applies.
export async function applyWeekSuggestion(routineId: number, action: RoutineAction, title: string, verdict: string): Promise<boolean> {
  return db.transaction('rw', [db.routines, db.routineExercises, db.exercises, db.seedTombstones], async () => {
    const draft = await getRoutineDraft(routineId)
    if (!draft || !canApply(draft.items, action)) return false
    const items = applyAction(draft.items, action)
    const previous = draft.aiReview
    await saveRoutine({
      ...draft,
      items,
      aiReview: {
        fingerprint: routineFingerprint(items),
        by: previous?.by ?? 'analysis',
        at: new Date().toISOString(),
        verdict: previous?.verdict ?? verdict,
        strengths: previous?.strengths ?? [],
        suggestions: [],
        applied: [...(previous?.applied ?? []), title].slice(-MAX_APPLIED),
      },
    })
    return true
  })
}
