import { describe, it, expect } from 'vitest'
import {
  calculateXpFromScores,
  validateAiScores,
  DEFAULT_AI_SCORES,
  VALID_XP_VALUES,
  AiScores
} from './xp'

describe('calculateXpFromScores', () => {
  it('returns 5 for raw score < 0.2', () => {
    expect(calculateXpFromScores({ futurePainScore: 0, urgencyScore: 0, frictionScore: 0 })).toBe(5)
    expect(calculateXpFromScores({ futurePainScore: 0.19, urgencyScore: 0.19, frictionScore: 0.19 })).toBe(5)
  })

  it('returns 15 for raw score >= 0.2 and < 0.4', () => {
    expect(calculateXpFromScores({ futurePainScore: 0.4, urgencyScore: 0, frictionScore: 0 })).toBe(15)
    expect(calculateXpFromScores({ futurePainScore: 0.5, urgencyScore: 0.3, frictionScore: 0.1 })).toBe(15)
  })

  it('returns 30 for raw score >= 0.4 and < 0.6', () => {
    expect(calculateXpFromScores({ futurePainScore: 0.5, urgencyScore: 0.5, frictionScore: 0.5 })).toBe(30)
    expect(calculateXpFromScores({ futurePainScore: 0.6, urgencyScore: 0.5, frictionScore: 0.4 })).toBe(30)
  })

  it('returns 60 for raw score >= 0.6 and < 0.8', () => {
    expect(calculateXpFromScores({ futurePainScore: 0.8, urgencyScore: 0.7, frictionScore: 0.5 })).toBe(60)
    expect(calculateXpFromScores({ futurePainScore: 0.9, urgencyScore: 0.6, frictionScore: 0.5 })).toBe(60)
  })

  it('returns 100 for raw score >= 0.8', () => {
    expect(calculateXpFromScores({ futurePainScore: 1, urgencyScore: 1, frictionScore: 1 })).toBe(100)
    expect(calculateXpFromScores({ futurePainScore: 1, urgencyScore: 0.8, frictionScore: 0.8 })).toBe(100)
  })

  it('handles boundary values correctly', () => {
    const scores019: AiScores = { futurePainScore: 0.38, urgencyScore: 0, frictionScore: 0 }
    expect(calculateXpFromScores(scores019)).toBe(5)

    const scores02: AiScores = { futurePainScore: 0.4, urgencyScore: 0, frictionScore: 0 }
    expect(calculateXpFromScores(scores02)).toBe(15)

    const scores039: AiScores = { futurePainScore: 0.78, urgencyScore: 0, frictionScore: 0 }
    expect(calculateXpFromScores(scores039)).toBe(15)

    const scores04: AiScores = { futurePainScore: 0.8, urgencyScore: 0, frictionScore: 0 }
    expect(calculateXpFromScores(scores04)).toBe(30)
  })
})

describe('validateAiScores', () => {
  it('returns valid scores when input is correct', () => {
    const input = { futurePainScore: 0.5, urgencyScore: 0.3, frictionScore: 0.7 }
    const result = validateAiScores(input)
    expect(result).toEqual(input)
  })

  it('returns null for null input', () => {
    expect(validateAiScores(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(validateAiScores(undefined)).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(validateAiScores('string')).toBeNull()
    expect(validateAiScores(123)).toBeNull()
    expect(validateAiScores([])).toBeNull()
  })

  it('returns null when futurePainScore is missing', () => {
    expect(validateAiScores({ urgencyScore: 0.5, frictionScore: 0.5 })).toBeNull()
  })

  it('returns null when urgencyScore is missing', () => {
    expect(validateAiScores({ futurePainScore: 0.5, frictionScore: 0.5 })).toBeNull()
  })

  it('returns null when frictionScore is missing', () => {
    expect(validateAiScores({ futurePainScore: 0.5, urgencyScore: 0.5 })).toBeNull()
  })

  it('returns null when scores are not numbers', () => {
    expect(validateAiScores({ futurePainScore: '0.5', urgencyScore: 0.5, frictionScore: 0.5 })).toBeNull()
    expect(validateAiScores({ futurePainScore: 0.5, urgencyScore: null, frictionScore: 0.5 })).toBeNull()
  })

  it('clamps values below 0 to 0', () => {
    const result = validateAiScores({ futurePainScore: -0.5, urgencyScore: 0.5, frictionScore: 0.5 })
    expect(result?.futurePainScore).toBe(0)
  })

  it('clamps values above 1 to 1', () => {
    const result = validateAiScores({ futurePainScore: 1.5, urgencyScore: 0.5, frictionScore: 0.5 })
    expect(result?.futurePainScore).toBe(1)
  })
})

describe('DEFAULT_AI_SCORES', () => {
  it('has all scores set to 0.5', () => {
    expect(DEFAULT_AI_SCORES).toEqual({
      futurePainScore: 0.5,
      urgencyScore: 0.5,
      frictionScore: 0.5
    })
  })

  it('produces 30 XP when used with calculateXpFromScores', () => {
    expect(calculateXpFromScores(DEFAULT_AI_SCORES)).toBe(30)
  })
})

describe('VALID_XP_VALUES', () => {
  it('contains exactly [5, 15, 30, 60, 100]', () => {
    expect(VALID_XP_VALUES).toEqual([5, 15, 30, 60, 100])
  })
})
