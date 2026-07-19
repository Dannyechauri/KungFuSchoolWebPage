import { createContext, useContext } from 'react'
import type { AuthSession } from '../../api/databaseApi'

type AuthContextValue = {
  session: AuthSession
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth debe usarse dentro de AuthGate')
  }
  return value
}
