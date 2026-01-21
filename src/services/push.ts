import webpush from 'web-push'
import { prisma } from '../db'

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export interface YesterdayStats {
  yesterdayCount: number
  yesterdayXp: number
  doCount: number
}

export async function getYesterdayStats(userId: number): Promise<YesterdayStats> {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)

  const yesterdayTasks = await prisma.task.findMany({
    where: {
      userId,
      completed: true,
      completedAt: {
        gte: yesterdayStart,
        lt: todayStart
      }
    },
    select: { xp: true }
  })

  const doTasks = await prisma.task.count({
    where: {
      userId,
      completed: false,
      quadrant: 'URGENT_IMPORTANT'
    }
  })

  return {
    yesterdayCount: yesterdayTasks.length,
    yesterdayXp: yesterdayTasks.reduce((sum, t) => sum + (t.xp || 0), 0),
    doCount: doTasks
  }
}

export interface PushPayload {
  title: string
  body: string
  url?: string
}

export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId, isActive: true }
  })

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        },
        JSON.stringify(payload)
      )

      await prisma.pushSubscription.update({
        where: { id: sub.id },
        data: { lastSuccessAt: new Date(), failureCount: 0 }
      })
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode

      if (statusCode === 410 || statusCode === 404) {
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { isActive: false }
        })
      } else {
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: {
            lastFailureAt: new Date(),
            failureCount: { increment: 1 }
          }
        })
      }
    }
  }
}

export async function sendDailyReminder(userId: number): Promise<void> {
  const stats = await getYesterdayStats(userId)

  let body: string
  if (stats.doCount > 0) {
    body = `${stats.doCount} DO task${stats.doCount > 1 ? 's' : ''}. Yesterday: +${stats.yesterdayXp} XP. Open the matrix.`
  } else {
    body = 'No DO tasks. Open to clear noise.'
  }

  await sendPushToUser(userId, {
    title: "Today's pressure",
    body,
    url: '/'
  })
}
