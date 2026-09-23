import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { apiRequest } from '../../api/client'
import { AuthContext, type AuthUser } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    let active = true

    void apiRequest<AuthUser>('/api/auth/me')
      .then((currentUser) => {
        if (active) setUser(currentUser)
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setIsCheckingSession(false)
      })

    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const currentUser = await apiRequest<AuthUser>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setUser(currentUser)
  }, [])

  const logout = useCallback(async () => {
    await apiRequest('/api/auth/logout', { method: 'DELETE' })
    setUser(null)
  }, [])

  return <AuthContext.Provider value={{ user, isCheckingSession, login, logout }}>{children}</AuthContext.Provider>
}
