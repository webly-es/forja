import type { Exercise } from '../types'

// Equipment isn't stored per exercise; the catalog names say it ("con mancuernas", "en polea"…).
// Order matters: "Press de pecho en máquina con polea" style names pick the first match.
const EQUIPMENT: [RegExp, string][] = [
  [/mancuerna/i, 'Mancuernas'],
  [/polea|cruce/i, 'Polea'],
  [/m[aá]quina|prensa|pec-deck|hack/i, 'Máquina'],
  [/barra|press militar|peso muerto|buenos d[ií]as/i, 'Barra'],
  [/dominadas|fondos en paralelas|fondos en banco|flexiones|crunch|abdominal|plancha|n[oó]rdico|colgado|rueda|hiperextensi[oó]n|muscle-up|toes to bar/i, 'Peso corporal'],
]

// Exercises flagged as bodyweight (see Exercise.bodyweightFactor) win over the name.
export function equipmentOf(exercise: Pick<Exercise, 'name' | 'bodyweightFactor'>): string | null {
  if ((exercise.bodyweightFactor ?? 0) > 0) return 'Peso corporal'
  return EQUIPMENT.find(([re]) => re.test(exercise.name))?.[1] ?? null
}
