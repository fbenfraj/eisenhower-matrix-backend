import { Router, Request, Response } from 'express'
import { registerUser, loginUser } from '../services/auth'

const router = Router()

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email is required' })
      return
    }

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Invalid email format' })
      return
    }

    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: 'Password is required' })
      return
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' })
      return
    }

    const result = await registerUser(email, password)
    res.status(201).json(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Email already registered') {
      res.status(409).json({ error: error.message })
      return
    }
    console.error('Registration error:', error)
    res.status(500).json({ error: 'Registration failed' })
  }
})

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email is required' })
      return
    }

    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: 'Password is required' })
      return
    }

    const result = await loginUser(email, password)
    res.json(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid email or password') {
      res.status(401).json({ error: error.message })
      return
    }
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

export default router
