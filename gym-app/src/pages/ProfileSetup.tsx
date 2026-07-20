import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { ACTIVITY_LABELS, GOAL_LABELS } from '../lib/metrics'
import type { ActivityLevel, Goal, Sex } from '../types'

const ACTIVITY_OPTIONS = Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]
const GOAL_OPTIONS = Object.entries(GOAL_LABELS) as [Goal, string][]

export function ProfileSetup() {
  const { id } = useParams()
  const editingId = id ? Number(id) : undefined
  const navigate = useNavigate()
  const setActiveProfileId = useAppStore((s) => s.setActiveProfileId)

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
      date: new Date().toISOString().slice(0, 10),
      weightKg: data.weightKg,
    })
    setActiveProfileId(newId)
    navigate('/home')
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-text">
        {editingId != null ? 'Editar perfil' : 'Crear perfil'}
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Estos datos se usan para calcular tus métricas y personalizar tu rutina.
      </p>

      <div className="mt-8 flex flex-col gap-5">
        <Field label="Nombre">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            className="input"
          />
        </Field>

        <Field label="Sexo">
          <div className="flex gap-3">
            {(['M', 'F'] as Sex[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSex(s)}
                className={`flex-1 rounded-lg border py-3 text-sm font-medium transition-colors ${
                  sex === s
                    ? 'border-accent bg-accent-muted text-accent'
                    : 'border-border bg-surface-2 text-text-muted'
                }`}
              >
                {s === 'M' ? 'Hombre' : 'Mujer'}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
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

        <Field label="Fecha de nacimiento">
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="input"
          />
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

        <Field label="Objetivo">
          <select value={goal} onChange={(e) => setGoal(e.target.value as Goal)} className="input">
            {GOAL_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <button
        onClick={handleSave}
        disabled={!canSave}
        className="mt-10 w-full rounded-xl bg-accent py-3.5 font-medium text-bg transition-opacity disabled:opacity-30 hover:bg-accent-hover"
      >
        {editingId != null ? 'Guardar cambios' : 'Empezar'}
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-text-muted">{label}</span>
      {children}
    </label>
  )
}
