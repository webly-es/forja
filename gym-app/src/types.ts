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

export interface Exercise {
  id?: number
  name: string
  muscleGroup: string
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
}
