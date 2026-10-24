import { Navigate } from 'react-router'
import { useAuth } from './useAuth'
import type { WebRole } from './authContext'
import { canManageCalendar, canManageSchoolData, hasOwnProfile } from './permissions'

type ProtectedRouteProps = {
  required: WebRole | 'calendar' | 'profile'
  children: React.ReactNode
}

export function ProtectedRoute({ required, children }: ProtectedRouteProps) {
  const { user, isCheckingSession } = useAuth()

  if (isCheckingSession) {
    return <main className="grid min-h-screen place-items-center text-muted">Comprobando sesión…</main>
  }

  if (!user) return <Navigate to="/" replace />

  const allowed =
    required === 'calendar'
      ? canManageCalendar(user.role)
      : required === 'profile'
        ? hasOwnProfile(user.role)
        : required === 'ADMIN'
        ? canManageSchoolData(user.role)
        : user.role === required

  if (!allowed) return <Navigate to="/calendario" replace />

  return <>{children}</>
}
