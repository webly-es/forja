export const MUSCLE_GROUPS = [
  'Hombro',
  'Espalda',
  'Pecho',
  'Bíceps',
  'Tríceps',
  'Abdomen',
  'Pierna',
  'Cuádriceps',
  'Femorales',
  'Gemelos',
  'Glúteos',
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]
