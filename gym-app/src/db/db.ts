import Dexie, { type EntityTable } from 'dexie'
import type {
  Profile,
  BodyWeightLog,
  Exercise,
  Routine,
  RoutineExercise,
  WorkoutSession,
  SetLog,
  CardioSession,
  ExercisePhoto,
} from '../types'

export const db = new Dexie('gym-app') as Dexie & {
  profiles: EntityTable<Profile, 'id'>
  bodyWeightLogs: EntityTable<BodyWeightLog, 'id'>
  exercises: EntityTable<Exercise, 'id'>
  routines: EntityTable<Routine, 'id'>
  routineExercises: EntityTable<RoutineExercise, 'id'>
  workoutSessions: EntityTable<WorkoutSession, 'id'>
  sets: EntityTable<SetLog, 'id'>
  cardioSessions: EntityTable<CardioSession, 'id'>
  exercisePhotos: EntityTable<ExercisePhoto, 'exerciseId'>
}

db.version(1).stores({
  profiles: '++id, name',
  bodyWeightLogs: '++id, profileId, date',
  exercises: '++id, routineKey, profileScope, order',
  routines: '++id, key',
  workoutSessions: '++id, profileId, routineId, startedAt',
  sets: '++id, sessionId, profileId, exerciseId, completedAt',
})

db.version(2).stores({
  profiles: '++id, name',
  bodyWeightLogs: '++id, profileId, date',
  exercises: '++id, routineKey, profileScope, order',
  routines: '++id, key',
  workoutSessions: '++id, profileId, routineId, startedAt',
  sets: '++id, sessionId, profileId, exerciseId, completedAt',
  cardioSessions: '++id, profileId, date',
  exercisePhotos: 'exerciseId',
})

db.version(3)
  .stores({
    profiles: '++id, name',
    bodyWeightLogs: '++id, profileId, date',
    exercises: '++id, name, muscleGroup, order',
    routines: '++id, key',
    routineExercises: '++id, routineId, exerciseId, order',
    workoutSessions: '++id, profileId, routineId, startedAt',
    sets: '++id, sessionId, profileId, exerciseId, completedAt',
    cardioSessions: '++id, profileId, date',
    exercisePhotos: 'exerciseId',
  })
  .upgrade(async (tx) => {
    // Backfill the new routines<->exercises join table from the old 1:1
    // Exercise.routineKey field, so the 4 existing routines keep exactly
    // the same exercises/order they had before.
    const routines = await tx.table('routines').toArray()
    const routineByKey = new Map(routines.map((r) => [r.key, r]))
    const exercises = await tx.table('exercises').toArray()
    for (const ex of exercises as Array<{ id: number; routineKey?: string; order: number }>) {
      const routine = ex.routineKey ? routineByKey.get(ex.routineKey) : undefined
      if (routine) {
        await tx.table('routineExercises').add({
          routineId: routine.id,
          exerciseId: ex.id,
          order: ex.order,
        })
      }
    }
  })
