import { db } from './db'

interface SeedExercise {
  name: string
  muscleGroup: string
}

const ROUTINES: { key: string; name: string; exercises: SeedExercise[] }[] = [
  {
    key: 'chest-tri-shoulders',
    name: 'Pecho - Tríceps - Hombros',
    exercises: [
      { name: 'Press banca sentado empujando hacia delante', muscleGroup: 'Pecho' },
      { name: 'Press banca inclinado con mancuerna', muscleGroup: 'Pecho' },
      { name: 'Press banca inclinado en máquina', muscleGroup: 'Pecho' },
      { name: 'Aperturas de pecho en máquina (Pec-Deck)', muscleGroup: 'Pecho' },
      { name: 'Press de pecho en máquina vertical', muscleGroup: 'Pecho' },
      { name: 'Press de hombro en máquina', muscleGroup: 'Hombro' },
      { name: 'Press de hombro en máquina con algo de inclinación', muscleGroup: 'Hombro' },
      { name: 'Elevaciones laterales con mancuerna', muscleGroup: 'Hombro' },
      { name: 'Jalón de tríceps hacia abajo con cuerdas', muscleGroup: 'Tríceps' },
      { name: 'Jalón de tríceps con una sola mano', muscleGroup: 'Tríceps' },
      { name: 'Paralelas en máquina para tríceps', muscleGroup: 'Tríceps' },
    ],
  },
  {
    key: 'back-biceps',
    name: 'Espalda - Bíceps',
    exercises: [
      { name: 'Máquina de espalda jalando abajo, agarre ancho', muscleGroup: 'Espalda' },
      { name: 'Máquina de espalda jalando abajo, agarre para dorsales', muscleGroup: 'Espalda' },
      { name: 'Máquina de espalda jalando de frente hacia la espalda', muscleGroup: 'Espalda' },
      {
        name: 'Máquina de espalda jalando desde arriba (dorsales y espalda media)',
        muscleGroup: 'Espalda',
      },
      { name: 'Elevación de mancuernas para bíceps', muscleGroup: 'Bíceps' },
      { name: 'Elevación de mancuernas martillo para bíceps', muscleGroup: 'Bíceps' },
      { name: 'Predicador para bíceps en máquina', muscleGroup: 'Bíceps' },
    ],
  },
  {
    key: 'legs',
    name: 'Pierna',
    exercises: [
      { name: 'Prensa', muscleGroup: 'Pierna' },
      { name: 'Sentadillas', muscleGroup: 'Pierna' },
      { name: 'Extensión de cuádriceps sentado en máquina', muscleGroup: 'Cuádriceps' },
      { name: 'Curl femoral sentado en máquina', muscleGroup: 'Isquiotibiales' },
      { name: 'Aductores cerrando', muscleGroup: 'Aductores' },
      { name: 'Aductores abriendo', muscleGroup: 'Abductores' },
      { name: 'Extensión de cuádriceps en máquina', muscleGroup: 'Cuádriceps' },
      { name: 'Empuje de cadera en máquina (Puente de glúteos)', muscleGroup: 'Glúteo' },
      { name: 'Patada de glúteo en máquina', muscleGroup: 'Glúteo' },
      { name: 'Elevación de talones en máquina de sentadillas (Power Squat)', muscleGroup: 'Gemelos' },
      { name: 'Elevación de talones en máquina de prensa (Leg Press)', muscleGroup: 'Gemelos' },
    ],
  },
  {
    key: 'arms',
    name: 'Brazos',
    exercises: [
      { name: 'Press de hombro en máquina', muscleGroup: 'Hombro' },
      { name: 'Press de hombro en máquina con algo de inclinación', muscleGroup: 'Hombro' },
      { name: 'Elevaciones laterales con mancuerna', muscleGroup: 'Hombro' },
      { name: 'Jalón de tríceps hacia abajo con cuerdas', muscleGroup: 'Tríceps' },
      { name: 'Jalón de tríceps con una sola mano', muscleGroup: 'Tríceps' },
      { name: 'Paralelas en máquina para tríceps', muscleGroup: 'Tríceps' },
      { name: 'Elevación de mancuernas para bíceps', muscleGroup: 'Bíceps' },
      { name: 'Elevación de mancuernas martillo para bíceps', muscleGroup: 'Bíceps' },
      { name: 'Predicador para bíceps en máquina', muscleGroup: 'Bíceps' },
    ],
  },
]

