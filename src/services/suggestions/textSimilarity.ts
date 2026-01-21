const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'this', 'that', 'these', 'those', 'it', 'its',
  'my', 'your', 'his', 'her', 'our', 'their',
  'i', 'me', 'we', 'you', 'he', 'she', 'they',
  'am', 'just', 'also', 'very', 'too', 'so', 'up', 'out', 'about'
])

export function normalizeText(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const tokens = cleaned.split(' ').filter(token =>
    token.length > 1 && !STOPWORDS.has(token)
  )

  return tokens.sort().join(' ')
}

export function tokenize(text: string): Set<string> {
  const normalized = normalizeText(text)
  return new Set(normalized.split(' ').filter(t => t.length > 0))
}

export function jaccardSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1)
  const tokens2 = tokenize(text2)

  if (tokens1.size === 0 && tokens2.size === 0) return 1
  if (tokens1.size === 0 || tokens2.size === 0) return 0

  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)))
  const union = new Set([...tokens1, ...tokens2])

  return intersection.size / union.size
}

export function areTasksSameIntent(text1: string, text2: string, threshold = 0.6): boolean {
  return jaccardSimilarity(text1, text2) >= threshold
}

const MAINTENANCE_KEYWORDS = [
  'renew', 'renewal', 'check', 'backup', 'review', 'update', 'clean',
  'maintain', 'maintenance', 'inspect', 'service', 'replace', 'refill',
  'restock', 'pay', 'bill', 'subscription', 'insurance', 'license',
  'registration', 'appointment', 'checkup', 'oil change', 'filter'
]

export function containsMaintenanceKeyword(text: string): boolean {
  const lowerText = text.toLowerCase()
  return MAINTENANCE_KEYWORDS.some(keyword => lowerText.includes(keyword))
}
