import type { MuscleGroup } from './muscleGroups'

// Movement patterns used as tabs in the exercise catalog.
export const PATTERNS = [
  { key: 'empuje', label: 'Empuje', groups: ['Pecho', 'Hombro', 'Tríceps'] },
  { key: 'tiron', label: 'Tirón', groups: ['Espalda', 'Bíceps'] },
  { key: 'pierna', label: 'Pierna', groups: ['Pierna', 'Cuádriceps', 'Femorales', 'Gemelos', 'Glúteos'] },
  { key: 'core', label: 'Core', groups: ['Abdomen'] },
] as const satisfies readonly { key: string; label: string; groups: readonly MuscleGroup[] }[]

export type PatternKey = (typeof PATTERNS)[number]['key']

export function isPatternKey(value: unknown): value is PatternKey {
  return PATTERNS.some((p) => p.key === value)
}

export function patternOf(group: MuscleGroup): PatternKey {
  return PATTERNS.find((p) => (p.groups as readonly MuscleGroup[]).includes(group))?.key ?? 'core'
}

export function groupsOf(pattern: PatternKey): readonly MuscleGroup[] {
  return PATTERNS.find((p) => p.key === pattern)!.groups
}

// Equipment isn't stored per exercise; the catalog names say it ("con mancuernas", "en polea"…).
// Order matters: "Press de pecho en máquina con polea" style names pick the first match.
const EQUIPMENT: [RegExp, string][] = [
  [/mancuerna/i, 'Mancuernas'],
  [/polea|cruce/i, 'Polea'],
  [/m[aá]quina|prensa|pec-deck|hack/i, 'Máquina'],
  [/barra|press militar|peso muerto|buenos d[ií]as/i, 'Barra'],
  [/dominadas|fondos en paralelas|plancha|n[oó]rdico|colgado|rueda|hiperextensi[oó]n/i, 'Peso corporal'],
]

export function equipmentOf(name: string): string | null {
  return EQUIPMENT.find(([re]) => re.test(name))?.[1] ?? null
}
