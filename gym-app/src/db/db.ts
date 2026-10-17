import Dexie, { type EntityTable } from 'dexie'
import type {
  Profile,
  BodyWeightLog,
  BodyMeasurement,
  Exercise,
  Routine,
  RoutineExercise,
  WorkoutSession,
  SetLog,
  CardioSession,
  ExercisePhoto,
  SeedTombstone,
  FoodEntry,
  DailySteps,
  MachineSetting,
  WorkoutReview,
  ExerciseTarget,
  PeriodLog,
  CycleCheckIn,
} from '../types'

export const db = new Dexie('gym-app') as Dexie & {
  profiles: EntityTable<Profile, 'id'>
  bodyWeightLogs: EntityTable<BodyWeightLog, 'id'>
  bodyMeasurements: EntityTable<BodyMeasurement, 'id'>
  exercises: EntityTable<Exercise, 'id'>
  routines: EntityTable<Routine, 'id'>
  routineExercises: EntityTable<RoutineExercise, 'id'>
  workoutSessions: EntityTable<WorkoutSession, 'id'>
  sets: EntityTable<SetLog, 'id'>
  cardioSessions: EntityTable<CardioSession, 'id'>
  exercisePhotos: EntityTable<ExercisePhoto, 'exerciseId'>
  seedTombstones: EntityTable<SeedTombstone, 'key'>
  foodEntries: EntityTable<FoodEntry, 'id'>
  dailySteps: EntityTable<DailySteps, 'id'>
  machineSettings: EntityTable<MachineSetting, 'id'>
  workoutReviews: EntityTable<WorkoutReview, 'sessionId'>
  exerciseTargets: EntityTable<ExerciseTarget, 'id'>
  periodLogs: EntityTable<PeriodLog, 'id'>
  cycleCheckIns: EntityTable<CycleCheckIn, 'id'>
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

db.version(4).stores({
  profiles: '++id, name',
  bodyWeightLogs: '++id, profileId, date',
  exercises: '++id, name, muscleGroup, order',
  routines: '++id, key',
  routineExercises: '++id, routineId, exerciseId, order',
  workoutSessions: '++id, profileId, routineId, startedAt',
  sets: '++id, sessionId, profileId, exerciseId, completedAt',
  cardioSessions: '++id, profileId, date',
  exercisePhotos: 'exerciseId',
  // Tracks user-deleted seed entities (routines, exercises, and
  // routine<->exercise links from the hardcoded seed data) so
  // ensureExercisesSeeded/ensureFemaleRoutinesSeeded never resurrect them
  // on the next app start. See db/seedTombstones.ts for key format.
  seedTombstones: 'key',
})

db.version(5).stores({
  profiles: '++id, name',
  bodyWeightLogs: '++id, profileId, date',
  bodyMeasurements: '++id, profileId, date, type',
  exercises: '++id, name, muscleGroup, order',
  routines: '++id, key',
  routineExercises: '++id, routineId, exerciseId, order',
  workoutSessions: '++id, profileId, routineId, startedAt',
  sets: '++id, sessionId, profileId, exerciseId, completedAt',
  cardioSessions: '++id, profileId, date',
  exercisePhotos: 'exerciseId',
  seedTombstones: 'key',
})

db.version(6).stores({
  profiles: '++id, name',
  bodyWeightLogs: '++id, profileId, date',
  bodyMeasurements: '++id, profileId, date, type',
  exercises: '++id, name, muscleGroup, order',
  routines: '++id, key',
  routineExercises: '++id, routineId, exerciseId, order',
  workoutSessions: '++id, profileId, routineId, startedAt',
  sets: '++id, sessionId, profileId, exerciseId, completedAt',
  cardioSessions: '++id, profileId, date',
  exercisePhotos: 'exerciseId',
  seedTombstones: 'key',
  foodEntries: '++id, profileId, date',
  dailySteps: '++id, profileId, date',
})

db.version(7).stores({
  profiles: '++id, name',
  bodyWeightLogs: '++id, profileId, date',
  bodyMeasurements: '++id, profileId, date, type',
  exercises: '++id, name, muscleGroup, order',
  routines: '++id, key',
  routineExercises: '++id, routineId, exerciseId, order',
  workoutSessions: '++id, profileId, routineId, startedAt',
  sets: '++id, sessionId, profileId, exerciseId, completedAt',
  cardioSessions: '++id, profileId, date',
  exercisePhotos: 'exerciseId',
  seedTombstones: 'key',
  foodEntries: '++id, profileId, date',
  dailySteps: '++id, profileId, date',
  machineSettings: '++id, &[profileId+exerciseId], profileId, exerciseId',
})

db.version(8).stores({
  profiles: '++id, name',
  bodyWeightLogs: '++id, profileId, date',
  bodyMeasurements: '++id, profileId, date, type',
  exercises: '++id, name, muscleGroup, order',
  routines: '++id, key',
  routineExercises: '++id, routineId, exerciseId, order',
  workoutSessions: '++id, profileId, routineId, startedAt',
  sets: '++id, sessionId, profileId, exerciseId, completedAt',
  cardioSessions: '++id, profileId, date',
  exercisePhotos: 'exerciseId',
  seedTombstones: 'key',
  foodEntries: '++id, profileId, date',
  dailySteps: '++id, profileId, date',
  machineSettings: '++id, &[profileId+exerciseId], profileId, exerciseId',
  workoutReviews: 'sessionId, profileId',
  exerciseTargets: '++id, &[profileId+exerciseId], profileId, exerciseId',
})

db.version(9).stores({
  profiles: '++id, name',
  bodyWeightLogs: '++id, profileId, date',
  bodyMeasurements: '++id, profileId, date, type',
  exercises: '++id, name, muscleGroup, order',
  routines: '++id, key',
  routineExercises: '++id, routineId, exerciseId, order',
  workoutSessions: '++id, profileId, routineId, startedAt',
  sets: '++id, sessionId, profileId, exerciseId, completedAt',
  cardioSessions: '++id, profileId, date',
  exercisePhotos: 'exerciseId',
  seedTombstones: 'key',
  foodEntries: '++id, profileId, date',
  dailySteps: '++id, profileId, date',
  machineSettings: '++id, &[profileId+exerciseId], profileId, exerciseId',
  workoutReviews: 'sessionId, profileId',
  exerciseTargets: '++id, &[profileId+exerciseId], profileId, exerciseId',
  periodLogs: '++id, profileId, startDate',
  cycleCheckIns: '++id, &[profileId+date], profileId',
})
