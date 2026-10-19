import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera } from 'lucide-react'
import { db } from '../db/db'

interface ExercisePhotoProps {
  exerciseId: number
}

export function ExercisePhoto({ exerciseId }: ExercisePhotoProps) {
  const photo = useLiveQuery(() => db.exercisePhotos.get(exerciseId), [exerciseId])
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!photo) {
      setObjectUrl(null)
      return
    }
    const url = URL.createObjectURL(photo.blob)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  // Lock the page behind the full-screen photo; Escape also closes it.
  useEffect(() => {
    if (!expanded) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [expanded])

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (objectUrl) setExpanded(true)
        }}
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2 text-text-muted"
        aria-label={objectUrl ? 'Ver foto en grande' : 'Sin foto'}
      >
        {objectUrl ? (
          <img src={objectUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Camera size={18} />
        )}
      </button>

      {/* Portal: inside a card with a transform (press animation) "fixed" would be
          relative to the card instead of the screen. */}
      {expanded &&
        objectUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex touch-none items-center justify-center bg-black/90 p-6"
            onClick={() => setExpanded(false)}
            role="dialog"
            aria-label="Foto del ejercicio"
          >
            <img src={objectUrl} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
          </div>,
          document.body,
        )}
    </>
  )
}
