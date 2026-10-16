let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null
  if (!audioCtx) audioCtx = new AudioContextClass()
  return audioCtx
}

export function playRestEndBeep() {
  const ctx = getAudioCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()

  const now = ctx.currentTime
  const beepTimes = [0, 0.28, 0.56, 0.84]
  for (const offset of beepTimes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = 1568
    gain.gain.setValueAtTime(0.0001, now + offset)
    gain.gain.exponentialRampToValueAtTime(0.9, now + offset + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.26)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + offset)
    osc.stop(now + offset + 0.28)
  }
}

export function vibrateRestEnd() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([200, 100, 200])
  }
}

// Short rising arpeggio for a new personal record (distinct from the rest-end beeps).
// iPhone web apps can't vibrate, so the sound is what you notice there.
export function playRecordChime() {
  const ctx = getAudioCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()

  const now = ctx.currentTime
  const notes = [784, 988, 1175, 1568] // G5 B5 D6 G6
  notes.forEach((frequency, i) => {
    const start = now + i * 0.09
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (i === notes.length - 1 ? 0.6 : 0.22))
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.65)
  })
}

export function vibrateRecord() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([60, 40, 60, 40, 180])
  }
}
