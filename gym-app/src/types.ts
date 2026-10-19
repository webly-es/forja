import type { MuscleGroup } from './lib/muscleGroups'
import type { MeasurementType } from './lib/measurements'
import type { MealType } from './lib/meals'

export type Sex = 'M' | 'F'

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

export type Goal = 'lose' | 'maintain' | 'gain' | 'recomp'

// How the cycle is tracked depends on contraception: only a natural cycle has phases.
// natural: no hormonal method (copper IUD included) · combined: pill, ring or patch with a pause
// progestin: mini-pill, hormonal IUD, implant, injection · none: no period · off: not tracked
export type CycleMethod = 'natural' | 'combined' | 'progestin' | 'none' | 'off'

export type PillPattern = '21-7' | '24-4' | 'continuous'

export type NoPeriodReason = 'menopause' | 'pregnancy' | 'breastfeeding' | 'other'

export interface CycleSettings {
  method: CycleMethod
  pillPattern?: PillPattern
  packStartDate?: string // local yyyy-mm-dd, first active pill of the current pack
  noPeriodReason?: NoPeriodReason
}

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
  cycle?: CycleSettings // female profiles only
}

// A period (natural cycle) or a bleed (hormonal methods). endDate stays empty while it lasts.
export interface PeriodLog {
  id?: number
  profileId: number
  startDate: string // local yyyy-mm-dd
  endDate?: string // local yyyy-mm-dd, inclusive
}

export type CheckInPain = 'none' | 'mild' | 'strong'
export type CheckInSleep = 'good' | 'ok' | 'bad'

// Optional "how do you feel today" before training, one per day.
export interface CycleCheckIn {
  id?: number
  profileId: number
  date: string // local yyyy-mm-dd
  energy: number // 1-5
  pain: CheckInPain
  sleep: CheckInSleep
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

// 'ladder': guided dumbbell circuit with descending reps (see lib/ladder.ts).
export type RoutineFormat = 'ladder'

export interface Routine {
  id?: number
  key: string
  name: string
  format?: RoutineFormat // undefined = normal routine
  profileId?: number // owner; undefined = shared by every profile
  notes?: string // why the routine is built this way (AI-generated programs)
}

export interface RoutineExercise {
  id?: number
  routineId: number
  exerciseId: number
  order: number
  // Optional prescription; empty = free logging as before.
  sets?: number
  repMin?: number
  repMax?: number
  restSeconds?: number
}

// One exercise of a routine being edited (builder, AI proposals), in routine order.
export interface RoutineItem {
  exerciseId: number
  sets?: number
  repMin?: number
  repMax?: number
  restSeconds?: number
}

export interface RoutineDraft {
  id?: number // undefined = not saved yet
  name: string
  profileId?: number
  notes?: string
  items: RoutineItem[]
}

// A routine proposed by the AI coach, with a short reason per exercise.
export interface AiRoutineItem extends RoutineItem {
  reason?: string
}

export interface AiRoutine {
  name: string
  focus: string
  items: AiRoutineItem[]
}

export interface AiProgram {
  name: string
  summary: string
  days: AiRoutine[]
}

export interface WorkoutSession {
  id?: number
  profileId: number
  routineId: number
  routineName: string
  startedAt: string // ISO datetime
  finishedAt?: string // ISO datetime
  caloriesBurned?: number
  met?: number // undefined = MET_STRENGTH_TRAINING
  ladder?: LadderSetup
}

// Settings of a ladder circuit session, chosen before starting.
export interface LadderSetup {
  dumbbellKg: number // per dumbbell
  startReps: number
  restSeconds: number
  roundsDone: number
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
  ladder?: LadderAdvice // only on ladder circuit sessions
}

export interface LadderAdvice {
  nextDumbbellKg: number
  nextRestSeconds: number
  comment: string
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

// Coach's read of the last weeks of training, kept per profile (only the latest one).
export interface TrainingReport {
  id?: number
  profileId: number
  createdAt: string
  weeks: number
  summary: string
  good: string[]
  problems: { title: string; detail: string }[]
  actions: { text: string; routineId?: number }[]
}
