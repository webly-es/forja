import { db } from './db'
import type { ExercisePhoto } from '../types'

// Bump when the bundled exercise art changes: factory photos of an older
// version are replaced on the next start, photos the user took never are.
const SEED_PHOTO_VERSION = 1

// Exercise name (exact match) -> public/exercise-photos/<file>.webp
// (golden-figure illustrations generated with Gemini, 2026-10-15).
const SEED_PHOTOS: [exerciseName: string, file: string][] = [
  ['Press de pecho sentado en máquina', 'press-pecho-sentado-maquina'],
  ['Press de pecho vertical en máquina', 'press-pecho-vertical-maquina'],
  ['Press inclinado con mancuernas', 'press-inclinado-mancuernas'],
  ['Press inclinado en máquina', 'press-inclinado-maquina'],
  ['Aperturas de pecho en máquina (Pec-Deck)', 'aperturas-pecdeck'],
  ['Press de banca con barra', 'press-banca-barra'],
  ['Press de banca con mancuernas', 'press-banca-mancuernas'],
  ['Cruce de poleas', 'cruce-poleas'],
  ['Fondos en paralelas', 'fondos-paralelas'],
  ['Jalón al pecho, agarre ancho', 'jalon-agarre-ancho'],
  ['Jalón al pecho, agarre cerrado', 'jalon-agarre-cerrado'],
  ['Remo sentado en máquina', 'remo-sentado-maquina'],
  ['Jalón en máquina de discos', 'jalon-maquina-discos'],
  ['Dominadas', 'dominadas'],
  ['Remo con barra', 'remo-barra'],
  ['Remo con mancuerna a una mano', 'remo-mancuerna'],
  ['Remo sentado en polea', 'remo-sentado-polea'],
  ['Remo con pecho apoyado', 'remo-pecho-apoyado'],
  ['Pullover en polea alta', 'pullover-polea'],
  ['Peso muerto', 'peso-muerto'],
  ['Press de hombro en máquina', 'press-hombro-maquina'],
  ['Press de hombro inclinado en máquina', 'press-hombro-inclinado-maquina'],
  ['Elevaciones laterales con mancuernas', 'elevaciones-laterales-mancuernas'],
  ['Press militar con barra', 'press-militar'],
  ['Press de hombro con mancuernas', 'press-hombro-mancuernas'],
  ['Elevaciones laterales en polea', 'elevaciones-laterales-polea'],
  ['Pájaros con mancuernas', 'pajaros-mancuernas'],
  ['Face pull en polea', 'face-pull'],
  ['Aperturas inversas en máquina', 'aperturas-inversas-maquina'],
  ['Curl de bíceps con mancuernas', 'curl-mancuernas'],
  ['Curl martillo con mancuernas', 'curl-martillo'],
  ['Curl predicador en máquina', 'curl-predicador-maquina'],
  ['Curl con barra', 'curl-barra'],
  ['Curl inclinado con mancuernas', 'curl-inclinado'],
  ['Curl en polea baja', 'curl-polea-baja'],
  ['Curl en polea con el codo atrás (bayesiano)', 'curl-bayesiano'],
  ['Extensión de tríceps en polea con cuerda', 'triceps-polea-cuerda'],
  ['Extensión de tríceps en polea a una mano', 'triceps-polea-una-mano'],
  ['Fondos de tríceps en máquina', 'fondos-triceps-maquina'],
  ['Extensión de tríceps sobre la cabeza en polea', 'triceps-sobre-cabeza'],
  ['Press francés con barra Z', 'press-frances'],
  ['Press de banca con agarre cerrado', 'press-agarre-cerrado'],
  ['Prensa de piernas', 'prensa'],
  ['Sentadilla en máquina', 'sentadilla-maquina'],
  ['Aductores en máquina', 'aductores-maquina'],
  ['Abductores en máquina', 'abductores-maquina'],
  ['Extensión de cuádriceps en máquina', 'extension-cuadriceps'],
  ['Sentadilla con barra', 'sentadilla-barra'],
  ['Sentadilla hack', 'sentadilla-hack'],
  ['Sentadilla búlgara', 'sentadilla-bulgara'],
  ['Zancadas con mancuernas', 'zancadas'],
  ['Curl femoral sentado en máquina', 'curl-femoral-sentado'],
  ['Peso muerto rumano', 'peso-muerto-rumano'],
  ['Curl femoral tumbado', 'curl-femoral-tumbado'],
  ['Curl nórdico', 'curl-nordico'],
  ['Buenos días con barra', 'buenos-dias'],
  ['Hip thrust en máquina', 'hip-thrust-maquina'],
  ['Patada de glúteo en máquina', 'patada-gluteo-maquina'],
  ['Hip thrust con barra', 'hip-thrust-barra'],
  ['Patada de glúteo en polea', 'patada-gluteo-polea'],
  ['Subida al cajón con mancuernas', 'subida-cajon'],
  ['Hiperextensión a 45°', 'hiperextension'],
  ['Gemelos en máquina de sentadilla', 'gemelos-maquina-sentadilla'],
  ['Gemelos en prensa', 'gemelos-prensa'],
  ['Gemelos de pie en máquina', 'gemelos-pie'],
  ['Gemelos sentado en máquina', 'gemelos-sentado'],
  ['Crunch en polea alta', 'crunch-polea'],
  ['Elevación de piernas colgado', 'elevacion-piernas-colgado'],
  ['Plancha', 'plancha'],
  ['Rueda abdominal', 'rueda-abdominal'],
  ['Pallof press en polea', 'pallof-press'],
]

// Byte sizes of the original public/seed-photos/ files (removed in favour
// of the new art). Those were stored untouched, while the user's own photos
// always go through resizeImageToBlob, so a matching size means "factory".
const LEGACY_SEED_SIZES = new Set([
  250810, 5316, 242422, 285080, 46226, 268319, 13545, 519919, 250132, 55544, 257528, 246904, 275871, 229662,
  248575, 29609, 39851, 252114, 76234, 44289,
])

function isFactoryPhoto(photo: ExercisePhoto): boolean {
  return photo.source === 'seed' || LEGACY_SEED_SIZES.has(photo.blob.size)
}

export async function ensureExercisePhotosSeeded() {
  for (const [exerciseName, file] of SEED_PHOTOS) {
    const exercise = await db.exercises.where('name').equals(exerciseName).first()
    if (!exercise?.id) continue

    const current = await db.exercisePhotos.get(exercise.id)
    if (current && (!isFactoryPhoto(current) || current.seedVersion === SEED_PHOTO_VERSION)) continue

    try {
      const res = await fetch(`${import.meta.env.BASE_URL}exercise-photos/${file}.webp`)
      if (!res.ok) continue
      const blob = await res.blob()
      await db.exercisePhotos.put({
        exerciseId: exercise.id,
        blob,
        updatedAt: new Date().toISOString(),
        source: 'seed',
        seedVersion: SEED_PHOTO_VERSION,
      })
    } catch {
      // Offline on first run, or asset missing: retried on the next start.
    }
  }
}
