import { createContext } from 'react'

export type AuthUser = {
  authenticated: true
  role: 'ADMIN' | 'USER'
  userId: number
  displayName: string
  studentId?: number | null
  instructorId?: number | null
}

export type AuthContextValue = {
  user: AuthUser | null
  isCheckingSession: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
