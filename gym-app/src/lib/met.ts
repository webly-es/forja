const MET_KEYWORDS: Array<{ keywords: string[]; met: number }> = [
  { keywords: ['correr', 'trotar', 'running', 'trote'], met: 9.8 },
  { keywords: ['caminar', 'caminata', 'walk'], met: 3.5 },
  { keywords: ['piscina', 'nadar', 'natacion', 'swim'], met: 8.0 },
  { keywords: ['bici', 'ciclismo', 'cycling', 'bicicleta'], met: 7.5 },
  { keywords: ['eliptica', 'elliptical'], met: 5.0 },
  { keywords: ['remo', 'rowing'], met: 7.0 },
  { keywords: ['cuerda', 'comba', 'jump rope'], met: 10.0 },
  { keywords: ['boxeo', 'box'], met: 7.8 },
  { keywords: ['baile', 'zumba', 'dance'], met: 5.5 },
  { keywords: ['futbol', 'fútbol', 'soccer'], met: 7.0 },
  { keywords: ['basquet', 'básquet', 'basketball'], met: 6.5 },
  { keywords: ['tenis', 'tennis'], met: 7.3 },
  { keywords: ['escalar', 'climbing'], met: 8.0 },
  { keywords: ['senderismo', 'hiking'], met: 6.0 },
  { keywords: ['patinar', 'skating'], met: 7.0 },
  { keywords: ['yoga'], met: 2.5 },
  { keywords: ['sexo', 'sex'], met: 3.0 },
]

const DEFAULT_MET = 5.0

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function estimateMet(activityFreeText: string): number {
  const normalized = normalize(activityFreeText)
  for (const entry of MET_KEYWORDS) {
    if (entry.keywords.some((k) => normalized.includes(normalize(k)))) {
      return entry.met
    }
  }
  return DEFAULT_MET
}

// Cardio activities the iPhone also counts as steps. Used to avoid counting
// the same minutes twice (once by MET, once via the daily step count).
const STEP_CADENCE: Array<{ keywords: string[]; stepsPerMinute: number }> = [
  { keywords: ['correr', 'trotar', 'running', 'trote'], stepsPerMinute: 160 },
  { keywords: ['caminar', 'caminata', 'walk'], stepsPerMinute: 110 },
  { keywords: ['senderismo', 'hiking'], stepsPerMinute: 100 },
]

export function estimateStepsPerMinute(activityFreeText: string): number {
  const normalized = normalize(activityFreeText)
  for (const entry of STEP_CADENCE) {
    if (entry.keywords.some((k) => normalized.includes(normalize(k)))) {
      return entry.stepsPerMinute
    }
  }
  return 0
}
