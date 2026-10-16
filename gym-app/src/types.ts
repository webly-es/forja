import type { MuscleGroup } from './lib/muscleGroups'
import type { MeasurementType } from './lib/measurements'
import type { MealType } from './lib/meals'

export type Sex = 'M' | 'F'

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

export type Goal = 'lose' | 'maintain' | 'gain' | 'recomp'

export interface Profile {
  id?: number
  name: string
  sex: Sex
  heightCm: number
  weightKg: number
  birthDate: string // ISO yyyy-mm-dd
  activityLevel: ActivityLevel
  goal: Goal
  createdAt: string
}

export interface BodyWeightLog {
  id?: number
  profileId: number
  date: string // ISO yyyy-mm-dd
  weightKg: number
}

export interface BodyMeasurement {
  id?: number
  profileId: number
  date: string // ISO yyyy-mm-dd
  type: MeasurementType
  valueCm: number
}

export interface Exercise {
  id?: number
  name: string
  muscleGroup: MuscleGroup
  order: number
}

export interface Routine {
  id?: number
  key: string
  name: string
}

export interface RoutineExercise {
  id?: number
  routineId: number
  exerciseId: number
  order: number
}

export interface WorkoutSession {
  id?: number
  profileId: number
  routineId: number
  routineName: string
  startedAt: string // ISO datetime
  finishedAt?: string // ISO datetime
  caloriesBurned?: number
}

export interface SetLog {
  id?: number
  sessionId: number
  profileId: number
  exerciseId: number
  setNumber: number
  weightKg: number
  reps: number
  restSeconds: number
  completedAt: string // ISO datetime
}

export interface CardioSession {
  id?: number
  profileId: number
  activity: string
  durationMinutes: number
  met: number
  caloriesBurned: number
  date: string // ISO datetime
  createdAt: string
}

export interface ExercisePhoto {
  exerciseId: number
  blob: Blob
  updatedAt: string
  // Set only on bundled factory photos; photos the user takes have neither.
  source?: 'seed'
  seedVersion?: number
}

export interface SeedTombstone {
  key: string
}

export interface FoodItem {
  name: string
  grams: number
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface FoodEntry {
  id?: number
  profileId: number
  date: string // local yyyy-mm-dd
  loggedAt: string // ISO datetime
  meal: MealType
  name: string
  items?: FoodItem[]
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  source: 'ai' | 'manual'
  photo?: Blob // small thumbnail
}

export interface DailySteps {
  id?: number
  profileId: number
  date: string // local yyyy-mm-dd
  steps: number
}

// Per-person machine setup for an exercise (seat/lever positions differ between profiles).
// Free text because machines use numbers, letters or hole counts.
export interface MachineSetting {
  id?: number
  profileId: number
  exerciseId: number
  seat: string
  lever: string
  note: string
  updatedAt: string
}

export type ExerciseTrend = 'up' | 'flat' | 'down' | 'new'

export interface ExerciseAdvice {
  exerciseId: number
  exerciseName: string
  trend: ExerciseTrend
  comment: string
  nextWeightKg: number
  nextReps: number
}

// AI review of one finished strength session.
export interface WorkoutReview {
  sessionId: number
  profileId: number
  summary: string
  highlights: string[]
  exercises: ExerciseAdvice[]
  createdAt: string
}

// Latest AI target per person and exercise, shown on the next workout.
export interface ExerciseTarget {
  id?: number
  profileId: number
  exerciseId: number
  weightKg: number
  reps: number
  comment: string
  sessionId: number
  createdAt: string
}
