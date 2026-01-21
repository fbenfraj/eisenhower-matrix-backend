import OpenAI from 'openai'
import { AiScores, XpValue, validateAiScores, calculateXpFromScores, DEFAULT_AI_SCORES } from '../utils/xp'

type Quadrant = 'urgent-important' | 'not-urgent-important' | 'urgent-not-important' | 'not-urgent-not-important'
type Complexity = 'easy' | 'medium' | 'hard'
type RecurrenceUnit = 'day' | 'week' | 'month' | 'year'
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6
type LegacyRecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface RecurrenceConfig {
  interval: number
  unit: RecurrenceUnit
  weekDays?: DayOfWeek[]
  monthDay?: number
}

type TaskRecurrence = LegacyRecurrencePattern | RecurrenceConfig | null

const VALID_QUADRANTS: Quadrant[] = ['urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important']
const VALID_COMPLEXITIES: Complexity[] = ['easy', 'medium', 'hard']
const VALID_LEGACY: LegacyRecurrencePattern[] = ['daily', 'weekly', 'monthly', 'yearly']
const VALID_UNITS: RecurrenceUnit[] = ['day', 'week', 'month', 'year']

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({ apiKey })
}

const validateRecurrence = (rec: unknown): TaskRecurrence => {
  if (rec === null || rec === undefined) return null

  if (typeof rec === 'string') {
    return VALID_LEGACY.includes(rec as LegacyRecurrencePattern)
      ? rec as LegacyRecurrencePattern
      : null
  }

  if (typeof rec === 'object') {
    const config = rec as Partial<RecurrenceConfig>

    if (typeof config.interval !== 'number' || config.interval < 1) return null
    if (!VALID_UNITS.includes(config.unit as RecurrenceUnit)) return null

    const validated: RecurrenceConfig = {
      interval: Math.max(1, Math.min(99, Math.floor(config.interval))),
      unit: config.unit as RecurrenceUnit
    }

    if (Array.isArray(config.weekDays) && config.weekDays.length > 0) {
      const validDays = config.weekDays.filter(
        d => typeof d === 'number' && d >= 0 && d <= 6
      ) as DayOfWeek[]
      if (validDays.length > 0) {
        validated.weekDays = [...new Set(validDays)].sort((a, b) => a - b)
      }
    }

    if (typeof config.monthDay === 'number' && config.monthDay >= 1 && config.monthDay <= 31) {
      validated.monthDay = config.monthDay
    }

    return validated
  }

  return null
}

