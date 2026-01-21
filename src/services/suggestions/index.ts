import { prisma } from '../../db'
import { SuggestedTaskResponse, SuggestionStatus } from './types'
import { generateSuggestions } from './generator'
import { jaccardSimilarity } from './textSimilarity'
import { parseTaskWithAI } from '../ai'

type PrismaClient = typeof prisma & {
  suggestedTask: {
    findMany: (args: unknown) => Promise<SuggestedTaskRow[]>
    findFirst: (args: unknown) => Promise<SuggestedTaskRow | null>
    findUnique: (args: unknown) => Promise<SuggestedTaskRow | null>
    create: (args: unknown) => Promise<SuggestedTaskRow>
    update: (args: unknown) => Promise<SuggestedTaskRow>
    count: (args: unknown) => Promise<number>
  }
}

interface SuggestedTaskRow {
  id: number
  userId: number
  suggestedText: string
  sourceType: string
  confidence: number
  why: string
  status: string
  fingerprint: string
  relatedTaskIds: number[]
  snoozeUntil: Date | null
  lastShownAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const db = prisma as unknown as PrismaClient

const MAX_SUGGESTIONS_PER_DAY = 2
const MAX_SUGGESTIONS_SHOWN = 2
const SIMILARITY_THRESHOLD = 0.6
const DISMISS_COOLDOWN_DAYS = 7

function toResponse(suggestion: {
  id: number
  suggestedText: string
  sourceType: string
  confidence: number
  why: string
  status: string
  fingerprint: string
  relatedTaskIds: number[]
  snoozeUntil: Date | null
  lastShownAt: Date | null
  createdAt: Date
  updatedAt: Date
}): SuggestedTaskResponse {
  return {
    id: suggestion.id,
    suggestedText: suggestion.suggestedText,
    sourceType: suggestion.sourceType as SuggestedTaskResponse['sourceType'],
    confidence: suggestion.confidence,
    why: suggestion.why,
    status: suggestion.status as SuggestedTaskResponse['status'],
    fingerprint: suggestion.fingerprint,
    relatedTaskIds: suggestion.relatedTaskIds,
    snoozeUntil: suggestion.snoozeUntil?.toISOString() ?? null,
    lastShownAt: suggestion.lastShownAt?.toISOString() ?? null,
    createdAt: suggestion.createdAt.toISOString(),
    updatedAt: suggestion.updatedAt.toISOString()
  }
}

async function getBlockedFingerprints(userId: number): Promise<Set<string>> {
  const blocked = await db.suggestedTask.findMany({
    where: {
      userId,
      status: SuggestionStatus.NEVER
    },
    select: { fingerprint: true }
  })
  return new Set(blocked.map(s => s.fingerprint))
}

async function getRecentlyDismissedFingerprints(userId: number): Promise<Set<string>> {
  const cooldownDate = new Date()
  cooldownDate.setDate(cooldownDate.getDate() - DISMISS_COOLDOWN_DAYS)

  const dismissed = await db.suggestedTask.findMany({
    where: {
      userId,
      status: SuggestionStatus.DISMISSED,
      updatedAt: { gte: cooldownDate }
    },
    select: { fingerprint: true }
  })
  return new Set(dismissed.map(s => s.fingerprint))
}

async function getSuggestionsShownToday(userId: number): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const count = await db.suggestedTask.count({
    where: {
      userId,
      lastShownAt: { gte: startOfDay }
    }
  })
  return count
}

async function hasSimilarPendingSuggestion(
  userId: number,
  text: string,
  excludeFingerprint?: string
): Promise<boolean> {
  const pending = await db.suggestedTask.findMany({
    where: {
      userId,
      status: SuggestionStatus.PENDING
    },
    select: { suggestedText: true, fingerprint: true }
  })

  for (const suggestion of pending) {
    if (excludeFingerprint && suggestion.fingerprint === excludeFingerprint) continue
    if (jaccardSimilarity(text, suggestion.suggestedText) >= SIMILARITY_THRESHOLD) {
      return true
    }
  }
  return false
}

