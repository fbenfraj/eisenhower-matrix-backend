import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { prisma } from '../db'

const SALT_ROUNDS = 10
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const JWT_EXPIRES_IN = '7d'

export interface AuthPayload {
  userId: number
  email: string
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash)
}

export const generateToken = (payload: AuthPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export const verifyToken = (token: string): AuthPayload => {
  return jwt.verify(token, JWT_SECRET) as AuthPayload
}

export const registerUser = async (email: string, password: string) => {
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    throw new Error('Email already registered')
  }

  const hashedPassword = await hashPassword(password)
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword
    }
  })

  const token = generateToken({ userId: user.id, email: user.email })
  return { user: { id: user.id, email: user.email }, token }
}

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    throw new Error('Invalid email or password')
  }

  const isValid = await verifyPassword(password, user.password)
  if (!isValid) {
    throw new Error('Invalid email or password')
  }

  const token = generateToken({ userId: user.id, email: user.email })
  return { user: { id: user.id, email: user.email }, token }
}
