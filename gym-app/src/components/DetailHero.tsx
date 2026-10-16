import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface DetailHeroProps {
  title: string
  subtitle: string
  image?: string
  icon?: ReactNode
  backTo: string
}

// Header for detail screens: routine cover fading into the background, big title.
export function DetailHero({ title, subtitle, image, icon, backTo }: DetailHeroProps) {
  const navigate = useNavigate()
  return (
    <div className="relative -mx-4 -mt-6 overflow-hidden px-4 pb-4 pt-4">
      {image && (
        <>
          <img src={image} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/30" aria-hidden="true" />
        </>
      )}
      <div className="relative">
        <button
          onClick={() => navigate(backTo)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-bg/60 text-text-muted backdrop-blur hover:text-text"
          aria-label="Volver"
        >
          <ArrowLeft size={18} />
        </button>
        <div className={`flex items-end gap-3 ${image ? 'mt-16' : 'mt-4'}`}>
          {icon}
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-medium uppercase leading-tight tracking-wide text-text">{title}</h1>
            <p className="mt-0.5 text-xs text-accent">{subtitle.charAt(0).toUpperCase() + subtitle.slice(1)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StatTiles({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="card-forged grid py-3.5 text-center" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item, i) => (
        <div key={item.label} className={i > 0 ? 'border-l border-white/10' : ''}>
          <div className="font-display text-2xl text-text">{item.value}</div>
          <div className="text-[11px] text-text-muted">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
