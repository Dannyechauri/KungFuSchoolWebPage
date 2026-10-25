import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { CalendarManagementPage } from '../calendar/CalendarManagementPage'
import { AppLayout } from '../../layouts/AppLayout'
import { AuthProvider } from './AuthProvider'
import { AuthContext, type AuthUser } from './authContext'

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

  it('muestra Datos al instructor, pero no Inicio', () => {
    renderLayout('INSTRUCTOR')

    expect(screen.getByRole('link', { name: /calendario/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /datos/i })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /inicio/i })).toBeNull()
  })

  it('mantiene Inicio y Datos para la única cuenta administrativa', () => {
    renderLayout('ADMIN')

    expect(screen.getByRole('link', { name: /inicio/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /datos/i })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /mi ficha/i })).toBeNull()
  })

  it('ofrece Mi ficha a alumnos e instructores', () => {
    renderLayout('USER')
    expect(screen.getByRole('link', { name: /mi ficha/i })).toBeTruthy()
    cleanup()

    renderLayout('INSTRUCTOR')
    expect(screen.getByRole('link', { name: /mi ficha/i })).toBeTruthy()
  })

  it('muestra al alumno sus datos y las formas que sabe', async () => {
    mockedFetch.mockImplementation((url: string) => {
      if (url.endsWith('/api/auth/me')) return Promise.resolve(jsonResponse(sessionFor('USER')))
      if (url.endsWith('/api/me/profile')) return Promise.resolve(jsonResponse({
        student: { id: 7, name: 'Marc Soler', enrollmentNumber: 'WS-002', email: 'marc@example.invalid', birthDate: '2001-05-09', joinedOn: '2020-09-01', active: true, isInstructor: false },
        grade: { id: 3, name: 'Cinta Verde', beltColor: 'Verde', order: 3, requiredForms: 2 },
        knownForms: [{ id: 11, name: 'Wu Bu Quan', description: 'Cinco pasos', style: 'Changquan', learnedOn: '2021-02-15' }],
        gradeForms: [
          { id: 11, name: 'Wu Bu Quan', style: 'Changquan', optional: false, known: true },
          { id: 12, name: 'Gong Li Quan', style: 'Changquan', optional: false, known: false },
        ],
        instructor: null,
      }))
      throw new Error(`Ruta inesperada en prueba: ${url}`)
    })

    render(
      <MemoryRouter initialEntries={['/mi-ficha']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Marc Soler' })).toBeTruthy()
    expect(screen.getByText('WS-002')).toBeTruthy()
    expect(screen.getByText('Aprendida el 15 de febrero de 2021')).toBeTruthy()
    expect(screen.getByText('1 de 2 obligatorias')).toBeTruthy()
    expect(screen.getByText('Pendiente')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Como instructor' })).toBeNull()
  })

  it('limita al instructor a sesiones y horarios; cursos y salas quedan para el administrador', async () => {
    mockedFetch.mockImplementation((url: string) => {
      if (url.endsWith('/api/calendar/courses')) return Promise.resolve(jsonResponse([]))
      if (url.endsWith('/api/calendar/instructors')) return Promise.resolve(jsonResponse([]))
      if (url.endsWith('/api/calendar/rooms')) return Promise.resolve(jsonResponse([]))
      if (url.endsWith('/api/calendar/recurring-rules')) return Promise.resolve(jsonResponse([]))
      throw new Error(`Ruta inesperada en prueba: ${url}`)
    })

    const renderManagement = (role: AuthUser['role']) => render(
      <MemoryRouter initialEntries={['/calendario/gestionar']}>
        <AuthContext.Provider value={{ user: sessionFor(role), isCheckingSession: false, login: async () => undefined, logout: async () => undefined }}>
          <Routes><Route path="/calendario/gestionar" element={<CalendarManagementPage />} /></Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    renderManagement('INSTRUCTOR')
    expect(await screen.findByRole('button', { name: 'Horarios habituales' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Salas' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cursos' })).toBeNull()
    cleanup()

    renderManagement('ADMIN')
    expect(await screen.findByRole('button', { name: 'Salas' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cursos' })).toBeTruthy()
  })

  it('permite al alumno entrar en la web con el calendario en solo lectura', async () => {
    mockedFetch.mockImplementation((url: string) => {
      if (url.endsWith('/api/auth/me')) return Promise.resolve(jsonResponse({ message: 'Sin sesión' }, 401))
      if (url.endsWith('/api/auth/login')) return Promise.resolve(jsonResponse(sessionFor('USER')))
      if (url.endsWith('/api/calendar/rooms')) return Promise.resolve(jsonResponse([]))
      if (url.startsWith('/api/calendar/events')) return Promise.resolve(jsonResponse([]))
      throw new Error(`Ruta inesperada en prueba: ${url}`)
    })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    await user.type(await screen.findByLabelText('Correo electrónico'), 'alumno@example.invalid')
    await user.type(screen.getByLabelText('Contraseña'), 'password-test')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByRole('heading', { name: /Agenda de clases y actividades/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Gestionar agenda' })).toBeNull()
    expect(screen.queryByRole('link', { name: /datos/i })).toBeNull()
    expect(mockedFetch.mock.calls.some(([url]) => String(url).endsWith('/api/auth/logout'))).toBe(false)
  })

  it('redirige al alumno que intenta acceder a la gestión de agenda', async () => {
    mockedFetch.mockImplementation((url: string) => {
      if (url.endsWith('/api/auth/me')) return Promise.resolve(jsonResponse(sessionFor('USER')))
      if (url.endsWith('/api/calendar/rooms')) return Promise.resolve(jsonResponse([]))
      if (url.startsWith('/api/calendar/events')) return Promise.resolve(jsonResponse([]))
      throw new Error(`Ruta inesperada en prueba: ${url}`)
    })

    render(
      <MemoryRouter initialEntries={['/calendario/gestionar']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /Agenda de clases y actividades/i })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Gestionar agenda' })).toBeNull()
  })

  it('permite al instructor acceder a la consulta de datos', async () => {
    mockedFetch.mockImplementation((url: string) => {
      if (url.endsWith('/api/auth/me')) return Promise.resolve(jsonResponse(sessionFor('INSTRUCTOR')))
      if (url.endsWith('/api/database/tables')) return Promise.resolve(jsonResponse(['alumnos', 'cursos', 'formas', 'estilos', 'cursos_agendados', 'horarios_recurrentes']))
      if (url.startsWith('/api/database/tables/')) return Promise.resolve(jsonResponse([]))
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

    expect(await screen.findByRole('heading', { name: 'Datos de la escuela' })).toBeTruthy()
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
