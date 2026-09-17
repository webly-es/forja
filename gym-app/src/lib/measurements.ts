export const MEASUREMENT_TYPES = ['waist', 'chest', 'arm', 'hip', 'thigh'] as const

export type MeasurementType = (typeof MEASUREMENT_TYPES)[number]

export const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  waist: 'Cintura',
  chest: 'Pecho',
  arm: 'Brazo',
  hip: 'Cadera',
  thigh: 'Muslo',
}
