import { describe, expect, it } from 'vitest'
import { applyAnswers, applyMemory, foodKey, memoryValues, wasCorrected } from './foodItems'
import { parseQuestions } from './ai/food'
import type { FoodItem, FoodMemory, FoodQuestion } from '../types'

const chicken: FoodItem = { name: 'Pechuga de pollo', grams: 150, kcal: 248, proteinG: 46, carbsG: 0, fatG: 5, confidence: 'medium' }
const rice: FoodItem = { name: 'Arroz blanco', grams: 200, kcal: 260, proteinG: 5, carbsG: 56, fatG: 1, confidence: 'low' }
const oil: FoodItem = { name: 'Aceite de oliva', grams: 10, kcal: 90, proteinG: 0, carbsG: 0, fatG: 10 }

const questions: FoodQuestion[] = [
  { text: '¿A la plancha o frito?', options: [{ label: 'Plancha' }, { label: 'Frito', add: [oil] }] },
  { text: '¿Cuánto arroz?', options: [{ label: 'Lo que se ve' }, { label: 'Media ración', scale: [{ item: 1, factor: 0.5 }] }] },
]

describe('applyAnswers', () => {
  it('no answers keeps what the AI assumed', () => {
    expect(applyAnswers([chicken, rice], questions, {})).toEqual([chicken, rice])
  })

  it('adds foods and scales items by the chosen options', () => {
    const items = applyAnswers([chicken, rice], questions, { 0: 1, 1: 1 })
    expect(items).toHaveLength(3)
    expect(items[1]).toMatchObject({ grams: 100, kcal: 130, confidence: 'low' })
    expect(items[2]).toEqual(oil)
  })

  it('changing an answer recalculates from the original items', () => {
    const fried = applyAnswers([chicken, rice], questions, { 0: 1 })
    const grilled = applyAnswers([chicken, rice], questions, { 0: 0 })
    expect(fried).toHaveLength(3)
    expect(grilled).toEqual([chicken, rice])
  })
})

describe('food memory', () => {
  const memory: FoodMemory = {
    profileId: 1,
    key: 'arroz blanco',
    name: 'Arroz blanco',
    grams: 150,
    per100: { kcal: 120, proteinG: 2.5, carbsG: 27, fatG: 0.3 },
    uses: 4,
    corrected: true,
    updatedAt: '2026-10-20T12:00:00.000Z',
  }

  it('matches names regardless of accents, case and punctuation', () => {
    expect(foodKey('  Arróz  BLANCO. ')).toBe('arroz blanco')
  })

  it('uses the corrected values per gram, keeping the AI portion', () => {
    const [, fixed] = applyMemory([chicken, { ...rice, name: 'arroz blanco' }], [memory])
    expect(fixed).toMatchObject({ grams: 200, kcal: 240, proteinG: 5, carbsG: 54, fatG: 1, confidence: 'high', note: 'Según tus correcciones' })
  })

  it('foods never corrected are left to the AI', () => {
    expect(applyMemory([rice], [{ ...memory, corrected: false }])).toEqual([rice])
  })

  it('stores values per 100 g', () => {
    expect(memoryValues(rice)).toEqual({ grams: 200, per100: { kcal: 130, proteinG: 2.5, carbsG: 28, fatG: 0.5 } })
    expect(memoryValues({ ...rice, grams: 0 })).toBeNull()
  })

  it('knows when the person corrected an item', () => {
    expect(wasCorrected(rice, rice)).toBe(false)
    expect(wasCorrected({ ...rice, grams: 150 }, rice)).toBe(true)
    expect(wasCorrected(oil, undefined)).toBe(true) // added by hand
  })
})

describe('parseQuestions', () => {
  it('drops broken options and questions', () => {
    const parsed = parseQuestions(
      [
        {
          text: '¿Cuánto arroz?',
          options: [
            { label: 'Lo que se ve' },
            { label: 'Doble', scale: [{ item: 1, factor: 2 }, { item: 7, factor: 2 }, { item: 0, factor: 9 }] },
          ],
        },
        { text: 'Solo una opción', options: [{ label: 'Sí' }] },
        { text: '', options: [{ label: 'A' }, { label: 'B' }] },
      ],
      2,
    )
    expect(parsed).toEqual([{ text: '¿Cuánto arroz?', options: [{ label: 'Lo que se ve' }, { label: 'Doble', scale: [{ item: 1, factor: 2 }] }] }])
  })

  it('keeps at most three questions and two added foods per option', () => {
    const q = { text: 'Q', options: [{ label: 'A' }, { label: 'B', add: [oil, oil, oil] }] }
    const parsed = parseQuestions([q, q, q, q], 1)
    expect(parsed).toHaveLength(3)
    expect(parsed[0].options[1].add).toHaveLength(2)
  })

  it('handles a missing or malformed list', () => {
    expect(parseQuestions(undefined, 2)).toEqual([])
    expect(parseQuestions('nada', 2)).toEqual([])
  })
})
