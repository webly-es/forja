import type { MuscleGroup } from './muscleGroups'

export type RoutineCover = 'pecho' | 'espalda' | 'pierna' | 'brazos' | 'gluteos' | 'general' | 'escalera'

const COVER_FOR_GROUP: Record<MuscleGroup, RoutineCover> = {
  Pecho: 'pecho',
  Hombro: 'pecho',
  Espalda: 'espalda',
  'Bíceps': 'brazos',
  'Tríceps': 'brazos',
  Pierna: 'pierna',
  'Cuádriceps': 'pierna',
  Femorales: 'pierna',
  Gemelos: 'pierna',
  'Glúteos': 'gluteos',
  Abdomen: 'general',
}

export const HERO_IMAGE = `${import.meta.env.BASE_URL}img/hero.webp`

export function coverUrl(cover: RoutineCover): string {
  return `${import.meta.env.BASE_URL}img/rutinas/${cover}.webp`
}

// Picks the cover of the muscle area most of the routine's exercises work, so
// custom routines get a fitting image too. Ties keep the first area seen.
export function coverForGroups(groups: MuscleGroup[]): RoutineCover {
  const counts = new Map<RoutineCover, number>()
  for (const group of groups) {
    const cover = COVER_FOR_GROUP[group] ?? 'general'
    counts.set(cover, (counts.get(cover) ?? 0) + 1)
  }
  let best: RoutineCover = 'general'
  let bestCount = 0
  for (const [cover, count] of counts) {
    if (count > bestCount) {
      best = cover
      bestCount = count
    }
  }
  return best
}
