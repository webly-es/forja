import { db } from './db'
import type { MuscleGroup } from '../lib/muscleGroups'
import type { RoutineFormat } from '../types'
import { addSeedTombstone, isSeedTombstoned, tombstoneKeys } from './seedTombstones'
import { moveMachineSettings } from './machineSettings'
import { moveExerciseTargets } from './workoutReviews'

interface SeedExercise {
  name: string
  muscleGroup: MuscleGroup
  bodyweightFactor?: number // see Exercise.bodyweightFactor
}

const ROUTINES: { key: string; name: string; format?: RoutineFormat; exercises: SeedExercise[] }[] = [
  {
    key: 'chest-tri-shoulders',
    name: 'Pecho - Tríceps - Hombros',
    exercises: [
      { name: 'Press de pecho sentado en máquina', muscleGroup: 'Pecho' },
      { name: 'Press inclinado con mancuernas', muscleGroup: 'Pecho' },
      { name: 'Press inclinado en máquina', muscleGroup: 'Pecho' },
      { name: 'Aperturas de pecho en máquina (Pec-Deck)', muscleGroup: 'Pecho' },
      { name: 'Press de pecho vertical en máquina', muscleGroup: 'Pecho' },
      { name: 'Press de hombro en máquina', muscleGroup: 'Hombro' },
      { name: 'Press de hombro inclinado en máquina', muscleGroup: 'Hombro' },
      { name: 'Elevaciones laterales con mancuernas', muscleGroup: 'Hombro' },
      { name: 'Extensión de tríceps en polea con cuerda', muscleGroup: 'Tríceps' },
      { name: 'Extensión de tríceps en polea a una mano', muscleGroup: 'Tríceps' },
      { name: 'Fondos de tríceps en máquina', muscleGroup: 'Tríceps' },
    ],
  },
  {
    key: 'back-biceps',
    name: 'Espalda - Bíceps',
    exercises: [
      { name: 'Jalón al pecho, agarre ancho', muscleGroup: 'Espalda' },
      { name: 'Jalón al pecho, agarre neutro', muscleGroup: 'Espalda' },
      { name: 'Remo sentado en máquina', muscleGroup: 'Espalda' },
      {
        name: 'Jalón en máquina de discos',
        muscleGroup: 'Espalda',
      },
      { name: 'Curl de bíceps con mancuernas', muscleGroup: 'Bíceps' },
      { name: 'Curl martillo con mancuernas', muscleGroup: 'Bíceps' },
      { name: 'Curl predicador en máquina', muscleGroup: 'Bíceps' },
    ],
  },
  {
    key: 'legs',
    name: 'Pierna',
    exercises: [
      { name: 'Prensa de piernas', muscleGroup: 'Pierna' },
      { name: 'Sentadilla en máquina', muscleGroup: 'Pierna' },
      { name: 'Extensión de cuádriceps en máquina', muscleGroup: 'Cuádriceps' },
      { name: 'Curl femoral sentado en máquina', muscleGroup: 'Femorales' },
      { name: 'Aductores en máquina', muscleGroup: 'Pierna' },
      { name: 'Abductores en máquina', muscleGroup: 'Pierna' },
      { name: 'Hip thrust en máquina', muscleGroup: 'Glúteos' },
      { name: 'Patada de glúteo en máquina', muscleGroup: 'Glúteos' },
      { name: 'Gemelos en máquina de sentadilla', muscleGroup: 'Gemelos' },
      { name: 'Gemelos en prensa', muscleGroup: 'Gemelos' },
    ],
  },
  {
    key: 'arms',
    name: 'Brazos',
    exercises: [
      { name: 'Press de hombro en máquina', muscleGroup: 'Hombro' },
      { name: 'Press de hombro inclinado en máquina', muscleGroup: 'Hombro' },
      { name: 'Elevaciones laterales con mancuernas', muscleGroup: 'Hombro' },
      { name: 'Extensión de tríceps en polea con cuerda', muscleGroup: 'Tríceps' },
      { name: 'Extensión de tríceps en polea a una mano', muscleGroup: 'Tríceps' },
      { name: 'Fondos de tríceps en máquina', muscleGroup: 'Tríceps' },
      { name: 'Curl de bíceps con mancuernas', muscleGroup: 'Bíceps' },
      { name: 'Curl martillo con mancuernas', muscleGroup: 'Bíceps' },
      { name: 'Curl predicador en máquina', muscleGroup: 'Bíceps' },
    ],
  },
  {
    // Fat-loss dumbbell circuit for everyone, no fixed day: 6→1 reps per round, 1 min rest.
    key: 'forja-ladder',
    name: 'Escalera Forja',
    format: 'ladder',
    exercises: [
      { name: 'Press de hombro de pie con mancuernas', muscleGroup: 'Hombro' },
      { name: 'Sentadilla con mancuernas', muscleGroup: 'Cuádriceps' },
      { name: 'Remo inclinado con mancuernas', muscleGroup: 'Espalda' },
      { name: 'Peso muerto con mancuernas', muscleGroup: 'Femorales' },
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
      'Sentadilla en máquina',
      'Prensa de piernas',
      'Hip thrust en máquina',
      'Patada de glúteo en máquina',
      'Curl femoral sentado en máquina',
      'Extensión de cuádriceps en máquina',
      'Gemelos en máquina de sentadilla',
    ],
  },
  {
    key: 'female-day2-push',
    name: 'Día 2 - Empuje (Pecho, Hombro y Tríceps)',
    exerciseNames: [
      'Press de pecho sentado en máquina',
      'Press de pecho vertical en máquina',
      'Aperturas de pecho en máquina (Pec-Deck)',
      'Press de hombro en máquina',
      'Elevaciones laterales con mancuernas',
      'Extensión de tríceps en polea con cuerda',
      'Fondos de tríceps en máquina',
    ],
  },
  {
    key: 'female-day3-pull-glutes',
    name: 'Día 3 - Tirón y Glúteo (Espalda y Bíceps)',
    exerciseNames: [
      'Jalón al pecho, agarre neutro',
      'Remo sentado en máquina',
      'Curl de bíceps con mancuernas',
      'Curl predicador en máquina',
      'Patada de glúteo en máquina',
      'Aductores en máquina',
      'Abductores en máquina',
    ],
  },
]

