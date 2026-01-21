import { Router, Response } from 'express'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'
import { toDbQuadrant, toFrontendQuadrant, toFrontendComplexity } from '../utils/quadrant'
import { prisma } from '../db'
import {
  getSuggestionsForUser,
  acceptSuggestion,
  snoozeSuggestion,
  dismissSuggestion,
  neverSuggestion
} from '../services/suggestions'

const router = Router()

router.use(requireAuth)

router.get('/', async (req, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user
    const suggestions = await getSuggestionsForUser(userId)
    res.json(suggestions)
  } catch (error) {
    console.error('Error fetching suggestions:', error)
    res.status(500).json({ error: 'Failed to fetch suggestions' })
  }
})

router.post('/:id/accept', async (req, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest<{ id: string }>).user
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid suggestion ID' })
      return
    }

    const { quadrant } = req.body
    if (!quadrant || typeof quadrant !== 'string') {
      res.status(400).json({ error: 'Quadrant is required' })
      return
    }

    let dbQuadrant: string
    try {
      dbQuadrant = toDbQuadrant(quadrant)
    } catch {
      res.status(400).json({ error: 'Invalid quadrant value' })
      return
    }

    const { taskId, xp } = await acceptSuggestion(userId, id, dbQuadrant)

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task) {
      res.status(500).json({ error: 'Task creation failed' })
      return
    }

    res.json({
      success: true,
      task: {
        id: task.id,
        text: task.text,
        description: task.description,
        deadline: task.deadline?.toISOString() ?? null,
        completed: task.completed,
        completedAt: task.completedAt?.toISOString() ?? null,
        quadrant: toFrontendQuadrant(task.quadrant),
        complexity: task.complexity ? toFrontendComplexity(task.complexity) : null,
        showAfter: task.showAfter?.toISOString() ?? null,
        recurrence: task.recurrence,
        xp: task.xp ?? null,
        aiScores: task.aiScores ?? null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString()
      },
      xp
    })
  } catch (error) {
    console.error('Error accepting suggestion:', error)
    const message = error instanceof Error ? error.message : 'Failed to accept suggestion'
    res.status(500).json({ error: message })
  }
})

router.post('/:id/snooze', async (req, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest<{ id: string }>).user
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid suggestion ID' })
      return
    }

    await snoozeSuggestion(userId, id)
    res.json({ success: true })
  } catch (error) {
    console.error('Error snoozing suggestion:', error)
    const message = error instanceof Error ? error.message : 'Failed to snooze suggestion'
    res.status(500).json({ error: message })
  }
})

router.post('/:id/dismiss', async (req, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest<{ id: string }>).user
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid suggestion ID' })
      return
    }

    await dismissSuggestion(userId, id)
    res.json({ success: true })
  } catch (error) {
    console.error('Error dismissing suggestion:', error)
    const message = error instanceof Error ? error.message : 'Failed to dismiss suggestion'
    res.status(500).json({ error: message })
  }
})

router.post('/:id/never', async (req, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest<{ id: string }>).user
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid suggestion ID' })
      return
    }

    await neverSuggestion(userId, id)
    res.json({ success: true })
  } catch (error) {
    console.error('Error blocking suggestion:', error)
    const message = error instanceof Error ? error.message : 'Failed to block suggestion'
    res.status(500).json({ error: message })
  }
})

export default router
