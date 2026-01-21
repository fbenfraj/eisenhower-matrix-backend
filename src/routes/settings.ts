import { Router, Response } from 'express'
import { prisma } from '../db'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'

const router = Router()

router.use(requireAuth)

// Get notification settings
router.get('/notifications', async (req, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        notificationsEnabled: true,
        reminderTime: true,
        timezone: true
      }
    })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json(user)
  } catch (error) {
    console.error('Error getting notification settings:', error)
    res.status(500).json({ error: 'Failed to get settings' })
  }
})

// Update notification settings
router.put('/notifications', async (req, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user
    const { notificationsEnabled, reminderTime, timezone } = req.body

    const updateData: Record<string, unknown> = {}

    if (typeof notificationsEnabled === 'boolean') {
      updateData.notificationsEnabled = notificationsEnabled
    }

    if (reminderTime && typeof reminderTime === 'string') {
      if (!/^\d{2}:\d{2}$/.test(reminderTime)) {
        res.status(400).json({ error: 'Invalid reminder time format (expected HH:MM)' })
        return
      }
      updateData.reminderTime = reminderTime
    }

    if (timezone && typeof timezone === 'string') {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone })
        updateData.timezone = timezone
      } catch {
        res.status(400).json({ error: 'Invalid timezone' })
        return
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        notificationsEnabled: true,
        reminderTime: true,
        timezone: true
      }
    })

    res.json(user)
  } catch (error) {
    console.error('Error updating notification settings:', error)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

export default router
