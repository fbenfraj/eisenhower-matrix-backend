export const VALID_XP_VALUES = [5, 15, 30, 60, 100] as const
export type XpValue = typeof VALID_XP_VALUES[number]

export interface AiScores {
  futurePainScore: number
  urgencyScore: number
  frictionScore: number
}

export function calculateXpFromScores(scores: AiScores): XpValue {
  const raw = 0.5 * scores.futurePainScore +
              0.3 * scores.urgencyScore +
              0.2 * scores.frictionScore

  if (raw < 0.2) return 5
  if (raw < 0.4) return 15
  if (raw < 0.6) return 30
  if (raw < 0.8) return 60
  return 100
}

export function validateAiScores(scores: unknown): AiScores | null {
  if (!scores || typeof scores !== 'object') return null

  const obj = scores as Record<string, unknown>

  const futurePainScore = obj.futurePainScore
  const urgencyScore = obj.urgencyScore
  const frictionScore = obj.frictionScore

  if (typeof futurePainScore !== 'number') return null
  if (typeof urgencyScore !== 'number') return null
  if (typeof frictionScore !== 'number') return null

  const clamp = (val: number) => Math.max(0, Math.min(1, val))

  return {
    futurePainScore: clamp(futurePainScore),
    urgencyScore: clamp(urgencyScore),
    frictionScore: clamp(frictionScore)
  }
}

export const DEFAULT_AI_SCORES: AiScores = {
  futurePainScore: 0.5,
  urgencyScore: 0.5,
  frictionScore: 0.5
}