// Default 3-day/week split auto-created for new female profiles: glute/leg
// frequency twice a week (day 1 + day 3 finisher) plus one push and one pull
// day for full upper-body coverage, built entirely from exercises already
// in ROUTINES above.
const FEMALE_ROUTINES: { key: string; name: string; exerciseNames: string[] }[] = [
  {
    key: 'female-day1-glutes-legs',
    name: 'Día 1 - Glúteo y Pierna',
    exerciseNames: [
      'Sentadillas',
      'Prensa',
      'Empuje de cadera en máquina (Puente de glúteos)',
      'Patada de glúteo en máquina',
      'Curl femoral sentado en máquina',
      'Extensión de cuádriceps sentado en máquina',
      'Elevación de talones en máquina de sentadillas (Power Squat)',
    ],
  },
  {
    key: 'female-day2-push',
    name: 'Día 2 - Empuje (Pecho, Hombro y Tríceps)',
    exerciseNames: [
      'Press banca sentado empujando hacia delante',
      'Press de pecho en máquina vertical',
      'Aperturas de pecho en máquina (Pec-Deck)',
      'Press de hombro en máquina',
      'Elevaciones laterales con mancuerna',
      'Jalón de tríceps hacia abajo con cuerdas',
      'Paralelas en máquina para tríceps',
    ],
  },
  {
    key: 'female-day3-pull-glutes',
    name: 'Día 3 - Tirón y Glúteo (Espalda y Bíceps)',
    exerciseNames: [
      'Máquina de espalda jalando abajo, agarre para dorsales',
      'Máquina de espalda jalando de frente hacia la espalda',
      'Elevación de mancuernas para bíceps',
      'Predicador para bíceps en máquina',
      'Patada de glúteo en máquina',
      'Aductores cerrando',
      'Aductores abriendo',
    ],
  },
]

// Called once when a new profile is created with sex 'F' (see ProfileSetup).
// Idempotent by routine key, and only links exercises that already exist
// in the shared catalog (ensureExercisesSeeded always runs first on app
// start, so lookups here should never miss).
export async function ensureFemaleRoutinesSeeded() {
  await db.transaction('rw', db.routines, db.exercises, db.routineExercises, async () => {
    for (const routine of FEMALE_ROUTINES) {
      const existingRoutine = await db.routines.where('key').equals(routine.key).first()
      const routineId = existingRoutine
        ? existingRoutine.id!
        : ((await db.routines.add({ key: routine.key, name: routine.name })) as number)

      const existingLinks = await db.routineExercises.where('routineId').equals(routineId).toArray()
      const linkedExerciseIds = new Set(existingLinks.map((l) => l.exerciseId))
      let nextOrder = existingLinks.length

      for (const exerciseName of routine.exerciseNames) {
        const exercise = await db.exercises.where('name').equals(exerciseName).first()
        if (!exercise?.id || linkedExerciseIds.has(exercise.id)) continue
        await db.routineExercises.add({ routineId, exerciseId: exercise.id, order: nextOrder })
        nextOrder++
      }
    }
  })
}

// Exercises that changed name/meaning after the "no exclusive profile"
// rework — matched and renamed in place (by old name) so existing logged
// sets keep pointing at the same exerciseId.
const RENAME_MAP: { from: string; to: string }[] = [
  {
    from: 'Empuje de cadera / patada de glúteo en máquina',
    to: 'Empuje de cadera en máquina (Puente de glúteos)',
  },
]

// Idempotent upsert-by-name: safe to call on every app start. Creates
// whatever routines/exercises/links are missing without touching what
// already exists, so future additions to ROUTINES reach devices that
// were already seeded.
export async function ensureExercisesSeeded() {
  await db.transaction('rw', db.routines, db.exercises, db.routineExercises, async () => {
    for (const rename of RENAME_MAP) {
      const existing = await db.exercises.where('name').equals(rename.from).first()
      if (existing) {
        await db.exercises.update(existing.id!, { name: rename.to })
      }
    }

    for (const routine of ROUTINES) {
      const existingRoutine = await db.routines.where('key').equals(routine.key).first()
      const routineId = existingRoutine
        ? existingRoutine.id!
        : ((await db.routines.add({ key: routine.key, name: routine.name })) as number)

      const existingLinks = await db.routineExercises.where('routineId').equals(routineId).toArray()
      const linkedExerciseIds = new Set(existingLinks.map((l) => l.exerciseId))
      let nextOrder = existingLinks.length

      for (const ex of routine.exercises) {
        const existingExercise = await db.exercises.where('name').equals(ex.name).first()
        const exerciseId = existingExercise
          ? existingExercise.id!
          : ((await db.exercises.add({
              name: ex.name,
              muscleGroup: ex.muscleGroup,
              order: nextOrder,
            })) as number)

        if (!linkedExerciseIds.has(exerciseId)) {
          await db.routineExercises.add({ routineId, exerciseId, order: nextOrder })
          nextOrder++
        }
      }
    }
  })
}
