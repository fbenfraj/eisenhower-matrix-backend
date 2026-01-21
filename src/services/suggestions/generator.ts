import { prisma } from '../../db'
import { SuggestionCandidate, TextCluster, SuggestionSourceType } from './types'
import { normalizeText, jaccardSimilarity, containsMaintenanceKeyword } from './textSimilarity'
import { generateFingerprint } from './fingerprint'

const MIN_OCCURRENCES_FOR_SUGGESTION = 2
const MIN_CONFIDENCE_THRESHOLD = 0.75
const SIMILARITY_THRESHOLD = 0.6
const LOOKBACK_DAYS = 180

function clusterSimilarTasks(
  tasks: { id: number; text: string; completedAt: Date | null }[]
): TextCluster[] {
  const clusters: TextCluster[] = []
  const assigned = new Set<number>()

  for (const task of tasks) {
    if (assigned.has(task.id)) continue

    const cluster: TextCluster = {
      normalizedText: normalizeText(task.text),
      taskIds: [task.id],
      occurrences: 1,
      texts: [task.text],
      completedDates: task.completedAt ? [task.completedAt] : [],
      averageIntervalDays: 0
    }

    for (const otherTask of tasks) {
      if (otherTask.id === task.id || assigned.has(otherTask.id)) continue

      const similarity = jaccardSimilarity(task.text, otherTask.text)
      if (similarity >= SIMILARITY_THRESHOLD) {
        cluster.taskIds.push(otherTask.id)
        cluster.occurrences++
        cluster.texts.push(otherTask.text)
        if (otherTask.completedAt) {
          cluster.completedDates.push(otherTask.completedAt)
        }
        assigned.add(otherTask.id)
      }
    }

    cluster.completedDates.sort((a, b) => a.getTime() - b.getTime())

    if (cluster.completedDates.length >= 2) {
      const intervals: number[] = []
      for (let i = 1; i < cluster.completedDates.length; i++) {
        const diff = cluster.completedDates[i].getTime() - cluster.completedDates[i - 1].getTime()
        intervals.push(diff / (1000 * 60 * 60 * 24))
      }
      cluster.averageIntervalDays = intervals.reduce((a, b) => a + b, 0) / intervals.length
    }

    assigned.add(task.id)
    clusters.push(cluster)
  }

  return clusters
}

function calculateRegularityScore(cluster: TextCluster): number {
  if (cluster.completedDates.length < 2) return 0

  const intervals: number[] = []
  for (let i = 1; i < cluster.completedDates.length; i++) {
    const diff = cluster.completedDates[i].getTime() - cluster.completedDates[i - 1].getTime()
    intervals.push(diff / (1000 * 60 * 60 * 24))
  }

  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length
  const stdDev = Math.sqrt(variance)
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 1

  return Math.max(0, 1 - coefficientOfVariation)
}

function isOverdue(cluster: TextCluster): boolean {
  if (cluster.completedDates.length === 0 || cluster.averageIntervalDays === 0) return false

  const lastCompletedDate = cluster.completedDates[cluster.completedDates.length - 1]
  const daysSinceLastCompletion = (Date.now() - lastCompletedDate.getTime()) / (1000 * 60 * 60 * 24)

  return daysSinceLastCompletion >= cluster.averageIntervalDays * 0.8
}

function getMostRepresentativeText(texts: string[]): string {
  if (texts.length === 1) return texts[0]

  let bestText = texts[0]
  let bestScore = 0

  for (const text of texts) {
    const score = texts.reduce((sum, other) => sum + jaccardSimilarity(text, other), 0)
    if (score > bestScore) {
      bestScore = score
      bestText = text
    }
  }

  return bestText
}

async function hasActiveTaskSimilar(userId: number, text: string): Promise<boolean> {
  const activeTasks = await prisma.task.findMany({
    where: {
      userId,
      completed: false
    },
    select: { text: true }
  })

  for (const task of activeTasks) {
    if (jaccardSimilarity(text, task.text) >= SIMILARITY_THRESHOLD) {
      return true
    }
  }

  return false
}

export async function generateSuggestions(userId: number): Promise<SuggestionCandidate[]> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - LOOKBACK_DAYS)

  const completedTasks = await prisma.task.findMany({
    where: {
      userId,
      completed: true,
      completedAt: { gte: cutoffDate }
    },
    select: {
      id: true,
      text: true,
      completedAt: true
    },
    orderBy: { completedAt: 'desc' }
  })

  if (completedTasks.length < MIN_OCCURRENCES_FOR_SUGGESTION) {
    return []
  }

  const clusters = clusterSimilarTasks(completedTasks)
  const candidates: SuggestionCandidate[] = []

  for (const cluster of clusters) {
    if (cluster.occurrences < MIN_OCCURRENCES_FOR_SUGGESTION) continue
    if (!isOverdue(cluster)) continue

    const representativeText = getMostRepresentativeText(cluster.texts)

    const hasSimilarActive = await hasActiveTaskSimilar(userId, representativeText)
    if (hasSimilarActive) continue

    const isMaintenanceTask = containsMaintenanceKeyword(representativeText)
    const sourceType = isMaintenanceTask
      ? SuggestionSourceType.S5_MAINTENANCE
      : SuggestionSourceType.S1_RECURRENCE

    const regularityScore = calculateRegularityScore(cluster)
    const occurrenceScore = Math.min(1.0, cluster.occurrences / 5)
    let confidence = occurrenceScore * 0.6 + regularityScore * 0.4

    if (isMaintenanceTask) {
      confidence = Math.min(1.0, confidence * 1.1)
    }

    if (confidence < MIN_CONFIDENCE_THRESHOLD) continue

    const intervalDays = Math.round(cluster.averageIntervalDays)
    const why = `You've done "${representativeText}" ${cluster.occurrences} times, roughly every ${intervalDays} days`

    const fingerprint = generateFingerprint(representativeText, sourceType)

    candidates.push({
      suggestedText: representativeText,
      sourceType,
      confidence,
      why,
      fingerprint,
      relatedTaskIds: cluster.taskIds
    })
  }

  candidates.sort((a, b) => b.confidence - a.confidence)

  return candidates.slice(0, 5)
}
