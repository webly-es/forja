import type { ReactNode } from 'react'

interface ConfirmDeleteRowProps {
  message: ReactNode
  onCancel: () => void
  onConfirm: () => void
  confirmLabel?: string
}

export function ConfirmDeleteRow({ message, onCancel, onConfirm, confirmLabel = 'Sí, eliminar' }: ConfirmDeleteRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-text">{message}</span>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-text"
        >
          No
        </button>
        <button
          onClick={onConfirm}
          className="rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
