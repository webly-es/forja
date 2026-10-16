import type { ReactNode } from 'react'
import { X } from 'lucide-react'

// Bottom sheet for editing one setting, same frame as the food and activity sheets.
export function SettingsSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-6" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  )
}