// Called once when a new profile is created with sex 'F' (see ProfileSetup).
// Idempotent by routine key, and only links exercises that already exist
// in the shared catalog (ensureExercisesSeeded always runs first on app
// start, so lookups here should never miss).
export async function ensureFemaleRoutinesSeeded() {
  await db.transaction('rw', db.routines, db.exercises, db.routineExercises, db.seedTombstones, async () => {
    for (const routine of FEMALE_ROUTINES) {
      if (await isSeedTombstoned(tombstoneKeys.routine(routine.key))) continue

      const existingRoutine = await db.routines.where('key').equals(routine.key).first()
      const routineId = existingRoutine
        ? existingRoutine.id!
        : ((await db.routines.add({ key: routine.key, name: routine.name })) as number)

      const existingLinks = await db.routineExercises.where('routineId').equals(routineId).toArray()
      const linkedExerciseIds = new Set(existingLinks.map((l) => l.exerciseId))
      let nextOrder = existingLinks.length

      for (const exerciseName of routine.exerciseNames) {
        if (await isSeedTombstoned(tombstoneKeys.link(routine.key, exerciseName))) continue
        const exercise = await db.exercises.where('name').equals(exerciseName).first()
        if (!exercise?.id || linkedExerciseIds.has(exercise.id)) continue
        await db.routineExercises.add({ routineId, exerciseId: exercise.id, order: nextOrder })
        nextOrder++
      }
    }
  })
}

