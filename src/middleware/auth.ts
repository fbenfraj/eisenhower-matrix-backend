import { Request, Response, NextFunction } from 'express'
import { verifyToken, AuthPayload } from '../services/auth'

export interface AuthenticatedRequest<P = Record<string, string>> extends Request<P> {
  user: AuthPayload
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const token = authHeader.slice(7)
  try {
    const payload = verifyToken(token)
    ;(req as AuthenticatedRequest).user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
