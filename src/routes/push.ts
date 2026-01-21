import { Router, Response } from 'express'
import { prisma } from '../db'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth'
import { getYesterdayStats, sendPushToUser } from '../services/push'

const router = Router()

router.use(requireAuth)

// Subscribe to push notifications
router.post('/subscribe', async (req, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user
    const { endpoint, keys, userAgent } = req.body

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: 'Invalid subscription data' })
      return
    }

    await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: { userId, endpoint }
      },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent ?? null,
        isActive: true,
        failureCount: 0
      },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent ?? null
      }
    })

    await prisma.user.update({
      where: { id: userId },
      data: { notificationsEnabled: true }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error subscribing to push:', error)
    res.status(500).json({ error: 'Failed to subscribe' })
  }
})

// Unsubscribe from push notifications
router.post('/unsubscribe', async (req, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user
    const { endpoint } = req.body

    if (endpoint) {
      await prisma.pushSubscription.updateMany({
        where: { userId, endpoint },
        data: { isActive: false }
      })
    } else {
      await prisma.pushSubscription.updateMany({
        where: { userId },
        data: { isActive: false }
      })
    }

    await prisma.user.update({
      where: { id: userId },
      data: { notificationsEnabled: false }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error unsubscribing from push:', error)
    res.status(500).json({ error: 'Failed to unsubscribe' })
  }
})

// Get yesterday's stats
router.get('/stats/yesterday', async (req, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user
    const stats = await getYesterdayStats(userId)
    res.json(stats)
  } catch (error) {
    console.error('Error getting yesterday stats:', error)
    res.status(500).json({ error: 'Failed to get stats' })
  }
})

// Send test notification (dev only)
router.post('/test', async (req, res: Response) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user

    await sendPushToUser(userId, {
      title: 'Test notification',
      body: 'Push notifications are working!',
      url: '/'
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error sending test push:', error)
    res.status(500).json({ error: 'Failed to send test notification' })
  }
})

export default router
