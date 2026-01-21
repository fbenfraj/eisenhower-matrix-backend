export const SuggestionSourceType = {
  S1_RECURRENCE: 'S1_RECURRENCE',
  S2_FOLLOW_UP: 'S2_FOLLOW_UP',
  S3_LATE_ADDITION: 'S3_LATE_ADDITION',
  S4_DEPENDENCY: 'S4_DEPENDENCY',
  S5_MAINTENANCE: 'S5_MAINTENANCE'
} as const

export type SuggestionSourceType = (typeof SuggestionSourceType)[keyof typeof SuggestionSourceType]

export const SuggestionStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  SNOOZED: 'SNOOZED',
  DISMISSED: 'DISMISSED',
  NEVER: 'NEVER'
} as const

export type SuggestionStatus = (typeof SuggestionStatus)[keyof typeof SuggestionStatus]

export interface SuggestionCandidate {
  suggestedText: string
  sourceType: SuggestionSourceType
  confidence: number
  why: string
  fingerprint: string
  relatedTaskIds: number[]
}

export interface TextCluster {
  normalizedText: string
  taskIds: number[]
  occurrences: number
  texts: string[]
  completedDates: Date[]
  averageIntervalDays: number
}

export interface SuggestedTaskResponse {
  id: number
  suggestedText: string
  sourceType: SuggestionSourceType
  confidence: number
  why: string
  status: SuggestionStatus
  fingerprint: string
  relatedTaskIds: number[]
  snoozeUntil: string | null
  lastShownAt: string | null
  createdAt: string
  updatedAt: string
}
