import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ConfirmDeleteRow } from './ConfirmDeleteRow'

interface DeleteWithConfirmProps {
  label: string
  confirmMessage: string
  onConfirm: () => Promise<void> | void
}

// Low-key delete button at the end of a detail screen; deleting always asks first.
export function DeleteWithConfirm({ label, confirmMessage, onConfirm }: DeleteWithConfirmProps) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/5 p-4">
        <ConfirmDeleteRow message={confirmMessage} onCancel={() => setConfirming(false)} onConfirm={() => void onConfirm()} />
      </div>
    )
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center justify-center gap-2 py-2 text-xs text-text-muted transition-colors hover:text-danger"
    >
      <Trash2 size={14} />
      {label}
    </button>
  )
}