const buildAddTaskPrompt = (input: string): string => {
  const today = new Date()
  const todayStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return `Today's date is: ${todayStr}

Extract task details from this user input and categorize it into an Eisenhower Matrix quadrant.

User input: "${input}"

You must respond with ONLY a valid JSON object (no markdown, no explanation) with these exact fields:
{
  "title": "short task title (max 50 chars)",
  "description": "additional details or empty string if none",
  "deadline": "YYYY-MM-DD format ONLY if user explicitly mentions a date/deadline, otherwise null",
  "quadrant": "one of: urgent-important, not-urgent-important, urgent-not-important, not-urgent-not-important",
  "recurrence": <recurrence pattern - see below>,
  "complexity": "one of: easy, medium, hard",
  "futurePainScore": "float 0-1: how bad life gets if delayed (health=1.0, money=0.9, legal=0.9, admin=0.6, social=0.4, trivial=0.1)",
  "urgencyScore": "float 0-1: time pressure (overdue=1.0, today=0.9, this_week=0.7, next_week=0.4, no_deadline=0.2)",
  "frictionScore": "float 0-1: likelihood of avoidance (calling/paperwork=0.9, multi-step=0.7, simple=0.2)"
}

Quadrant rules:
- "urgent-important": Deadlines within 2 days, emergencies, crises, critical issues
- "not-urgent-important": Important goals, deadlines > 2 days away, planning, learning, health
- "urgent-not-important": Minor urgent items, some calls/emails, interruptions
- "not-urgent-not-important": Low priority, trivial tasks, entertainment, time wasters

Recurrence detection - ALWAYS use the most specific format possible:

IMPORTANT: When a specific day of the week is mentioned (Monday, Tuesday, etc.), you MUST use format #2 with weekDays array. Do NOT use format #1 for specific days.

1. Generic patterns ONLY (use ONLY when no specific day is mentioned):
   - "daily": "every day", "daily", "each day" (no specific time)
   - "weekly": "every week", "weekly" (without mentioning a specific day)
   - "monthly": "every month", "monthly" (without mentioning a specific date)
   - "yearly": "every year", "yearly", "annually"

2. Specific weekdays - USE THIS when ANY day name is mentioned (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday):
   - "every Monday" → { "interval": 1, "unit": "week", "weekDays": [1] }
   - "every Tuesday" → { "interval": 1, "unit": "week", "weekDays": [2] }
   - "every Wednesday" → { "interval": 1, "unit": "week", "weekDays": [3] }
   - "every Thursday" → { "interval": 1, "unit": "week", "weekDays": [4] }
   - "every Friday" → { "interval": 1, "unit": "week", "weekDays": [5] }
   - "every Saturday" → { "interval": 1, "unit": "week", "weekDays": [6] }
   - "every Sunday" → { "interval": 1, "unit": "week", "weekDays": [0] }
   - "every Monday and Wednesday" → { "interval": 1, "unit": "week", "weekDays": [1, 3] }
   - "every Tuesday, Thursday, Saturday" → { "interval": 1, "unit": "week", "weekDays": [2, 4, 6] }
   - "weekdays" or "every weekday" → { "interval": 1, "unit": "week", "weekDays": [1, 2, 3, 4, 5] }
   - "weekends" → { "interval": 1, "unit": "week", "weekDays": [0, 6] }

3. Custom intervals (return object):
   - "every 2 weeks" or "biweekly" → { "interval": 2, "unit": "week" }
   - "every 3 days" → { "interval": 3, "unit": "day" }
   - "every 2 months" → { "interval": 2, "unit": "month" }
   - "every other day" → { "interval": 2, "unit": "day" }

4. Specific day of month (return object with monthDay):
   - "15th of every month" → { "interval": 1, "unit": "month", "monthDay": 15 }
   - "1st of each month" → { "interval": 1, "unit": "month", "monthDay": 1 }
   - "every month on the 20th" → { "interval": 1, "unit": "month", "monthDay": 20 }

5. No recurrence: return null

Examples - pay attention to specific day handling:
- "remind me every Monday" → { "interval": 1, "unit": "week", "weekDays": [1] } (NOT "weekly"!)
- "Call mom every Sunday" → { "interval": 1, "unit": "week", "weekDays": [0] }
- "Pay rent on the 1st of every month" → { "interval": 1, "unit": "month", "monthDay": 1 }
- "Team standup every weekday" → { "interval": 1, "unit": "week", "weekDays": [1, 2, 3, 4, 5] }
- "Gym every other day" → { "interval": 2, "unit": "day" }
- "Water plants every 3 days" → { "interval": 3, "unit": "day" }
- "Biweekly payroll" → { "interval": 2, "unit": "week" }
- "Weekly review" → "weekly" (generic, no specific day mentioned)

Complexity rules:
- "easy": Quick tasks (< 15 min), simple actions, minimal thinking required
- "medium": Moderate effort (15 min - 2 hours), some planning needed
- "hard": Significant effort (> 2 hours), complex, multiple steps, deep focus required

XP Scoring rules - score practical obligations only, NOT generic self-improvement:
- futurePainScore examples: dentist=0.9, taxes=0.85, reply to email=0.3, watch movie=0.1
- urgencyScore: based on deadline proximity
- frictionScore: tasks people avoid (phone calls, paperwork) get high scores

IMPORTANT: Do NOT add a deadline unless the user explicitly mentions a specific date, time, or deadline. Recurring tasks do NOT automatically need a deadline - the recurrence pattern is sufficient.

Date interpretation (only use these if user mentions a date):
- "today" = ${today.toISOString().split('T')[0]}
- "tomorrow" = ${new Date(today.getTime() + 86400000).toISOString().split('T')[0]}
- "next week" = ${new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0]}
- "next month" = ${new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()).toISOString().split('T')[0]}

Respond with ONLY the JSON object.`
}

export interface ParsedTask {
  title: string
  description: string
  deadline: string | null
  quadrant: Quadrant
  recurrence: TaskRecurrence
  complexity: Complexity
  aiScores: AiScores
  xp: XpValue
}

export const parseTaskWithAI = async (input: string): Promise<ParsedTask> => {
  const openai = getOpenAIClient()
  const prompt = buildAddTaskPrompt(input)

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 300
  })

  const result = response.choices[0].message.content?.trim()
  if (!result) throw new Error('No response from AI')

  const parsed = JSON.parse(result) as {
    title: string
    description: string
    deadline: string | null
    quadrant: Quadrant
    recurrence: TaskRecurrence | { interval: number; unit: string; weekDays?: number[]; monthDay?: number } | null
    complexity: Complexity
    futurePainScore?: number
    urgencyScore?: number
    frictionScore?: number
  }

  const quadrant = VALID_QUADRANTS.includes(parsed.quadrant) ? parsed.quadrant : 'not-urgent-not-important'
  const recurrence = validateRecurrence(parsed.recurrence)
  const complexity = VALID_COMPLEXITIES.includes(parsed.complexity) ? parsed.complexity : 'medium'

  const rawScores = {
    futurePainScore: parsed.futurePainScore,
    urgencyScore: parsed.urgencyScore,
    frictionScore: parsed.frictionScore
  }
  const aiScores = validateAiScores(rawScores) ?? DEFAULT_AI_SCORES
  const xp = calculateXpFromScores(aiScores)

  return {
    title: parsed.title.slice(0, 100),
    description: parsed.description || '',
    deadline: parsed.deadline || null,
    quadrant,
    recurrence,
    complexity,
    aiScores,
    xp
  }
}

