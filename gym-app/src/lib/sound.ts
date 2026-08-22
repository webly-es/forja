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
