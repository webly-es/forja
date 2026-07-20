import { db } from './db'
import type { RoutineKey, Sex } from '../types'

interface SeedExercise {
  name: string
  muscleGroup: string
  profileScope?: Sex
}

const ROUTINES: { key: RoutineKey; name: string; exercises: SeedExercise[] }[] = [
  {
    key: 'chest-tri-shoulders',
    name: 'Pecho - Tríceps - Hombros',
    exercises: [
      { name: 'Press banca sentado empujando hacia delante', muscleGroup: 'Pecho' },
      { name: 'Press banca inclinado con mancuerna', muscleGroup: 'Pecho' },
      { name: 'Press banca inclinado en máquina', muscleGroup: 'Pecho' },
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
      { name: 'Máquina de espalda jalando desde arriba (dorsales y espalda media)', muscleGroup: 'Espalda' },
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
      { name: 'Extensión de cuádriceps en máquina', muscleGroup: 'Cuádriceps', profileScope: 'F' },
      { name: 'Empuje de cadera / patada de glúteo en máquina', muscleGroup: 'Glúteo', profileScope: 'F' },
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

export async function ensureSeeded() {
  await db.transaction('rw', db.routines, db.exercises, async () => {
    const routineCount = await db.routines.count()
    if (routineCount > 0) return

    for (const routine of ROUTINES) {
      await db.routines.add({ key: routine.key, name: routine.name })
      let order = 0
      for (const ex of routine.exercises) {
        await db.exercises.add({
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          routineKey: routine.key,
          order: order++,
          profileScope: ex.profileScope,
        })
      }
    }
  })
}