interface TaskForSort {
  text: string
  description?: string
  deadline?: string
  complexity?: Complexity
  recurrence?: TaskRecurrence
}

export interface SortedTask {
  text: string
  quadrant: Quadrant
  complexity: Complexity
  recurrence?: TaskRecurrence
}

export const sortTasksWithAI = async (tasks: TaskForSort[]): Promise<SortedTask[]> => {
  const openai = getOpenAIClient()

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const taskDescriptions = tasks.map(task => {
    let desc = `Task: ${task.text}`
    if (task.description) desc += `\nDescription: ${task.description}`
    if (task.deadline) desc += `\nDeadline: ${task.deadline}`
    if (task.complexity) desc += `\nCurrent complexity: ${task.complexity}`
    if (task.recurrence) desc += `\nCurrent recurrence: ${JSON.stringify(task.recurrence)}`
    return desc
  }).join('\n\n')

  const prompt = `Today's date is: ${today}

You are helping categorize tasks into an Eisenhower Matrix. The matrix has 4 quadrants:
1. "urgent-important": Tasks that are both urgent and important (Do First) - deadlines today/this week, emergencies, critical issues
2. "not-urgent-important": Tasks that are important but not urgent (Schedule) - long-term goals, future deadlines, strategic work
3. "urgent-not-important": Tasks that are urgent but not important (Delegate) - interruptions, some meetings, non-critical urgent items
4. "not-urgent-not-important": Tasks that are neither urgent nor important (Don't Do) - time wasters, trivial tasks

Consider deadlines when categorizing:
- Tasks with deadlines today or this week are typically urgent
- Tasks with deadlines next month or later are typically not urgent
- Tasks without deadlines should be judged on their inherent urgency and importance

Complexity rules:
- "easy": Quick tasks (< 15 min), simple actions, minimal thinking required
- "medium": Moderate effort (15 min - 2 hours), some planning needed
- "hard": Significant effort (> 2 hours), complex, multiple steps, deep focus required

Recurrence detection - ALWAYS use the most specific format possible:
IMPORTANT: When a specific day of the week is mentioned (Monday, Tuesday, etc.), you MUST use the weekDays format. Do NOT use "weekly" for specific days.

1. Generic patterns ONLY (use ONLY when no specific day is mentioned): "daily", "weekly", "monthly", "yearly"
2. Specific weekdays - USE THIS when ANY day name is mentioned (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday):
   - "every Monday" → { "interval": 1, "unit": "week", "weekDays": [1] } (NOT "weekly"!)
   - "every Tuesday" → { "interval": 1, "unit": "week", "weekDays": [2] }
   - "every Monday and Wednesday" → { "interval": 1, "unit": "week", "weekDays": [1, 3] }
   - "weekdays" → { "interval": 1, "unit": "week", "weekDays": [1, 2, 3, 4, 5] }
   - "weekends" → { "interval": 1, "unit": "week", "weekDays": [0, 6] }
3. Custom intervals: { "interval": 2, "unit": "week" } for "every 2 weeks", etc.
4. Specific day of month: { "interval": 1, "unit": "month", "monthDay": 15 } for "15th of every month"
5. No recurrence detected: return null

Here are the tasks to categorize:
${taskDescriptions}

For each task, determine which quadrant it belongs to, assess its complexity, and detect any recurrence pattern from the task text/description. Respond with a JSON array where each element has:
- "text": the exact task text (match it precisely)
- "quadrant": one of "urgent-important", "not-urgent-important", "urgent-not-important", or "not-urgent-not-important"
- "complexity": one of "easy", "medium", or "hard"
- "recurrence": recurrence pattern (string, object, or null) - only set if detected in task text/description, otherwise keep existing or null

Only respond with the JSON array, nothing else.`

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  })

  const result = response.choices[0].message.content
  if (!result) throw new Error('No response from AI')

  const categorizedTasks = JSON.parse(result) as SortedTask[]

  return categorizedTasks.map(t => ({
    ...t,
    recurrence: validateRecurrence(t.recurrence)
  }))
}
