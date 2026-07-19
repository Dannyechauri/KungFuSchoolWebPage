import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ApiError, authApi, type AuthSession } from '../../api/databaseApi'
import { AuthContext } from './authContext'

const DEMO_EMAIL =
  import.meta.env.VITE_DEMO_ADMIN_EMAIL ?? 'admin.demo@iwushu.local'
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_ADMIN_PASSWORD ?? 'password'

type AuthGateProps = {
  children: ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [email, setEmail] = useState(DEMO_EMAIL)
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    authApi
      .me()
      .then((currentSession) => {
        if (mounted) {
          setSession(currentSession)
        }
      })
      .catch(() => {
        if (mounted) {
          setSession(null)
        }
      })
      .finally(() => {
        if (mounted) {
          setIsCheckingSession(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const nextSession = await authApi.login(email, password)
      setSession(nextSession)
    } catch (loginError) {
      const message =
        loginError instanceof ApiError
          ? loginError.message
          : 'No se ha podido iniciar sesión.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleLogout() {
    await authApi.logout()
    setSession(null)
    setPassword(DEMO_PASSWORD)
  }

  const contextValue = useMemo(
    () => (session ? { session, logout: handleLogout } : null),
    [session],
  )

  if (isCheckingSession) {
    return (
      <div className="auth-shell">
        <div className="skeleton auth-card-skeleton" />
      </div>
    )
  }

  if (session) {
    return (
      <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
    )
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <img
          className="auth-logo"
          src="/logo-instituto-wushu.png"
          alt="Escudo del Instituto de Wu-shu"
        />
        <p className="page-kicker">Gestión interna</p>
        <h1>Acceso del administrador</h1>
        <p>
          El backend actual requiere sesión para consultar y modificar datos. Para
          desarrollo local se crea un administrador demo automáticamente.
        </p>

        <label>
          <span>Correo</span>
          <input
            autoComplete="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label>
          <span>Contraseña</span>
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error ? <p className="auth-error">{error}</p> : null}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