export async function getSuggestionsForUser(userId: number): Promise<SuggestedTaskResponse[]> {
  const shownToday = await getSuggestionsShownToday(userId)
  if (shownToday >= MAX_SUGGESTIONS_PER_DAY) {
    return []
  }

  const now = new Date()
  const existingPending = await db.suggestedTask.findMany({
    where: {
      userId,
      status: SuggestionStatus.PENDING,
      OR: [
        { snoozeUntil: null },
        { snoozeUntil: { lte: now } }
      ]
    },
    orderBy: { confidence: 'desc' },
    take: MAX_SUGGESTIONS_SHOWN
  })

  if (existingPending.length >= MAX_SUGGESTIONS_SHOWN) {
    for (const suggestion of existingPending) {
      await db.suggestedTask.update({
        where: { id: suggestion.id },
        data: { lastShownAt: now }
      })
    }
    return existingPending.map(toResponse)
  }

  const blockedFingerprints = await getBlockedFingerprints(userId)
  const dismissedFingerprints = await getRecentlyDismissedFingerprints(userId)
  const candidates = await generateSuggestions(userId)

  for (const candidate of candidates) {
    if (blockedFingerprints.has(candidate.fingerprint)) continue
    if (dismissedFingerprints.has(candidate.fingerprint)) continue

    const hasSimilar = await hasSimilarPendingSuggestion(userId, candidate.suggestedText)
    if (hasSimilar) continue

    const existingWithFingerprint = await db.suggestedTask.findFirst({
      where: {
        userId,
        fingerprint: candidate.fingerprint,
        status: { in: [SuggestionStatus.PENDING, SuggestionStatus.SNOOZED] }
      }
    })

    if (existingWithFingerprint) continue

    await db.suggestedTask.create({
      data: {
        userId,
        suggestedText: candidate.suggestedText,
        sourceType: candidate.sourceType,
        confidence: candidate.confidence,
        why: candidate.why,
        fingerprint: candidate.fingerprint,
        relatedTaskIds: candidate.relatedTaskIds,
        lastShownAt: now
      }
    })
  }

  const suggestions = await db.suggestedTask.findMany({
    where: {
      userId,
      status: SuggestionStatus.PENDING,
      OR: [
        { snoozeUntil: null },
        { snoozeUntil: { lte: now } }
      ]
    },
    orderBy: { confidence: 'desc' },
    take: MAX_SUGGESTIONS_SHOWN
  })

  return suggestions.map(toResponse)
}

export async function acceptSuggestion(
  userId: number,
  suggestionId: number,
  quadrant: string
): Promise<{ taskId: number; xp: number | null }> {
  const suggestion = await db.suggestedTask.findFirst({
    where: { id: suggestionId, userId }
  })

  if (!suggestion) {
    throw new Error('Suggestion not found')
  }

  let xp: number | null = null
  let aiScores: { futurePainScore: number; urgencyScore: number; frictionScore: number } | undefined

  try {
    const parsed = await parseTaskWithAI(suggestion.suggestedText)
    xp = parsed.xp
    aiScores = parsed.aiScores
  } catch {
    // If AI parsing fails, continue without XP
  }

  const task = await prisma.task.create({
    data: {
      userId,
      text: suggestion.suggestedText,
      quadrant: quadrant as 'URGENT_IMPORTANT' | 'NOT_URGENT_IMPORTANT' | 'URGENT_NOT_IMPORTANT' | 'NOT_URGENT_NOT_IMPORTANT',
      completed: false,
      xp,
      aiScores
    }
  })

  await db.suggestedTask.update({
    where: { id: suggestionId },
    data: { status: SuggestionStatus.ACCEPTED }
  })

  return { taskId: task.id, xp }
}

export async function snoozeSuggestion(
  userId: number,
  suggestionId: number
): Promise<void> {
  const suggestion = await db.suggestedTask.findFirst({
    where: { id: suggestionId, userId }
  })

  if (!suggestion) {
    throw new Error('Suggestion not found')
  }

  const snoozeUntil = new Date()
  snoozeUntil.setHours(snoozeUntil.getHours() + 24)

  await db.suggestedTask.update({
    where: { id: suggestionId },
    data: {
      status: SuggestionStatus.SNOOZED,
      snoozeUntil
    }
  })
}

export async function dismissSuggestion(
  userId: number,
  suggestionId: number
): Promise<void> {
  const suggestion = await db.suggestedTask.findFirst({
    where: { id: suggestionId, userId }
  })

  if (!suggestion) {
    throw new Error('Suggestion not found')
  }

  await db.suggestedTask.update({
    where: { id: suggestionId },
    data: { status: SuggestionStatus.DISMISSED }
  })
}

export async function neverSuggestion(
  userId: number,
  suggestionId: number
): Promise<void> {
  const suggestion = await db.suggestedTask.findFirst({
    where: { id: suggestionId, userId }
  })

  if (!suggestion) {
    throw new Error('Suggestion not found')
  }

  await db.suggestedTask.update({
    where: { id: suggestionId },
    data: { status: SuggestionStatus.NEVER }
  })
}

export * from './types'
