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

function renderCalendar(role: AuthUser['role'], instructorId?: number) {
  const user: AuthUser = { authenticated: true, role, userId: 7, displayName: `Cuenta ${role}`, studentId: role === 'ADMIN' ? null : 7, instructorId }
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
  it('remarca los eventos del instructor actual y deja intactos los demás', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/calendar/rooms') return jsonResponse([])
      if (url === '/api/calendar/cancellation-notifications') return jsonResponse([])
      if (url.startsWith('/api/calendar/events?')) {
        const from = new URL(url, 'http://localhost').searchParams.get('from')?.slice(0, 10) ?? '2026-10-26'
        return jsonResponse([2, 3].map((id_instructor, index) => ({
          id_curso_agendado: index + 1,
          id_curso: index + 1,
          id_instructor,
          id_sala: null,
          fecha_hora: `${from}T18:00:00`,
          fecha_hora_fin: `${from}T19:00:00`,
          activo: true,
          id_horario_recurrente: null,
          modificado_manualmente: false,
          curso_nombre: `Clase ${id_instructor}`,
          curso_tema: 'Técnica',
          curso_descripcion: null,
          tipo_curso: 'HABITUAL',
          instructor_nombre: `Instructor ${id_instructor}`,
          sala_nombre: null,
          limite_participantes: null,
          mostrar_asistentes: false,
          asistentes: null,
          completo: false,
          mi_participacion: null,
        })))
      }
      throw new Error(`Ruta inesperada: ${url}`)
    }))
    renderCalendar('INSTRUCTOR', 2)

    const assignedEvent = await screen.findByRole('button', { name: /Clase 2/u }, { timeout: 3000 })
    const otherEvent = screen.getByRole('button', { name: /Clase 3/u })
    expect(assignedEvent.className).toContain('ring-2')
    expect(otherEvent.className).not.toContain('ring-2')
  })

  it('muestra el aviso de cancelación hasta que la cuenta confirma que lo vio', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/calendar/rooms') return jsonResponse([])
      if (url.startsWith('/api/calendar/events?')) return jsonResponse([])
      if (url === '/api/calendar/cancellation-notifications') return jsonResponse([{
        id_aviso: 12,
        id_curso_agendado: 28,
        curso_nombre: 'Curso especial',
        fecha_hora: '2095-10-16T18:00:00',
        fecha_hora_fin: '2095-10-16T19:00:00',
        sala_nombre: 'Sala Principal',
      }])
      if (url === '/api/calendar/cancellation-notifications/12/acknowledge' && init?.method === 'POST') {
        return jsonResponse({ acknowledged: true })
      }
      throw new Error(`Ruta inesperada: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderCalendar('USER')

    await screen.findByText('Curso especial')
    await user.click(screen.getByRole('button', { name: 'Confirmar que la vi' }))

    expect(screen.queryByRole('region', { name: 'Avisos de sesiones canceladas' })).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/calendar/cancellation-notifications/12/acknowledge', expect.objectContaining({ method: 'POST' }))
  })

  it('abre la creación al hacer clic en un hueco libre y conserva día y hora', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/calendar/rooms') return jsonResponse([{ id_sala: 3, nombre: 'Sala Multiusos', activo: true }])
      if (url === '/api/calendar/cancellation-notifications') return jsonResponse([])
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
      if (url === '/api/calendar/cancellation-notifications') return jsonResponse([])
      if (url.startsWith('/api/calendar/events?')) return jsonResponse([])
      throw new Error(`Ruta inesperada: ${url}`)
    }))
    renderCalendar('USER')

    await screen.findByRole('heading', { name: 'Horario semanal' })
    expect(screen.queryByRole('button', { name: /Crear actividad el .* a las/u })).toBeNull()
  })
})