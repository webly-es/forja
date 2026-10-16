import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import { db } from '../db/db'
import { deleteProfile } from '../db/queries'
import { ensureFemaleRoutinesSeeded } from '../db/seed'
import { useAppStore } from '../store/useAppStore'
import { todayKey } from '../lib/dates'
import { ACTIVITY_LABELS, GOAL_SHORT_LABELS } from '../lib/metrics'
import { DeleteWithConfirm } from '../components/DeleteWithConfirm'
import type { ActivityLevel, Goal, Sex } from '../types'

const ACTIVITY_OPTIONS = Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]
const GOAL_OPTIONS = Object.entries(GOAL_SHORT_LABELS) as [Goal, string][]
const SEX_OPTIONS: [Sex, string][] = [
  ['M', 'Hombre'],
  ['F', 'Mujer'],
]

export function ProfileSetup() {
  const { id } = useParams()
  const editingId = id ? Number(id) : undefined
  const navigate = useNavigate()
  const activeProfileId = useAppStore((s) => s.activeProfileId)
  const setActiveProfileId = useAppStore((s) => s.setActiveProfileId)
  const profileCount = useLiveQuery(() => db.profiles.count(), [], 0)

  const [name, setName] = useState('')
  const [sex, setSex] = useState<Sex>('M')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate')
  const [goal, setGoal] = useState<Goal>('maintain')

  useEffect(() => {
    if (editingId == null) return
    db.profiles.get(editingId).then((p) => {
      if (!p) return
      setName(p.name)
      setSex(p.sex)
      setHeightCm(String(p.heightCm))
      setWeightKg(String(p.weightKg))
      setBirthDate(p.birthDate)
      setActivityLevel(p.activityLevel)
      setGoal(p.goal)
    })
  }, [editingId])

  const canSave =
    name.trim() !== '' && Number(heightCm) > 0 && Number(weightKg) > 0 && birthDate !== ''
  const backTo = editingId != null ? '/settings' : profileCount > 0 ? '/select' : null

  async function handleSave() {
    if (!canSave) return
    const data = {
      name: name.trim(),
      sex,
      heightCm: Number(heightCm),
      weightKg: Number(weightKg),
      birthDate,
      activityLevel,
      goal,
    }

    if (editingId != null) {
      await db.profiles.update(editingId, data)
      navigate('/settings')
      return
    }

    const newId = (await db.profiles.add({ ...data, createdAt: new Date().toISOString() })) as number
    await db.bodyWeightLogs.add({
      profileId: newId,
      date: todayKey(),
      weightKg: data.weightKg,
    })
    if (sex === 'F') {
      await ensureFemaleRoutinesSeeded()
    }
    setActiveProfileId(newId)
    navigate('/home')
  }

  async function handleDelete() {
    if (editingId == null) return
    await deleteProfile(editingId)
    if (activeProfileId === editingId) setActiveProfileId(null)
    navigate('/select')
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-10 pt-6">
      {backTo && (
        <button
          onClick={() => navigate(backTo)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-bg/60 text-text-muted hover:text-text"
          aria-label="Volver"
        >
          <ArrowLeft size={18} />
        </button>
      )}
      <div className={backTo ? 'mt-4' : 'mt-10'}>
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-accent">Forja</p>
        <h1 className="mt-1.5 font-display text-3xl font-medium uppercase tracking-wide text-text">
          {editingId != null ? 'Editar perfil' : 'Crear perfil'}
        </h1>
        <div className="mt-3 h-px w-14 bg-gradient-to-r from-accent to-transparent" />
        <p className="mt-3 text-sm text-text-muted">Con estos datos se calculan tus calorías, tus macros y tu plan.</p>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <Section title="Sobre ti">
          <Field label="Nombre">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className="input" />
          </Field>
          <Field label="Sexo">
            <ChipGroup options={SEX_OPTIONS} value={sex} onChange={setSex} columns="grid-cols-2" />
          </Field>
          <Field label="Fecha de nacimiento">
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="input" />
          </Field>
        </Section>

        <Section title="Cuerpo">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Altura (cm)">
              <input
                type="number"
                inputMode="decimal"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="170"
                className="input"
              />
            </Field>
            <Field label="Peso (kg)">
              <input
                type="number"
                inputMode="decimal"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="70"
                className="input"
              />
            </Field>
          </div>
        </Section>

        <Section title="Plan">
          <Field label="Objetivo">
            <ChipGroup options={GOAL_OPTIONS} value={goal} onChange={setGoal} columns="grid-cols-2" />
          </Field>
          <Field label="Nivel de actividad">
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
              className="input"
            >
              {ACTIVITY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </Section>
      </div>

      <button
        onClick={handleSave}
        disabled={!canSave}
        className="mt-8 w-full rounded-xl bg-gradient-to-b from-[#e2b866] via-accent to-[#a87a2c] py-4 font-semibold text-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_28px_-8px_rgba(201,151,63,0.55)] transition-all duration-150 active:scale-[0.97] disabled:opacity-30 disabled:shadow-none"
      >
        {editingId != null ? 'Guardar cambios' : 'Empezar'}
      </button>

      {editingId != null && (
        <div className="mt-8 flex justify-center">
          <DeleteWithConfirm
            label="Eliminar perfil"
            confirmMessage={`¿Eliminar a ${name || 'este perfil'} y todo su historial?`}
            onConfirm={handleDelete}
          />
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs uppercase tracking-wide text-text-muted">{title}</h2>
      <div className="card-forged flex flex-col gap-4 p-4">{children}</div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs text-text-muted">{label}</span>
      {children}
    </div>
  )
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  columns,
}: {
  options: [T, string][]
  value: T
  onChange: (value: T) => void
  columns: string
}) {
  return (
    <div className={`grid gap-2 ${columns}`}>
      {options.map(([option, label]) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-lg border py-2.5 text-sm font-medium transition-colors ${
            value === option
              ? 'border-accent bg-accent-muted/60 text-accent'
              : 'border-white/[0.06] bg-surface-2 text-text-muted hover:text-text'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