// Seed exercises renamed in place (by old name) so existing logged sets,
// routine links and photos keep pointing at the same exerciseId. If an
// exercise with the new name already exists (e.g. the two quad-extension
// duplicates), the old one is merged into it instead. Applied in order, so
// chained renames work.
const RENAME_MAP: { from: string; to: string }[] = [
  {
    from: 'Empuje de cadera / patada de glúteo en máquina',
    to: 'Empuje de cadera en máquina (Puente de glúteos)',
  },
  // Clearer names (2026-10-15).
  { from: 'Press banca sentado empujando hacia delante', to: 'Press de pecho sentado en máquina' },
  { from: 'Press de pecho en máquina vertical', to: 'Press de pecho vertical en máquina' },
  { from: 'Press banca inclinado con mancuerna', to: 'Press inclinado con mancuernas' },
  { from: 'Press banca inclinado en máquina', to: 'Press inclinado en máquina' },
  { from: 'Press de hombro en máquina con algo de inclinación', to: 'Press de hombro inclinado en máquina' },
  { from: 'Elevaciones laterales con mancuerna', to: 'Elevaciones laterales con mancuernas' },
  { from: 'Jalón de tríceps hacia abajo con cuerdas', to: 'Extensión de tríceps en polea con cuerda' },
  { from: 'Jalón de tríceps con una sola mano', to: 'Extensión de tríceps en polea a una mano' },
  { from: 'Paralelas en máquina para tríceps', to: 'Fondos de tríceps en máquina' },
  { from: 'Máquina de espalda jalando abajo, agarre ancho', to: 'Jalón al pecho, agarre ancho' },
  { from: 'Máquina de espalda jalando abajo, agarre para dorsales', to: 'Jalón al pecho, agarre neutro' },
  { from: 'Máquina de espalda jalando de frente hacia la espalda', to: 'Remo sentado en máquina' },
  { from: 'Máquina de espalda jalando desde arriba (dorsales y espalda media)', to: 'Jalón en máquina de discos' },
  { from: 'Elevación de mancuernas para bíceps', to: 'Curl de bíceps con mancuernas' },
  { from: 'Elevación de mancuernas martillo para bíceps', to: 'Curl martillo con mancuernas' },
  { from: 'Predicador para bíceps en máquina', to: 'Curl predicador en máquina' },
  { from: 'Prensa', to: 'Prensa de piernas' },
  { from: 'Sentadillas', to: 'Sentadilla en máquina' },
  { from: 'Aductores cerrando', to: 'Aductores en máquina' },
  { from: 'Aductores abriendo', to: 'Abductores en máquina' },
  { from: 'Empuje de cadera en máquina (Puente de glúteos)', to: 'Hip thrust en máquina' },
  { from: 'Elevación de talones en máquina de sentadillas (Power Squat)', to: 'Gemelos en máquina de sentadilla' },
  { from: 'Elevación de talones en máquina de prensa (Leg Press)', to: 'Gemelos en prensa' },
  { from: 'Extensión de cuádriceps sentado en máquina', to: 'Extensión de cuádriceps en máquina' },
  // Barra de agarre paralelo (martillo) para dorsales, no un agarre estrecho (2026-10-21).
  { from: 'Jalón al pecho, agarre cerrado', to: 'Jalón al pecho, agarre neutro' },
]

