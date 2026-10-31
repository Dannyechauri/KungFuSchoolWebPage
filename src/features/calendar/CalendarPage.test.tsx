import { cleanup, render, screen, waitFor } from '@testing-library/react'
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

const noEventNotifications = { requests: [], responses: [] }

function weekEvent(from: string, id: number, name: string, hour: number, canModify: boolean) {
  const time = (value: number) => `${from}T${String(value).padStart(2, '0')}:00:00`
  return {
    id_curso_agendado: id, id_curso: id, id_instructor: 2, id_sala: null,
    fecha_hora: time(hour), fecha_hora_fin: time(hour + 1), activo: true, id_horario_recurrente: null,
    modificado_manualmente: false, estado_instructor: 'ACEPTADO', puede_modificar: canModify,
    curso_nombre: name, curso_tema: 'Técnica', curso_descripcion: null, tipo_curso: 'HABITUAL',
    instructor_nombre: 'Instructor 2', sala_nombre: null, limite_participantes: null, mostrar_asistentes: false,
    asistentes: null, completo: false, mi_participacion: null,
  }
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
      if (url === '/api/calendar/event-notifications') return jsonResponse(noEventNotifications)
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
      if (url === '/api/calendar/event-notifications') return jsonResponse(noEventNotifications)
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

  it.each([['Aceptar', 'ACEPTADO'], ['Rechazar', 'RECHAZADO']] as const)('envía la respuesta «%s» del instructor y retira la solicitud', async (label, decision) => {
    const notifications = {
      requests: [{
        id_curso_agendado: 28, curso_nombre: 'Curso especial', fecha_hora: '2095-10-16T18:00:00',
        fecha_hora_fin: '2095-10-16T19:00:00', sala_nombre: 'Sala Principal', descripcion: null, organizador_nombre: 'Administración',
      }],
      responses: [],
    }
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/calendar/rooms') return jsonResponse([])
      if (url.startsWith('/api/calendar/events?')) return jsonResponse([])
      if (url === '/api/calendar/cancellation-notifications') return jsonResponse([])
      if (url === '/api/calendar/event-notifications') return jsonResponse(notifications)
      if (url === '/api/calendar/event-requests/28/respond' && init?.method === 'POST') {
        notifications.requests = []
        return jsonResponse({ id_curso_agendado: 28, decision })
      }
      throw new Error(`Ruta inesperada: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderCalendar('INSTRUCTOR', 2)

    expect(await screen.findByText('Solicitud como instructor')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: label }))

    await waitFor(() => expect(screen.queryByText('Solicitud como instructor')).toBeNull())
    expect(fetchMock).toHaveBeenCalledWith('/api/calendar/event-requests/28/respond', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ decision }),
    }))
  })

  it('muestra al organizador la respuesta del instructor hasta que la confirma', async () => {
    const notifications = {
      requests: [],
      responses: [{
        id_aviso: 5, decision: 'RECHAZADO', curso_nombre: 'Curso especial', instructor_nombre: 'Chen Wei',
        fecha_hora: '2095-10-16T18:00:00', fecha_hora_fin: '2095-10-16T19:00:00', sala_nombre: null,
      }],
    }
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/calendar/rooms') return jsonResponse([])
      if (url.startsWith('/api/calendar/events?')) return jsonResponse([])
      if (url === '/api/calendar/cancellation-notifications') return jsonResponse([])
      if (url === '/api/calendar/event-notifications') return jsonResponse(notifications)
      if (url === '/api/calendar/event-notifications/5/acknowledge' && init?.method === 'POST') {
        notifications.responses = []
        return jsonResponse({ acknowledged: true })
      }
      throw new Error(`Ruta inesperada: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderCalendar('ADMIN')

    expect(await screen.findByText('Actividad rechazada')).toBeTruthy()
    expect(screen.getByText(/Chen Wei ha rechazado la actividad y se ha eliminado/u)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Confirmar que lo vi' }))

    await waitFor(() => expect(screen.queryByText('Actividad rechazada')).toBeNull())
    expect(fetchMock).toHaveBeenCalledWith('/api/calendar/event-notifications/5/acknowledge', expect.objectContaining({ method: 'POST' }))
  })

  it('solo ofrece editar las sesiones que el usuario puede modificar', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/calendar/rooms') return jsonResponse([])
      if (url === '/api/calendar/cancellation-notifications') return jsonResponse([])
      if (url === '/api/calendar/event-notifications') return jsonResponse(noEventNotifications)
      if (/\/api\/calendar\/events\/\d+\/participants$/u.test(url)) return jsonResponse([])
      if (url.startsWith('/api/calendar/events?')) {
        const from = new URL(url, 'http://localhost').searchParams.get('from')?.slice(0, 10) ?? '2026-10-26'
        return jsonResponse([weekEvent(from, 1, 'Clase propia', 18, true), weekEvent(from, 2, 'Clase ajena', 20, false)])
      }
      throw new Error(`Ruta inesperada: ${url}`)
    }))
    const user = userEvent.setup()
    renderCalendar('INSTRUCTOR', 2)

    await user.click(await screen.findByRole('button', { name: /Clase propia/u }, { timeout: 3000 }))
    expect(screen.getByRole('button', { name: 'Editar sesión' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))

    await user.click(screen.getByRole('button', { name: /Clase ajena/u }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Editar sesión' })).toBeNull()
  })

  it('oculta la descripción hasta pulsar el botón y la vuelve a ocultar al pulsarlo de nuevo', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/calendar/rooms') return jsonResponse([])
      if (url === '/api/calendar/cancellation-notifications') return jsonResponse([])
      if (url === '/api/calendar/event-notifications') return jsonResponse(noEventNotifications)
      if (/\/api\/calendar\/events\/\d+\/participants$/u.test(url)) return jsonResponse([])
      if (url.startsWith('/api/calendar/events?')) {
        const from = new URL(url, 'http://localhost').searchParams.get('from')?.slice(0, 10) ?? '2026-10-26'
        return jsonResponse([{ ...weekEvent(from, 1, 'Clase con detalle', 18, false), descripcion: 'Traer ropa de entrenamiento', curso_descripcion: 'Formas básicas del estilo' }])
      }
      throw new Error(`Ruta inesperada: ${url}`)
    }))
    const user = userEvent.setup()
    renderCalendar('USER')

    await user.click(await screen.findByRole('button', { name: /Clase con detalle/u }, { timeout: 3000 }))
    const toggle = await screen.findByRole('button', { name: 'Descripción' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Traer ropa de entrenamiento')).toBeNull()

    await user.click(toggle)
    expect(screen.getByText('Traer ropa de entrenamiento')).toBeTruthy()
    expect(screen.getByText('Formas básicas del estilo')).toBeTruthy()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    await user.click(toggle)
    expect(screen.queryByText('Traer ropa de entrenamiento')).toBeNull()
    expect(screen.queryByText('Formas básicas del estilo')).toBeNull()
  })

  it('no muestra el botón de descripción cuando la actividad no tiene ninguna', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/calendar/rooms') return jsonResponse([])
      if (url === '/api/calendar/cancellation-notifications') return jsonResponse([])
      if (url === '/api/calendar/event-notifications') return jsonResponse(noEventNotifications)
      if (/\/api\/calendar\/events\/\d+\/participants$/u.test(url)) return jsonResponse([])
      if (url.startsWith('/api/calendar/events?')) {
        const from = new URL(url, 'http://localhost').searchParams.get('from')?.slice(0, 10) ?? '2026-10-26'
        return jsonResponse([weekEvent(from, 1, 'Clase sin detalle', 18, false)])
      }
      throw new Error(`Ruta inesperada: ${url}`)
    }))
    const user = userEvent.setup()
    renderCalendar('USER')

    await user.click(await screen.findByRole('button', { name: /Clase sin detalle/u }, { timeout: 3000 }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Descripción' })).toBeNull()
  })

  it('permite al administrador eliminar una actividad cancelada y a nadie más', async () => {
    let cancelledStillExists = true
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/calendar/rooms') return jsonResponse([])
      if (url === '/api/calendar/cancellation-notifications') return jsonResponse([])
      if (url === '/api/calendar/event-notifications') return jsonResponse(noEventNotifications)
      if (/\/api\/calendar\/events\/\d+\/participants$/u.test(url)) return jsonResponse([])
      if (url === '/api/calendar/events/1' && init?.method === 'DELETE') {
        cancelledStillExists = false
        return jsonResponse({ id_curso_agendado: 1, deleted: true })
      }
      if (url.startsWith('/api/calendar/events?')) {
        const from = new URL(url, 'http://localhost').searchParams.get('from')?.slice(0, 10) ?? '2026-10-26'
        return jsonResponse([
          ...(cancelledStillExists ? [{ ...weekEvent(from, 1, 'Clase cancelada', 18, true), activo: false }] : []),
          weekEvent(from, 2, 'Clase activa', 20, true),
        ])
      }
      throw new Error(`Ruta inesperada: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderCalendar('ADMIN')

    await user.click(await screen.findByRole('button', { name: /Clase activa/u }, { timeout: 3000 }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Eliminar actividad' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))

    await user.click(screen.getByRole('button', { name: /Clase cancelada/u }))
    await user.click(await screen.findByRole('button', { name: 'Eliminar actividad' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: /Clase cancelada/u })).toBeNull())
    expect(fetchMock).toHaveBeenCalledWith('/api/calendar/events/1', expect.objectContaining({ method: 'DELETE' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('no ofrece eliminar actividades canceladas a un instructor', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/calendar/rooms') return jsonResponse([])
      if (url === '/api/calendar/cancellation-notifications') return jsonResponse([])
      if (url === '/api/calendar/event-notifications') return jsonResponse(noEventNotifications)
      if (/\/api\/calendar\/events\/\d+\/participants$/u.test(url)) return jsonResponse([])
      if (url.startsWith('/api/calendar/events?')) {
        const from = new URL(url, 'http://localhost').searchParams.get('from')?.slice(0, 10) ?? '2026-10-26'
        return jsonResponse([{ ...weekEvent(from, 1, 'Clase cancelada', 18, true), activo: false }])
      }
      throw new Error(`Ruta inesperada: ${url}`)
    }))
    const user = userEvent.setup()
    renderCalendar('INSTRUCTOR', 2)

    await user.click(await screen.findByRole('button', { name: /Clase cancelada/u }, { timeout: 3000 }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Eliminar actividad' })).toBeNull()
  })

  it('abre la creación al hacer clic en un hueco libre y conserva día y hora', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/calendar/rooms') return jsonResponse([{ id_sala: 3, nombre: 'Sala Multiusos', activo: true }])
      if (url === '/api/calendar/cancellation-notifications') return jsonResponse([])
      if (url === '/api/calendar/event-notifications') return jsonResponse(noEventNotifications)
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
      if (url === '/api/calendar/event-notifications') return jsonResponse(noEventNotifications)
      if (url.startsWith('/api/calendar/events?')) return jsonResponse([])
      throw new Error(`Ruta inesperada: ${url}`)
    }))
    renderCalendar('USER')

    await screen.findByRole('heading', { name: 'Horario semanal' })
    expect(screen.queryByRole('button', { name: /Crear actividad el .* a las/u })).toBeNull()
  })
})