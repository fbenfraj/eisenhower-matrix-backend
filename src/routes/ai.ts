import { Router, Request, Response } from 'express'
import { parseTaskWithAI, sortTasksWithAI } from '../services/ai'

const router = Router()

router.post('/parse-task', async (req: Request, res: Response) => {
  try {
    const { input } = req.body

    if (!input || typeof input !== 'string') {
      res.status(400).json({ error: 'Input is required and must be a string' })
      return
    }

    const parsed = await parseTaskWithAI(input)
    res.json(parsed)
  } catch (error) {
    console.error('Error parsing task with AI:', error)
    res.status(500).json({ error: 'Failed to parse task with AI' })
  }
})

router.post('/sort-tasks', async (req: Request, res: Response) => {
  try {
    const { tasks } = req.body

    if (!tasks || !Array.isArray(tasks)) {
      res.status(400).json({ error: 'Tasks array is required' })
      return
    }

    const sorted = await sortTasksWithAI(tasks)
    res.json(sorted)
  } catch (error) {
    console.error('Error sorting tasks with AI:', error)
    res.status(500).json({ error: 'Failed to sort tasks with AI' })
  }
})

export default router
