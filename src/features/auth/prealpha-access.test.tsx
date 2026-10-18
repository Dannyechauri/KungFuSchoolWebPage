import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { CalendarManagementPage } from '../calendar/CalendarManagementPage'
import { AppLayout } from '../../layouts/AppLayout'
import { AuthProvider } from './AuthProvider'
import { AuthContext, type AuthUser } from './authContext'
import { LoginPage } from './LoginPage'

const mockedFetch = vi.fn()

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function sessionFor(role: AuthUser['role']): AuthUser {
  return { authenticated: true, role, userId: 7, displayName: `Cuenta ${role}` }
}

function renderLayout(role: AuthUser['role']) {
  const user = sessionFor(role)
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user, isCheckingSession: false, login: async () => undefined, logout: async () => undefined }}>
        <AppLayout />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('acceso de prealfa en la web', () => {
  beforeEach(() => {
    mockedFetch.mockReset()
    vi.stubGlobal('fetch', mockedFetch)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('muestra al instructor solo la navegación de agenda, sin Inicio ni Datos', () => {
    renderLayout('INSTRUCTOR')

    expect(screen.getByRole('link', { name: /calendario/i })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /datos/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /inicio/i })).toBeNull()
  })

  it('mantiene Inicio y Datos para la única cuenta administrativa', () => {
    renderLayout('ADMIN')

    expect(screen.getByRole('link', { name: /inicio/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /datos/i })).toBeTruthy()
  })

  it('permite al equipo docente gestionar las salas desde la gestión del calendario', async () => {
    mockedFetch.mockImplementation((url: string) => {
      if (url.endsWith('/api/calendar/courses')) return Promise.resolve(jsonResponse([]))
      if (url.endsWith('/api/calendar/instructors')) return Promise.resolve(jsonResponse([]))
      if (url.endsWith('/api/calendar/rooms')) return Promise.resolve(jsonResponse([]))
      if (url.endsWith('/api/calendar/recurring-rules')) return Promise.resolve(jsonResponse([]))
      throw new Error(`Ruta inesperada en prueba: ${url}`)
    })
    const user = sessionFor('INSTRUCTOR')

    render(
      <MemoryRouter initialEntries={['/calendario/gestionar']}>
        <AuthContext.Provider value={{ user, isCheckingSession: false, login: async () => undefined, logout: async () => undefined }}>
          <Routes><Route path="/calendario/gestionar" element={<CalendarManagementPage />} /></Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: 'Salas' })).toBeTruthy()
  })

  it('rechaza USER en la web e invalida la sesión web recién creada', async () => {
    mockedFetch.mockImplementation((url: string) => {
      if (url.endsWith('/api/auth/me')) return Promise.resolve(jsonResponse({ message: 'Sin sesión' }, 401))
      if (url.endsWith('/api/auth/login')) return Promise.resolve(jsonResponse(sessionFor('USER')))
      if (url.endsWith('/api/auth/logout')) return Promise.resolve(jsonResponse({ authenticated: false }))
      throw new Error(`Ruta inesperada en prueba: ${url}`)
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('Correo electrónico'), 'alumno@example.invalid')
    await user.type(screen.getByLabelText('Contraseña'), 'password-test')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText(/La web está reservada/i)).toBeTruthy()
    await waitFor(() => expect(mockedFetch.mock.calls.some(([url]) => String(url).endsWith('/api/auth/logout'))).toBe(true))
  })

  it('cierra la sesión web cuando /api/auth/me devuelve USER', async () => {
    mockedFetch.mockImplementation((url: string) => {
      if (url.endsWith('/api/auth/me')) return Promise.resolve(jsonResponse(sessionFor('USER')))
      if (url.endsWith('/api/auth/logout')) return Promise.resolve(jsonResponse({ authenticated: false }))
      throw new Error(`Ruta inesperada en prueba: ${url}`)
    })

    render(
      <MemoryRouter initialEntries={['/calendario']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(mockedFetch.mock.calls.some(([url]) => String(url).endsWith('/api/auth/logout'))).toBe(true))
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeTruthy()
  })

  it('redirige al instructor que intenta acceder a /datos', async () => {
    mockedFetch.mockImplementation((url: string) => {
      if (url.endsWith('/api/auth/me')) return Promise.resolve(jsonResponse(sessionFor('INSTRUCTOR')))
      if (url.endsWith('/api/calendar/rooms')) return Promise.resolve(jsonResponse([]))
      if (url.startsWith('/api/calendar/events')) return Promise.resolve(jsonResponse([]))
      throw new Error(`Ruta inesperada en prueba: ${url}`)
    })

    render(
      <MemoryRouter initialEntries={['/datos']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /Agenda de clases y actividades/i })).toBeTruthy()
  })

  it('redirige a /calendario cuando un usuario sin sesión accede a /calendario/gestionar', async () => {
    mockedFetch.mockImplementation((url: string) => {
      if (url.endsWith('/api/auth/me')) return Promise.resolve(jsonResponse({ message: 'Sin sesión' }, 401))
      throw new Error(`Ruta inesperada en prueba: ${url}`)
    })

    render(
      <MemoryRouter initialEntries={['/calendario/gestionar']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeTruthy()
  })
})
