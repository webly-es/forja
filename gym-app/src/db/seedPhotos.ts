import { db } from './db'
import type { ExercisePhoto } from '../types'

// Bump when the bundled exercise art changes: factory photos of an older
// version are replaced on the next start, photos the user took never are.
const SEED_PHOTO_VERSION = 8

// Exercise name (exact match) -> public/exercise-photos/<file>.webp.
// 'hombre/…' = photos with Jonathan as the model (Gemini, 2026-10-18 and 2026-10-21); the rest
// keep the golden-figure illustrations (2026-10-15) because Gemini wouldn't draw them.
const SEED_PHOTOS: [exerciseName: string, file: string][] = [
  ['Press de pecho sentado en máquina', 'hombre/press-pecho-sentado-maquina'],
  ['Press de pecho vertical en máquina', 'hombre/press-pecho-vertical-maquina'],
  ['Press inclinado con mancuernas', 'hombre/press-inclinado-mancuernas'],
  ['Press inclinado en máquina', 'hombre/press-inclinado-maquina'],
  ['Aperturas de pecho en máquina (Pec-Deck)', 'hombre/aperturas-pecdeck'],
  ['Press de banca con barra', 'hombre/press-banca-barra'],
  ['Press de banca con mancuernas', 'hombre/press-banca-mancuernas'],
  ['Cruce de poleas', 'hombre/cruce-poleas'],
  ['Fondos en paralelas', 'hombre/fondos-paralelas'],
  ['Fondos en máquina (pectoral bajo)', 'hombre/fondos-paralelas'],
  ['Jalón al pecho, agarre ancho', 'hombre/jalon-maquina-discos'], // same machine; its own photo came out wrong
  ['Jalón al pecho, agarre neutro', 'hombre/jalon-agarre-neutro'],
  ['Remo sentado en máquina', 'hombre/remo-sentado-maquina'],
  ['Remo en máquina agarre martillo', 'hombre/remo-sentado-maquina'], // his own exercise, same machine
  ['Jalón en máquina de discos', 'hombre/jalon-maquina-discos'],
  ['Dominadas', 'hombre/dominadas'],
  ['Remo con barra', 'hombre/remo-barra'],
  ['Remo con mancuerna a una mano', 'hombre/remo-mancuerna'],
  ['Remo sentado en polea', 'hombre/remo-sentado-polea'],
  ['Remo con pecho apoyado', 'hombre/remo-pecho-apoyado'],
  ['Pullover en polea alta', 'hombre/pullover-polea'],
  ['Peso muerto', 'hombre/peso-muerto'],
  ['Press de hombro en máquina', 'hombre/press-hombro-maquina'],
  ['Press de hombro inclinado en máquina', 'hombre/press-hombro-inclinado-maquina'],
  ['Elevaciones laterales con mancuernas', 'hombre/elevaciones-laterales-mancuernas'],
  ['Press militar con barra', 'hombre/press-militar'],
  ['Press de hombro con mancuernas', 'hombre/press-hombro-mancuernas'],
  ['Elevaciones laterales en polea', 'hombre/elevaciones-laterales-polea'],
  ['Pájaros con mancuernas', 'hombre/pajaros-mancuernas'],
  ['Face pull en polea', 'hombre/face-pull'],
  ['Aperturas inversas en máquina', 'hombre/aperturas-inversas-maquina'],
  ['Curl de bíceps con mancuernas', 'hombre/curl-mancuernas'],
  ['Curl martillo con mancuernas', 'hombre/curl-martillo'],
  ['Curl predicador en máquina', 'hombre/curl-predicador-maquina'],
  ['Curl predicador agarre martillo', 'hombre/curl-predicador-maquina'], // his own exercise, same machine
  ['Curl predicador en máquina agarre martillo', 'hombre/curl-predicador-maquina'],
  ['Curl con barra', 'hombre/curl-barra'],
  ['Curl inclinado con mancuernas', 'hombre/curl-inclinado'],
  ['Curl en polea baja', 'hombre/curl-polea-baja'],
  ['Curl en polea con el codo atrás (bayesiano)', 'hombre/curl-bayesiano'],
  ['Extensión de tríceps en polea con cuerda', 'hombre/triceps-polea-cuerda'],
  ['Extensión de tríceps en polea', 'hombre/triceps-polea-cuerda'], // his own exercise, same pushdown
  ['Extensión de tríceps en polea con barra', 'hombre/triceps-polea-cuerda'],
  ['Extensión de tríceps en poleas', 'hombre/triceps-polea-cuerda'], // as he named it
  ['Extensión de tríceps en polea a una mano', 'hombre/triceps-polea-una-mano'],
  ['Fondos de tríceps en máquina', 'hombre/fondos-triceps-maquina'],
  ['Extensión de tríceps sobre la cabeza en polea', 'hombre/triceps-sobre-cabeza'],
  ['Press francés con barra Z', 'hombre/press-frances'],
  ['Press de banca con agarre cerrado', 'hombre/press-agarre-cerrado'],
  ['Prensa de piernas', 'hombre/gemelos-prensa'], // feet on the platform; its own photo faced the wrong way
  ['Sentadilla en máquina', 'hombre/sentadilla-maquina'],
  ['Aductores en máquina', 'hombre/aductores-maquina'],
  ['Abductores en máquina', 'hombre/abductores-maquina'],
  ['Extensión de cuádriceps en máquina', 'hombre/extension-cuadriceps'],
  ['Sentadilla con barra', 'hombre/sentadilla-barra'],
  ['Sentadilla hack', 'hombre/sentadilla-hack'],
  ['Sentadilla búlgara', 'hombre/sentadilla-bulgara'],
  ['Zancadas con mancuernas', 'hombre/zancadas'],
  ['Curl femoral sentado en máquina', 'hombre/curl-femoral-sentado'],
  ['Peso muerto rumano', 'hombre/peso-muerto-rumano'],
  ['Curl femoral tumbado', 'hombre/curl-femoral-tumbado'],
  ['Curl nórdico', 'hombre/curl-nordico'],
  ['Buenos días con barra', 'hombre/buenos-dias'],
  ['Hip thrust en máquina', 'hombre/hip-thrust-maquina'],
  ['Patada de glúteo en máquina', 'hombre/patada-gluteo-maquina'],
  ['Hip thrust con barra', 'hombre/hip-thrust-barra'],
  ['Patada de glúteo en polea', 'hombre/patada-gluteo-polea'],
  ['Subida al cajón con mancuernas', 'hombre/subida-cajon'],
  ['Hiperextensión a 45°', 'hombre/hiperextension'],
  ['Gemelos en máquina de sentadilla', 'hombre/gemelos-maquina-sentadilla'],
  ['Gemelos en prensa', 'hombre/gemelos-prensa'],
  ['Gemelos de pie en máquina', 'hombre/gemelos-pie'],
  ['Gemelos sentado en máquina', 'hombre/gemelos-sentado'],
  ['Crunch en polea alta', 'hombre/crunch-polea'],
  ['Elevación de piernas colgado', 'hombre/elevacion-piernas-colgado'],
  ['Plancha', 'hombre/plancha'],
  ['Rueda abdominal', 'hombre/rueda-abdominal'],
  ['Pallof press en polea', 'hombre/pallof-press'],
  ['Press de hombro de pie con mancuernas', 'hombre/press-hombro-pie-mancuernas'],
  ['Sentadilla con mancuernas', 'hombre/sentadilla-mancuernas'],
  ['Remo inclinado con mancuernas', 'hombre/remo-inclinado-mancuernas'],
  ['Peso muerto con mancuernas', 'hombre/peso-muerto-mancuernas'],
  // Bodyweight exercises (round 2026-10-21).
  ['Flexiones', 'hombre/flexiones'],
  ['Flexiones con rodillas apoyadas', 'hombre/flexiones-rodillas'],
  ['Flexiones inclinadas (manos en banco)', 'hombre/flexiones-inclinadas'],
  ['Flexiones declinadas (pies elevados)', 'hombre/flexiones-declinadas'],
  ['Flexiones abiertas', 'hombre/flexiones-abiertas'],
  ['Flexiones arqueras', 'hombre/flexiones-arqueras'],
  ['Flexiones diamante', 'hombre/flexiones-diamante'],
  ['Flexiones cerradas', 'hombre/flexiones-cerradas'],
  ['Fondos en banco', 'hombre/fondos-banco'],
  ['Flexiones pike', 'hombre/flexiones-pike'],
  ['Dominadas supinas', 'hombre/dominadas-supinas'],
  ['Dominadas agarre neutro', 'hombre/dominadas-neutro'],
  ['Dominadas agarre ancho', 'hombre/dominadas-ancho'],
  ['Dominadas agarre cerrado', 'hombre/dominadas-cerrado'],
  ['Dominadas negativas', 'hombre/dominadas-negativas'],
  ['Dominadas arqueras', 'hombre/dominadas-arqueras'],
  ['Muscle-up', 'hombre/muscle-up'],
  ['Remo australiano (dominada invertida)', 'hombre/remo-australiano'],
  ['Crunch abdominal', 'hombre/crunch'],
  ['Crunch inverso', 'hombre/crunch-inverso'],
  ['Crunch bicicleta', 'hombre/crunch-bicicleta'],
  ['Crunch con piernas a 90°', 'hombre/crunch-90'],
  ['Crunch oblicuo', 'hombre/crunch-oblicuo'],
  ['Abdominal en V', 'hombre/abdominal-v'],
  ['Elevación de rodillas colgado', 'hombre/elevacion-rodillas-colgado'],
  ['Toes to bar', 'hombre/toes-to-bar'],
]

