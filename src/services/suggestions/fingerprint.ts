import { createHash } from 'crypto'
import { SuggestionSourceType } from './types'
import { normalizeText } from './textSimilarity'

export function generateFingerprint(text: string, sourceType: SuggestionSourceType): string {
  const normalized = normalizeText(text)
  const input = `${normalized}:${sourceType}`
  return createHash('sha256').update(input).digest('hex')
}
