import { useEffect, useRef, useState } from 'react'
import { pickRecorderMimeType } from '../lib/audio'

export const MAX_RECORDING_SECONDS = 60

interface Recording {
  recorder: MediaRecorder
  stream: MediaStream
  chunks: Blob[]
  done: Promise<Blob>
  timer: number
}

// Tap-to-start / tap-to-stop recorder. Stops by itself at MAX_RECORDING_SECONDS
// and hands the audio to onAutoStop so the caller can treat it like a manual stop.
export function useVoiceRecorder(onAutoStop: (audio: Blob) => void) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const current = useRef<Recording | null>(null)
  const onAutoStopRef = useRef(onAutoStop)
  onAutoStopRef.current = onAutoStop

  function release(rec: Recording) {
    window.clearInterval(rec.timer)
    rec.stream.getTracks().forEach((t) => t.stop())
    current.current = null
    setRecording(false)
  }

  async function start() {
    if (current.current) return
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Este navegador no permite grabar audio. Escribe lo que has comido.')
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      throw new Error('Permite el micrófono para Forja (en el iPhone: Ajustes › Safari › Micrófono).')
    }
    const mimeType = pickRecorderMimeType()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    const done = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/mp4' }))
    })
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      setSeconds(elapsed)
      if (elapsed >= MAX_RECORDING_SECONDS) void stop().then((audio) => audio && onAutoStopRef.current(audio))
    }, 250)
    current.current = { recorder, stream, chunks, done, timer }
    recorder.start()
    setSeconds(0)
    setRecording(true)
  }

  // Resolves to the recorded audio, or null if nothing was recording.
  async function stop(): Promise<Blob | null> {
    const rec = current.current
    if (!rec) return null
    release(rec)
    if (rec.recorder.state !== 'inactive') rec.recorder.stop()
    return rec.done
  }

  function cancel() {
    const rec = current.current
    if (!rec) return
    release(rec)
    if (rec.recorder.state !== 'inactive') rec.recorder.stop()
  }

  // Never leave the microphone open if the screen unmounts mid-recording.
  useEffect(() => () => cancel(), [])

  return { recording, seconds, start, stop, cancel }
}
