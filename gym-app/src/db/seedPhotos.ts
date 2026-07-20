import { db } from './db'

// Maps exercise name (exact match) -> file under public/seed-photos/.
// These are reference photos bundled with the app build so a fresh
// install/device gets useful exercise photos without Jonathan having to
// take every one himself from his phone.
const SEED_PHOTOS: { exerciseName: string; file: string }[] = [
  { exerciseName: 'Predicador para bíceps en máquina', file: 'biceps-predicador.jpeg' },
  {
    exerciseName: 'Máquina de espalda jalando desde arriba (dorsales y espalda media)',
    file: 'espalda-jalon-arriba-dorsales.jpeg',
  },
  {
    exerciseName: 'Máquina de espalda jalando de frente hacia la espalda',
    file: 'espalda-jalon-frente.jpeg',
  },
  {
    exerciseName: 'Máquina de espalda jalando abajo, agarre para dorsales',
    file: 'espalda-jalon-abajo-dorsales.webp',
  },
  {
    exerciseName: 'Máquina de espalda jalando abajo, agarre ancho',
    file: 'espalda-jalon-abajo-ancho.webp',
  },
  { exerciseName: 'Press de hombro en máquina', file: 'hombro-press.jpeg' },
  {
    exerciseName: 'Press de hombro en máquina con algo de inclinación',
    file: 'hombro-press-inclinado.jpg',
  },
  {
    exerciseName: 'Press banca sentado empujando hacia delante',
    file: 'pecho-press-banca-sentado.jpeg',
  },
  { exerciseName: 'Press banca inclinado en máquina', file: 'pecho-press-banca-inclinado.jpg' },
  { exerciseName: 'Aperturas de pecho en máquina (Pec-Deck)', file: 'pecho-aperturas-pecdeck.jpg' },
  { exerciseName: 'Press de pecho en máquina vertical', file: 'pecho-press-vertical.jpg' },
  {
    exerciseName: 'Extensión de cuádriceps sentado en máquina',
    file: 'pierna-extension-cuadriceps.jpeg',
  },
  { exerciseName: 'Curl femoral sentado en máquina', file: 'pierna-curl-femoral.jpeg' },
  { exerciseName: 'Prensa', file: 'pierna-prensa.jpeg' },
  { exerciseName: 'Aductores cerrando', file: 'pierna-aductores-cerrando.png' },
  { exerciseName: 'Aductores abriendo', file: 'pierna-aductores-abriendo.png' },
  {
    exerciseName: 'Empuje de cadera en máquina (Puente de glúteos)',
    file: 'pierna-empuje-cadera.jpg',
  },
  { exerciseName: 'Patada de glúteo en máquina', file: 'pierna-patada-gluteo.jpg' },
  { exerciseName: 'Sentadillas', file: 'pierna-sentadillas.jpg' },
  {
    exerciseName: 'Elevación de talones en máquina de sentadillas (Power Squat)',
    file: 'pierna-gemelos-sentadillas.jpg',
  },
  {
    exerciseName: 'Elevación de talones en máquina de prensa (Leg Press)',
    file: 'pierna-gemelos-prensa.jpg',
  },
  { exerciseName: 'Jalón de tríceps con una sola mano', file: 'triceps-jalon-una-mano.jpg' },
  { exerciseName: 'Jalón de tríceps hacia abajo con cuerdas', file: 'triceps-jalon-cuerdas.jpg' },
  { exerciseName: 'Paralelas en máquina para tríceps', file: 'triceps-paralelas.jpg' },
]

export async function ensureExercisePhotosSeeded() {
  for (const entry of SEED_PHOTOS) {
    const exercise = await db.exercises.where('name').equals(entry.exerciseName).first()
    if (!exercise?.id) continue

    const hasPhoto = await db.exercisePhotos.get(exercise.id)
    if (hasPhoto) continue

    try {
      const res = await fetch(`${import.meta.env.BASE_URL}seed-photos/${entry.file}`)
      if (!res.ok) continue
      const blob = await res.blob()
      await db.exercisePhotos.put({ exerciseId: exercise.id, blob, updatedAt: new Date().toISOString() })
    } catch {
      // Offline on first run, or asset missing — safe to skip, will retry
      // next app start since hasPhoto stays falsy.
    }
  }
}