// Byte sizes of the original public/seed-photos/ files (removed in favour
// of the new art). Those were stored untouched, while the user's own photos
// always go through resizeImageToBlob, so a matching size means "factory".
const LEGACY_SEED_SIZES = new Set([
  250810, 5316, 242422, 285080, 46226, 268319, 13545, 519919, 250132, 55544, 257528, 246904, 275871, 229662,
  248575, 29609, 39851, 252114, 76234, 44289,
])

// Exercises whose current photo is replaced even if the user took it themselves
// (he asked for it). Once replaced it counts as a factory photo, so this only happens once.
const FORCE_REPLACE = new Set(['Remo en máquina agarre martillo'])

function isFactoryPhoto(photo: ExercisePhoto): boolean {
  return photo.source === 'seed' || LEGACY_SEED_SIZES.has(photo.blob.size)
}

// Names are matched ignoring case, accents and punctuation, so an exercise the
// user typed by hand ("remo en maquina agarre martillo") still gets its photo.
function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export async function ensureExercisePhotosSeeded() {
  const byName = new Map((await db.exercises.toArray()).map((e) => [nameKey(e.name), e]))
  for (const [exerciseName, file] of SEED_PHOTOS) {
    const exercise = byName.get(nameKey(exerciseName))
    if (!exercise?.id) continue

    const current = await db.exercisePhotos.get(exercise.id)
    const replaceable = current && (isFactoryPhoto(current) || FORCE_REPLACE.has(exerciseName))
    if (current && (!replaceable || current.seedVersion === SEED_PHOTO_VERSION)) continue

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
