import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthUser } from '../auth/authContext'
import { CalendarPage } from './CalendarPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function NavigationState() {
  const location = useLocation()
  return <output data-testid="navigation-state">{JSON.stringify(location.state)}</output>
}

function renderCalendar(role: AuthUser['role']) {
  const user: AuthUser = { authenticated: true, role, userId: 7, displayName: `Cuenta ${role}` }
  return render(
    <AuthContext.Provider value={{ user, isCheckingSession: false, login: async () => undefined, logout: async () => undefined }}>
      <MemoryRouter initialEntries={['/calendario']}>
        <Routes>
          <Route path="/calendario" element={<CalendarPage />} />
          <Route path="/calendario/gestionar" element={<NavigationState />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('CalendarPage', () => {
  it('abre la creación al hacer clic en un hueco libre y conserva día y hora', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/calendar/rooms') return jsonResponse([{ id_sala: 3, nombre: 'Sala Multiusos', activo: true }])
      if (url.startsWith('/api/calendar/events?')) return jsonResponse([])
      throw new Error(`Ruta inesperada: ${url}`)
    }))
    const user = userEvent.setup()
    renderCalendar('ADMIN')

    const availableSlots = await screen.findAllByRole('button', { name: /Crear actividad el .* a las 18:30/u }, { timeout: 3000 })
    await user.click(availableSlots[0]!)

    const state = JSON.parse(screen.getByTestId('navigation-state').textContent ?? '{}') as { createEventAt: string }
    expect(state.createEventAt).toMatch(/^\d{4}-\d{2}-\d{2}T18:30$/u)
  })

  it('no ofrece huecos de creación a los alumnos', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/calendar/rooms') return jsonResponse([{ id_sala: 3, nombre: 'Sala Multiusos', activo: true }])
      if (url.startsWith('/api/calendar/events?')) return jsonResponse([])
      throw new Error(`Ruta inesperada: ${url}`)
    }))
    renderCalendar('USER')

    await screen.findByRole('heading', { name: 'Horario semanal' })
    expect(screen.queryByRole('button', { name: /Crear actividad el .* a las/u })).toBeNull()
  })
})