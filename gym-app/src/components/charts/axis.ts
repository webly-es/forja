const STEPS = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000]

// Evenly spaced round ticks covering [min, max] with at most `maxTicks` intervals.
export function niceTicks(min: number, max: number, maxTicks = 4): number[] {
  const span = Math.max(max - min, 1e-9)
  const step = STEPS.find((s) => span / s <= maxTicks) ?? STEPS[STEPS.length - 1]
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let t = start; t <= end + step / 2; t += step) ticks.push(Math.round(t * 100) / 100)
  return ticks
}