// Extra catalog exercises that aren't part of any default routine, so new
// users have plenty to build routines from. Same upsert-by-name and
// tombstone rules as the routine exercises.
const CATALOG: SeedExercise[] = [
  { name: 'Press de banca con barra', muscleGroup: 'Pecho' },
  { name: 'Press de banca con mancuernas', muscleGroup: 'Pecho' },
  { name: 'Cruce de poleas', muscleGroup: 'Pecho' },
  { name: 'Fondos en paralelas', muscleGroup: 'Pecho', bodyweightFactor: 0.95 },
  { name: 'Fondos en máquina (pectoral bajo)', muscleGroup: 'Pecho' },
  { name: 'Dominadas', muscleGroup: 'Espalda', bodyweightFactor: 1 },
  { name: 'Remo con barra', muscleGroup: 'Espalda' },
  { name: 'Remo con mancuerna a una mano', muscleGroup: 'Espalda' },
  { name: 'Remo sentado en polea', muscleGroup: 'Espalda' },
  { name: 'Remo con pecho apoyado', muscleGroup: 'Espalda' },
  { name: 'Pullover en polea alta', muscleGroup: 'Espalda' },
  { name: 'Peso muerto', muscleGroup: 'Espalda' },
  { name: 'Press militar con barra', muscleGroup: 'Hombro' },
  { name: 'Press de hombro con mancuernas', muscleGroup: 'Hombro' },
  { name: 'Elevaciones laterales en polea', muscleGroup: 'Hombro' },
  { name: 'Pájaros con mancuernas', muscleGroup: 'Hombro' },
  { name: 'Face pull en polea', muscleGroup: 'Hombro' },
  { name: 'Aperturas inversas en máquina', muscleGroup: 'Hombro' },
  { name: 'Curl con barra', muscleGroup: 'Bíceps' },
  { name: 'Curl inclinado con mancuernas', muscleGroup: 'Bíceps' },
  { name: 'Curl en polea baja', muscleGroup: 'Bíceps' },
  { name: 'Curl en polea con el codo atrás (bayesiano)', muscleGroup: 'Bíceps' },
  { name: 'Extensión de tríceps sobre la cabeza en polea', muscleGroup: 'Tríceps' },
  { name: 'Press francés con barra Z', muscleGroup: 'Tríceps' },
  { name: 'Press de banca con agarre cerrado', muscleGroup: 'Tríceps' },
  { name: 'Sentadilla con barra', muscleGroup: 'Cuádriceps' },
  { name: 'Sentadilla hack', muscleGroup: 'Cuádriceps' },
  { name: 'Sentadilla búlgara', muscleGroup: 'Cuádriceps' },
  { name: 'Zancadas con mancuernas', muscleGroup: 'Cuádriceps' },
  { name: 'Peso muerto rumano', muscleGroup: 'Femorales' },
  { name: 'Curl femoral tumbado', muscleGroup: 'Femorales' },
  { name: 'Curl nórdico', muscleGroup: 'Femorales' },
  { name: 'Buenos días con barra', muscleGroup: 'Femorales' },
  { name: 'Hip thrust con barra', muscleGroup: 'Glúteos' },
  { name: 'Patada de glúteo en polea', muscleGroup: 'Glúteos' },
  { name: 'Subida al cajón con mancuernas', muscleGroup: 'Glúteos' },
  { name: 'Hiperextensión a 45°', muscleGroup: 'Glúteos', bodyweightFactor: 0.5 },
  { name: 'Gemelos de pie en máquina', muscleGroup: 'Gemelos' },
  { name: 'Gemelos sentado en máquina', muscleGroup: 'Gemelos' },
  { name: 'Crunch en polea alta', muscleGroup: 'Abdomen' },
  { name: 'Elevación de piernas colgado', muscleGroup: 'Abdomen', bodyweightFactor: 0.35 },
  { name: 'Plancha', muscleGroup: 'Abdomen' },
  { name: 'Rueda abdominal', muscleGroup: 'Abdomen' },
  { name: 'Pallof press en polea', muscleGroup: 'Abdomen' },

  // Bodyweight classics (2026-10-21). The factor is the share of body weight each rep moves,
  // so the coach can reason with body weight plus any added weight.
  { name: 'Flexiones', muscleGroup: 'Pecho', bodyweightFactor: 0.64 },
  { name: 'Flexiones con rodillas apoyadas', muscleGroup: 'Pecho', bodyweightFactor: 0.49 },
  { name: 'Flexiones inclinadas (manos en banco)', muscleGroup: 'Pecho', bodyweightFactor: 0.41 },
  { name: 'Flexiones declinadas (pies elevados)', muscleGroup: 'Pecho', bodyweightFactor: 0.7 },
  { name: 'Flexiones abiertas', muscleGroup: 'Pecho', bodyweightFactor: 0.64 },
  { name: 'Flexiones arqueras', muscleGroup: 'Pecho', bodyweightFactor: 0.75 },
  { name: 'Flexiones diamante', muscleGroup: 'Tríceps', bodyweightFactor: 0.64 },
  { name: 'Flexiones cerradas', muscleGroup: 'Tríceps', bodyweightFactor: 0.64 },
  { name: 'Fondos en banco', muscleGroup: 'Tríceps', bodyweightFactor: 0.6 },
  { name: 'Flexiones pike', muscleGroup: 'Hombro', bodyweightFactor: 0.7 },
  { name: 'Dominadas supinas', muscleGroup: 'Espalda', bodyweightFactor: 1 },
  { name: 'Dominadas agarre neutro', muscleGroup: 'Espalda', bodyweightFactor: 1 },
  { name: 'Dominadas agarre ancho', muscleGroup: 'Espalda', bodyweightFactor: 1 },
  { name: 'Dominadas agarre cerrado', muscleGroup: 'Espalda', bodyweightFactor: 1 },
  { name: 'Dominadas negativas', muscleGroup: 'Espalda', bodyweightFactor: 1 },
  { name: 'Dominadas arqueras', muscleGroup: 'Espalda', bodyweightFactor: 1 },
  { name: 'Muscle-up', muscleGroup: 'Espalda', bodyweightFactor: 1 },
  { name: 'Remo australiano (dominada invertida)', muscleGroup: 'Espalda', bodyweightFactor: 0.6 },
  { name: 'Crunch abdominal', muscleGroup: 'Abdomen', bodyweightFactor: 0.3 },
  { name: 'Crunch inverso', muscleGroup: 'Abdomen', bodyweightFactor: 0.3 },
  { name: 'Crunch bicicleta', muscleGroup: 'Abdomen', bodyweightFactor: 0.3 },
  { name: 'Crunch con piernas a 90°', muscleGroup: 'Abdomen', bodyweightFactor: 0.3 },
  { name: 'Crunch oblicuo', muscleGroup: 'Abdomen', bodyweightFactor: 0.3 },
  { name: 'Abdominal en V', muscleGroup: 'Abdomen', bodyweightFactor: 0.4 },
  { name: 'Elevación de rodillas colgado', muscleGroup: 'Abdomen', bodyweightFactor: 0.3 },
  { name: 'Toes to bar', muscleGroup: 'Abdomen', bodyweightFactor: 0.35 },
]

