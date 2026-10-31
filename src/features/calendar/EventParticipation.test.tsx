import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEvent } from './calendarApi'
import { EventParticipation } from './EventParticipation'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const baseEvent: CalendarEvent = {
  id_curso_agendado: 40,
  id_curso: 1,
  id_instructor: 2,
  id_sala: 3,
  fecha_hora: '2093-03-03T18:00:00',
  fecha_hora_fin: '2093-03-03T19:00:00',
  activo: true,
  id_horario_recurrente: 7,
  modificado_manualmente: false,
  estado_instructor: 'ACEPTADO',
  puede_modificar: true,
  curso_nombre: 'Wushu infantil',
  curso_tema: 'Base',
  curso_descripcion: null,
  tipo_curso: 'HABITUAL',
  instructor_nombre: 'Chen Wei',
  sala_nombre: 'Sala Multiusos',
  limite_participantes: 10,
  mostrar_asistentes: true,
  asistentes: { alumnos: 4, instructores: 1 },
  completo: false,
  mi_participacion: null,
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

describe('EventParticipation', () => {
  it('apunta a un instructor a toda la serie como instructor', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ joined: [40, 41], skipped: ['2093-03-17'] }))
    vi.stubGlobal('fetch', fetchMock)
    const onChanged = vi.fn()
    const user = userEvent.setup()

    render(<EventParticipation event={baseEvent} canParticipate canChooseInstructorRole canSeeParticipants={false} hasStarted={false} onChanged={onChanged} />)

    expect(screen.getByText('4 / 10 plazas ocupadas · 1 instructor')).toBeTruthy()
    await user.click(screen.getByLabelText('Toda la serie'))
    await user.click(screen.getByLabelText('Instructor'))
    await user.click(screen.getByRole('button', { name: 'Apuntarme' }))

    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith('/api/calendar/events/40/participation', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ scope: 'series', role: 'INSTRUCTOR' }),
    }))
    expect(screen.getByRole('status').textContent).toContain('2 fechas de la serie')
    expect(screen.getByRole('status').textContent).toContain('Sin plaza')
  })

  it('oculta el número a los alumnos y permite quitarse de un día o de la serie', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ scope: 'occurrence', removed: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    const event = { ...baseEvent, mostrar_asistentes: false, asistentes: null, completo: true, mi_participacion: { rol: 'ALUMNO' as const, serie: true } }

    render(<EventParticipation event={event} canParticipate canChooseInstructorRole={false} canSeeParticipants={false} hasStarted={false} onChanged={vi.fn()} />)

    expect(screen.getByText('Plazas completas')).toBeTruthy()
    expect(screen.getByText(/a toda la serie/u)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Quitarme de la serie' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Quitarme de este día' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/calendar/events/40/participation?scope=occurrence', expect.objectContaining({ method: 'DELETE' })))
  })

  it('muestra la lista de participantes al equipo docente', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([
      { id_alumno: 5, nombre: 'Marc Soler', rol: 'ALUMNO', serie: true },
    ])))

    render(<EventParticipation event={{ ...baseEvent, mostrar_asistentes: false }} canParticipate={false} canChooseInstructorRole={false} canSeeParticipants hasStarted={false} onChanged={vi.fn()} />)

    expect(await screen.findByText('Marc Soler')).toBeTruthy()
    expect(screen.getByText('Alumno · serie')).toBeTruthy()
    expect(screen.getByText('Los alumnos no ven el número de asistentes de esta actividad.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Apuntarme' })).toBeNull()
  })
})
