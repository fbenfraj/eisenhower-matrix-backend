import cron from 'node-cron'
import { prisma } from '../db'
import { sendDailyReminder } from './push'

function getCurrentTimeInTimezone(timezone: string): string {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    return formatter.format(now)
  } catch {
    return new Date().toTimeString().slice(0, 5)
  }
}

async function processScheduledNotifications(): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      notificationsEnabled: true,
      pushSubscriptions: {
        some: { isActive: true }
      }
    },
    select: {
      id: true,
      reminderTime: true,
      timezone: true
    }
  })

  for (const user of users) {
    const currentTime = getCurrentTimeInTimezone(user.timezone)

    if (currentTime === user.reminderTime) {
      try {
        await sendDailyReminder(user.id)
        console.log(`[Scheduler] Sent daily reminder to user ${user.id}`)
      } catch (error) {
        console.error(`[Scheduler] Failed to send reminder to user ${user.id}:`, error)
      }
    }
  }
}

export function startScheduler(): void {
  // Run every minute to check for users whose reminder time matches
  cron.schedule('* * * * *', async () => {
    try {
      await processScheduledNotifications()
    } catch (error) {
      console.error('[Scheduler] Error processing notifications:', error)
    }
  })

  console.log('[Scheduler] Push notification scheduler started')
}
