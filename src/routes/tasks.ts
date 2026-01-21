import { Router, Response } from 'express';
import { prisma } from '../db';
import { toDbQuadrant, toFrontendQuadrant, toDbComplexity, toFrontendComplexity } from '../utils/quadrant';
import { Task, Complexity } from '../generated/prisma/client';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

// Transform DB task to frontend format
function toFrontendTask(task: Task) {
  return {
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
    updatedAt: task.updatedAt.toISOString(),
  };
}

router.get('/', async (req, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const tasks = await prisma.task.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tasks.map(toFrontendTask));
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.get('/:id', async (req, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest<{ id: string }>).user;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const task = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json(toFrontendTask(task));
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

router.post('/', async (req, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const { text, description, deadline, quadrant, complexity, showAfter, recurrence, xp, aiScores } = req.body;

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    if (!quadrant || typeof quadrant !== 'string') {
      res.status(400).json({ error: 'Quadrant is required' });
      return;
    }

    let dbQuadrant;
    try {
      dbQuadrant = toDbQuadrant(quadrant);
    } catch {
      res.status(400).json({ error: 'Invalid quadrant value' });
      return;
    }

    let dbComplexity: Complexity | undefined;
    if (complexity) {
      try {
        dbComplexity = toDbComplexity(complexity);
      } catch {
        res.status(400).json({ error: 'Invalid complexity value' });
        return;
      }
    }

    const task = await prisma.task.create({
      data: {
        text,
        description: description ?? null,
        deadline: deadline ? new Date(deadline) : null,
        quadrant: dbQuadrant,
        complexity: dbComplexity,
        showAfter: showAfter ? new Date(showAfter) : null,
        recurrence: recurrence ?? null,
        xp: xp ?? null,
        aiScores: aiScores ?? null,
        userId,
      },
    });

    res.status(201).json(toFrontendTask(task));
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.put('/:id', async (req, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest<{ id: string }>).user;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const existing = await prisma.task.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const { text, description, deadline, completed, completedAt, quadrant, complexity, showAfter, recurrence } = req.body;

    const updateData: Record<string, unknown> = {};
    const wasNotCompleted = !existing.completed;
    let isBeingCompleted = false;

    if (text !== undefined) {
      if (typeof text !== 'string') {
        res.status(400).json({ error: 'Text must be a string' });
        return;
      }
      updateData.text = text;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    if (deadline !== undefined) {
      updateData.deadline = deadline ? new Date(deadline) : null;
    }

    if (completed !== undefined) {
      updateData.completed = completed;
      if (completed && !existing.completedAt) {
        updateData.completedAt = new Date();
      } else if (!completed) {
        updateData.completedAt = null;
      }
      isBeingCompleted = completed && wasNotCompleted;
    }

    if (completedAt !== undefined) {
      updateData.completedAt = completedAt ? new Date(completedAt) : null;
    }

    if (quadrant !== undefined) {
      try {
        updateData.quadrant = toDbQuadrant(quadrant);
      } catch {
        res.status(400).json({ error: 'Invalid quadrant value' });
        return;
      }
    }

    if (complexity !== undefined) {
      if (complexity === null) {
        updateData.complexity = null;
      } else {
        try {
          updateData.complexity = toDbComplexity(complexity);
        } catch {
          res.status(400).json({ error: 'Invalid complexity value' });
          return;
        }
      }
    }

    if (showAfter !== undefined) {
      updateData.showAfter = showAfter ? new Date(showAfter) : null;
    }

    if (recurrence !== undefined) {
      updateData.recurrence = recurrence;
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
    });

    const response = toFrontendTask(task);
    if (isBeingCompleted && task.xp) {
      res.json({ ...response, xpGained: task.xp });
    } else {
      res.json(response);
    }
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/:id', async (req, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest<{ id: string }>).user;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const existing = await prisma.task.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    await prisma.task.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
