import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera } from 'lucide-react'
import { db } from '../db/db'
import { resizeImageToBlob } from '../lib/image'

interface ExercisePhotoProps {
  exerciseId: number
}

export function ExercisePhoto({ exerciseId }: ExercisePhotoProps) {
  const photo = useLiveQuery(() => db.exercisePhotos.get(exerciseId), [exerciseId])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!photo) {
      setObjectUrl(null)
      return
    }
    const url = URL.createObjectURL(photo.blob)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const blob = await resizeImageToBlob(file)
    await db.exercisePhotos.put({ exerciseId, blob, updatedAt: new Date().toISOString() })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2 text-text-muted"
        aria-label="Agregar foto del ejercicio"
      >
        {objectUrl ? (
          <img src={objectUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Camera size={18} />
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleFileChange}
      />
    </div>
  )
}