// Renames `from` to `to`, or merges it into an existing `to`, carrying over
// the user's tombstones so nothing deleted under the old name comes back.
async function applyRename(from: string, to: string) {
  // Carried over even when the old exercise is already gone: that's exactly
  // the "user deleted it" case that must not resurrect under the new name.
  for (const { key } of await db.seedTombstones.toArray()) {
    if (key === tombstoneKeys.exercise(from)) await addSeedTombstone(tombstoneKeys.exercise(to))
    if (key.startsWith('link:') && key.endsWith(':' + from)) {
      await addSeedTombstone(key.slice(0, key.length - from.length) + to)
    }
  }

  const source = await db.exercises.where('name').equals(from).first()
  if (!source?.id) return

  const target = await db.exercises.where('name').equals(to).first()
  if (!target?.id) {
    await db.exercises.update(source.id, { name: to })
    return
  }

  // Both exist: move history and routine links to the one that stays.
  const targetId = target.id
  await db.sets.where('exerciseId').equals(source.id).modify({ exerciseId: targetId })
  const linkedRoutines = new Set(
    (await db.routineExercises.where('exerciseId').equals(targetId).toArray()).map((l) => l.routineId),
  )
  for (const link of await db.routineExercises.where('exerciseId').equals(source.id).toArray()) {
    if (linkedRoutines.has(link.routineId)) await db.routineExercises.delete(link.id!)
    else await db.routineExercises.update(link.id!, { exerciseId: targetId })
  }
  const sourcePhoto = await db.exercisePhotos.get(source.id)
  if (sourcePhoto && !(await db.exercisePhotos.get(targetId))) {
    await db.exercisePhotos.put({ ...sourcePhoto, exerciseId: targetId })
  }
  await db.exercisePhotos.delete(source.id)
  await moveMachineSettings(source.id, targetId)
  await moveExerciseTargets(source.id, targetId)
  await db.exercises.delete(source.id)
}

