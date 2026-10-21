import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { deleteSetAndRenumber } from '../db/queries'
import type { SetLog } from '../types'

export function EditSetChip({ set, onDone }: { set: SetLog; onDone: () => void }) {
  const [weight, setWeight] = useState(String(set.weightKg))
  const [reps, setReps] = useState(String(set.reps))

  async function handleSave() {
    const weightKg = Number(weight) // added weight on bodyweight sets; bodyKg stays as logged
    const repsNum = Number(reps)
    if (weightKg < 0 || repsNum <= 0) return
    await db.sets.update(set.id!, { weightKg, reps: repsNum })
    onDone()
  }

  async function handleDelete() {
    await deleteSetAndRenumber(set.sessionId, set.exerciseId, set.id!)
    onDone()
  }

  return (
    <div className="flex items-center gap-1 rounded-md border border-accent bg-accent-muted/40 px-1.5 py-1">
      {set.bodyKg != null && <span className="text-[10px] text-accent">PC +</span>}
      <input
        type="number"
        inputMode="decimal"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        className="w-12 rounded bg-surface-2 px-1 py-0.5 text-center text-xs text-text"
      />
      <span className="text-xs text-accent">×</span>
      <input
        type="number"
        inputMode="numeric"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        className="w-10 rounded bg-surface-2 px-1 py-0.5 text-center text-xs text-text"
      />
      <button type="button" onClick={handleSave} aria-label="Guardar serie" className="text-accent">
        <Check size={14} />
      </button>
      <button type="button" onClick={handleDelete} aria-label="Borrar serie" className="text-danger">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
