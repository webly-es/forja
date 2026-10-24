import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Sparkles, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { deleteRoutine } from '../db/queries'
import { getRoutineDraft, saveRoutine } from '../db/routines'
import { useAppStore } from '../store/useAppStore'
import { coverForGroups, coverUrl } from '../lib/routineCovers'
import { ConfirmDeleteRow } from '../components/ConfirmDeleteRow'
import { CatalogPicker } from '../components/routines/CatalogPicker'
import { MuscleBalance } from '../components/routines/MuscleBalance'
import { SelectedExerciseCard } from '../components/routines/SelectedExerciseCard'
import { RoutineAnalysisSheet } from '../components/routines/RoutineAnalysisSheet'
import type { RoutineDraft, RoutineItem, RoutineReview } from '../types'

export function RoutineBuilder() {
  const { routineId } = useParams()
  const editingId = routineId ? Number(routineId) : null
  const navigate = useNavigate()
  const activeProfileId = useAppStore((s) => s.activeProfileId)!

  const allExercises = useLiveQuery(() => db.exercises.toArray(), [], [])
  const profileCount = useLiveQuery(() => db.profiles.count(), [], 1)

  const [draft, setDraft] = useState<RoutineDraft | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = editingId ? getRoutineDraft(editingId) : Promise.resolve(undefined)
    void load.then((existing) => {
      if (!cancelled) setDraft(existing ?? { name: '', profileId: activeProfileId, items: [] })
    })
    return () => {
      cancelled = true
    }
  }, [editingId, activeProfileId])

  if (!draft) return null

  const exercisesById = new Map((allExercises ?? []).map((e) => [e.id!, e]))
  const items = draft.items.filter((i) => exercisesById.has(i.exerciseId))
  const selectedIds = items.map((i) => i.exerciseId)
  const cover = coverForGroups(items.map((i) => exercisesById.get(i.exerciseId)!.muscleGroup))
  const canSave = draft.name.trim() !== '' && items.length > 0 && !saving

  const setItems = (update: (items: RoutineItem[]) => RoutineItem[]) =>
    setDraft((d) => (d ? { ...d, items: update(d.items) } : d))

  function toggle(exerciseId: number) {
    setItems((list) =>
      list.some((i) => i.exerciseId === exerciseId)
        ? list.filter((i) => i.exerciseId !== exerciseId)
        : [...list, { exerciseId }],
    )
  }

  function move(index: number, dir: -1 | 1) {
    setItems((list) => {
      const target = index + dir
      if (target < 0 || target >= list.length) return list
      const next = [...list]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function onAnalysisChange(next: { items?: RoutineItem[]; aiReview: RoutineReview }) {
    setDraft((d) => (d ? { ...d, items: next.items ?? d.items, aiReview: next.aiReview } : d))
    // A plain analysis is kept even if the routine isn't saved again; applied changes wait for Guardar.
    if (editingId && !next.items) void db.routines.update(editingId, { aiReview: next.aiReview })
  }

  async function handleSave() {
    if (!draft || !canSave) return
    setSaving(true)
    try {
      await saveRoutine({ ...draft, items })
      navigate('/workout/start')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editingId) return
    await deleteRoutine(editingId)
    navigate('/workout/start')
  }

  const ownerButton = (active: boolean) =>
    `flex-1 rounded-lg py-2 text-sm font-medium transition-all active:scale-[0.97] ${
      active ? 'bg-accent text-bg' : 'text-text-muted hover:text-text'
    }`

  return (
    <div className="flex flex-col gap-5">
      <div className="card-forged relative h-32 overflow-hidden">
        <img src={coverUrl(cover)} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-right" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/70 to-transparent" />
        <button
          onClick={() => navigate('/workout/start')}
          className="absolute left-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-bg/60 text-text-muted backdrop-blur transition-colors hover:text-text"
          aria-label="Volver"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex h-full flex-col justify-end p-4">
          <span className="text-[11px] uppercase tracking-widest text-accent">{editingId ? 'Editar rutina' : 'Nueva rutina'}</span>
          <h1 className="truncate font-display text-2xl uppercase leading-tight tracking-wide text-text">
            {draft.name.trim() || 'Sin nombre'}
          </h1>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Nombre</label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="input"
            placeholder="Ej. Día 1 - Pecho y tríceps"
          />
        </div>
        {profileCount > 1 && (
          <div className="flex gap-2 rounded-xl border border-border bg-surface p-1">
            <button onClick={() => setDraft({ ...draft, profileId: activeProfileId })} className={ownerButton(draft.profileId != null)}>
              Solo para mí
            </button>
            <button onClick={() => setDraft({ ...draft, profileId: undefined })} className={ownerButton(draft.profileId == null)}>
              Para ambos
            </button>
          </div>
        )}
      </div>

      {draft.notes && (
        <p className="rounded-xl border border-accent-muted bg-accent-muted/20 px-4 py-3 text-xs leading-relaxed text-text-muted">
          {draft.notes}
        </p>
      )}

      <section className="flex flex-col gap-2.5">
        <h2 className="flex items-baseline gap-2 font-display text-sm uppercase tracking-widest text-accent">
          Tu rutina
          <span className="text-xs text-text-muted">{items.length}</span>
        </h2>
        <MuscleBalance items={items} exercisesById={exercisesById} />
        {items.length > 0 && (
          <button
            onClick={() => setAnalyzing(true)}
            className="card-forged flex items-center gap-3 p-3 text-left transition-colors hover:border-accent-muted active:scale-[0.98]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Sparkles size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-text">Analizar con IA</span>
              <span className="block text-xs text-text-muted">Qué mejorar y cambios a petición</span>
            </span>
          </button>
        )}
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-text-muted">
            Añade ejercicios del catálogo de abajo
          </p>
        ) : (
          items.map((item, i) => (
            <SelectedExerciseCard
              key={item.exerciseId}
              index={i}
              exercise={exercisesById.get(item.exerciseId)!}
              item={item}
              isFirst={i === 0}
              isLast={i === items.length - 1}
              expanded={expandedId === item.exerciseId}
              onToggleExpanded={() => setExpandedId((id) => (id === item.exerciseId ? null : item.exerciseId))}
              onChange={(next) => setItems((list) => list.map((x) => (x.exerciseId === next.exerciseId ? next : x)))}
              onMove={(dir) => move(i, dir)}
              onRemove={() => toggle(item.exerciseId)}
            />
          ))
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="font-display text-sm uppercase tracking-widest text-accent">Añadir ejercicios</h2>
        <CatalogPicker exercises={allExercises ?? []} selectedIds={selectedIds} onToggle={toggle} />
      </section>

      {editingId && (
        <div>
          {confirmingDelete ? (
            <div className="rounded-xl border border-border bg-surface p-4">
              <ConfirmDeleteRow
                message="¿Eliminar esta rutina?"
                onCancel={() => setConfirmingDelete(false)}
                onConfirm={handleDelete}
              />
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs text-danger hover:underline"
            >
              <Trash2 size={14} />
              Eliminar rutina
            </button>
          )}
        </div>
      )}

      {analyzing && (
        <RoutineAnalysisSheet
          draft={{ ...draft, items }}
          exercisesById={exercisesById}
          onChange={onAnalysisChange}
          onClose={() => setAnalyzing(false)}
        />
      )}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pb-2 pt-4">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="w-full rounded-xl bg-accent py-3.5 text-sm font-medium text-bg shadow-[0_0_24px_-8px_var(--color-accent)] transition-all hover:bg-accent-hover active:enabled:scale-[0.97] disabled:opacity-30"
        >
          {saving ? 'Guardando…' : `Guardar rutina${items.length ? ` · ${items.length} ejercicios` : ''}`}
        </button>
      </div>
    </div>
  )
}
