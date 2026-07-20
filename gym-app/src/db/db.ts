import Dexie, { type EntityTable } from 'dexie'
import type { Profile, BodyWeightLog, Exercise, Routine, WorkoutSession, SetLog } from '../types'

export const db = new Dexie('gym-app') as Dexie & {
  profiles: EntityTable<Profile, 'id'>
  bodyWeightLogs: EntityTable<BodyWeightLog, 'id'>
  exercises: EntityTable<Exercise, 'id'>
  routines: EntityTable<Routine, 'id'>
  workoutSessions: EntityTable<WorkoutSession, 'id'>
  sets: EntityTable<SetLog, 'id'>
}

db.version(1).stores({
  profiles: '++id, name',
  bodyWeightLogs: '++id, profileId, date',
  exercises: '++id, routineKey, profileScope, order',
  routines: '++id, key',
  workoutSessions: '++id, profileId, routineId, startedAt',
  sets: '++id, sessionId, profileId, exerciseId, completedAt',
})
