import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { apiRequest } from '../../api/client'
import { AuthContext, type AuthUser } from './authContext'
import { canUseWeb } from './permissions'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    let active = true

    void apiRequest<AuthUser>('/api/auth/me')
      .then((currentUser) => {
        if (!active) return
        if (canUseWeb(currentUser.role)) {
          setUser(currentUser)
          return
        }
        setUser(null)
        void apiRequest('/api/auth/logout', { method: 'DELETE' }).catch(() => undefined)
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
    if (!canUseWeb(currentUser.role)) {
      await apiRequest('/api/auth/logout', { method: 'DELETE' }).catch(() => undefined)
      throw new Error('Esta cuenta no tiene acceso a la web.')
    }
    setUser(currentUser)
  }, [])

  const logout = useCallback(async () => {
    await apiRequest('/api/auth/logout', { method: 'DELETE' })
    setUser(null)
  }, [])

  return <AuthContext.Provider value={{ user, isCheckingSession, login, logout }}>{children}</AuthContext.Provider>
}
