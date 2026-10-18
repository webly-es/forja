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