// Old free-text muscle group values (from before the fixed MUSCLE_GROUPS
// list) mapped to their new fixed category, so exercises the user created
// by hand under the old values get remapped too, not just the seed data.
const MUSCLE_GROUP_RENAME_MAP: { from: string; to: MuscleGroup }[] = [
  { from: 'Isquiotibiales', to: 'Femorales' },
  { from: 'Aductores', to: 'Pierna' },
  { from: 'Abductores', to: 'Pierna' },
  { from: 'Glúteo', to: 'Glúteos' },
]

// Idempotent upsert-by-name: safe to call on every app start. Creates
// whatever routines/exercises/links are missing without touching what
// already exists, so future additions to ROUTINES reach devices that
// were already seeded.
export async function ensureExercisesSeeded() {
  const tables = [db.routines, db.exercises, db.routineExercises, db.seedTombstones, db.sets, db.exercisePhotos, db.machineSettings, db.exerciseTargets]
  await db.transaction('rw', tables, async () => {
    for (const rename of RENAME_MAP) {
      await applyRename(rename.from, rename.to)
    }

    const allExercises = (await db.exercises.toArray()) as { id: number; muscleGroup: string }[]
    for (const ex of allExercises) {
      const remap = MUSCLE_GROUP_RENAME_MAP.find((m) => m.from === ex.muscleGroup)
      if (remap) {
        await db.exercises.update(ex.id, { muscleGroup: remap.to })
      }
    }

    for (const routine of ROUTINES) {
      if (await isSeedTombstoned(tombstoneKeys.routine(routine.key))) continue

      const existingRoutine = await db.routines.where('key').equals(routine.key).first()
      const routineId = existingRoutine
        ? existingRoutine.id!
        : ((await db.routines.add({ key: routine.key, name: routine.name, format: routine.format })) as number)
      if (existingRoutine && routine.format && existingRoutine.format !== routine.format) {
        await db.routines.update(routineId, { format: routine.format })
      }

      const existingLinks = await db.routineExercises.where('routineId').equals(routineId).toArray()
      const linkedExerciseIds = new Set(existingLinks.map((l) => l.exerciseId))
      let nextOrder = existingLinks.length

      for (const ex of routine.exercises) {
        if (await isSeedTombstoned(tombstoneKeys.exercise(ex.name))) continue
        if (await isSeedTombstoned(tombstoneKeys.link(routine.key, ex.name))) continue

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

    for (const ex of CATALOG) {
      if (await isSeedTombstoned(tombstoneKeys.exercise(ex.name))) continue
      const existing = await db.exercises.where('name').equals(ex.name).first()
      if (!existing) {
        await db.exercises.add({ name: ex.name, muscleGroup: ex.muscleGroup, order: 0, bodyweightFactor: ex.bodyweightFactor })
      } else if (ex.bodyweightFactor != null && existing.bodyweightFactor === undefined) {
        // Marks exercises seeded before the factor existed; 0 means the user turned it off.
        await db.exercises.update(existing.id!, { bodyweightFactor: ex.bodyweightFactor })
      }
    }
  })
}
