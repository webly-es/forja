import { DEFAULT_PRESCRIPTION } from './prescription'
import type { RoutineItem } from '../types'

// One concrete change the coach proposes for a routine; ids are exercise ids, position is 1-based.
export type RoutineAction =
  | { type: 'add'; newExerciseId: number; position?: number; prescription?: Prescription }
  | { type: 'remove'; exerciseId: number }
  | { type: 'replace'; exerciseId: number; newExerciseId: number; prescription?: Prescription }
  | { type: 'reorder'; exerciseId: number; position: number }
  | { type: 'prescription'; exerciseId: number; prescription: Prescription }

export type Prescription = Pick<RoutineItem, 'sets' | 'repMin' | 'repMax' | 'restSeconds'>

const insertAt = (items: RoutineItem[], item: RoutineItem, position?: number) => {
  const next = [...items]
  const index = position == null ? next.length : Math.min(next.length, Math.max(0, position - 1))
  next.splice(index, 0, item)
  return next
}

// Whether the action still makes sense on these items (it may have been applied already).
export function canApply(items: RoutineItem[], action: RoutineAction): boolean {
  const has = (id: number) => items.some((i) => i.exerciseId === id)
  switch (action.type) {
    case 'add':
      return !has(action.newExerciseId)
    case 'replace':
      return has(action.exerciseId) && !has(action.newExerciseId)
    case 'remove':
      return has(action.exerciseId)
    case 'prescription': {
      const item = items.find((i) => i.exerciseId === action.exerciseId)
      return item != null && !samePrescription(item, { ...item, ...stripUndefined(action.prescription) })
    }
    case 'reorder':
      return has(action.exerciseId) && items.findIndex((i) => i.exerciseId === action.exerciseId) !== action.position - 1
  }
}

export function applyAction(items: RoutineItem[], action: RoutineAction): RoutineItem[] {
  if (!canApply(items, action)) return items
  switch (action.type) {
    case 'add':
      return insertAt(items, { exerciseId: action.newExerciseId, ...(action.prescription ?? {}) }, action.position)
    case 'remove':
      return items.filter((i) => i.exerciseId !== action.exerciseId)
    case 'replace':
      return items.map((i) =>
        i.exerciseId === action.exerciseId
          ? { ...i, ...(action.prescription ?? {}), exerciseId: action.newExerciseId }
          : i,
      )
    case 'reorder': {
      const item = items.find((i) => i.exerciseId === action.exerciseId)!
      return insertAt(items.filter((i) => i !== item), item, action.position)
    }
    case 'prescription':
      return items.map((i) =>
        i.exerciseId === action.exerciseId
          ? { ...DEFAULT_PRESCRIPTION, ...stripUndefined(i), ...stripUndefined(action.prescription), exerciseId: i.exerciseId }
          : i,
      )
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>
}

export interface RoutineChange {
  exerciseId: number
  kind: 'added' | 'removed' | 'moved' | 'changed'
  before?: RoutineItem
  after?: RoutineItem
}

// Indexes of the longest run that keeps its relative order: those exercises didn't move,
// so one exercise moved to the top isn't reported as every other one moving down.
function longestIncreasing(values: number[]): number[] {
  const best: number[][] = []
  values.forEach((v, i) => {
    let chain: number[] = []
    for (let j = 0; j < i; j++) if (values[j] < v && best[j].length > chain.length) chain = best[j]
    best.push([...chain, i])
  })
  return best.reduce<number[]>((a, b) => (b.length > a.length ? b : a), [])
}

const samePrescription = (a: RoutineItem, b: RoutineItem) =>
  a.sets === b.sets && a.repMin === b.repMin && a.repMax === b.repMax && a.restSeconds === b.restSeconds

// What changes between two versions of a routine, in the order of the new one (removed ones last).
export function diffRoutines(before: RoutineItem[], after: RoutineItem[]): RoutineChange[] {
  const oldIndex = new Map(before.map((item, i) => [item.exerciseId, i]))
  const kept = after.filter((i) => oldIndex.has(i.exerciseId))
  const stayed = longestIncreasing(kept.map((i) => oldIndex.get(i.exerciseId)!)).map((k) => kept[k])
  const changes: RoutineChange[] = []
  for (const item of after) {
    const prev = oldIndex.has(item.exerciseId) ? before[oldIndex.get(item.exerciseId)!] : undefined
    if (!prev) changes.push({ exerciseId: item.exerciseId, kind: 'added', after: item })
    else if (!stayed.includes(item))
      changes.push({ exerciseId: item.exerciseId, kind: 'moved', before: prev, after: item })
    else if (!samePrescription(prev, item)) changes.push({ exerciseId: item.exerciseId, kind: 'changed', before: prev, after: item })
  }
  const newIds = new Set(after.map((i) => i.exerciseId))
  for (const item of before) {
    if (!newIds.has(item.exerciseId)) changes.push({ exerciseId: item.exerciseId, kind: 'removed', before: item })
  }
  return changes
}

// Identifies a version of a routine: same exercises, order and prescription give the same string.
export function routineFingerprint(items: RoutineItem[]): string {
  return items.map((i) => `${i.exerciseId}:${i.sets ?? ''}x${i.repMin ?? ''}-${i.repMax ?? ''}/${i.restSeconds ?? ''}`).join('|')
}
