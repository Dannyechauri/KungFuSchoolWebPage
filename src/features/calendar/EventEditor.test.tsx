import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEvent, RecurringRule } from './calendarApi'
import { EventEditor } from './EventEditor'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const event: CalendarEvent = {
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

const rule: RecurringRule = {
  id_horario_recurrente: 7,
  id_curso: 1,
  curso_nombre: 'Wushu infantil',
  tipo_curso: 'HABITUAL',
  id_instructor: 2,
  instructor_nombre: 'Chen Wei',
  id_sala: 3,
  sala_nombre: 'Sala Multiusos',
  dia_semana: 2,
  hora_inicio: '18:00',
  hora_fin: '19:00',
  fecha_inicio: '2093-03-01',
  fecha_fin: null,
  activo: true,
  limite_participantes: 10,
  mostrar_asistentes: true,
  puede_modificar: true,
}

function mockApi() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const body = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (init?.method === 'PATCH') return body({})
    if (url === '/api/calendar/courses') return body([{ id_curso: 1, nombre: 'Wushu infantil', tema: 'Base', descripcion: null, tipo_curso: 'HABITUAL' }])
    if (url === '/api/calendar/instructors') return body([{ id_instructor: 2, nombre: 'Chen Wei', activo: true }])
    if (url === '/api/calendar/rooms') return body([{ id_sala: 3, nombre: 'Sala Multiusos', activo: true }])
    if (url === '/api/calendar/recurring-rules') return body([rule])
    return body([])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('EventEditor', () => {
  it('edita la sesión seleccionada desde el calendario', async () => {
    const fetchMock = mockApi()
    const onDone = vi.fn()
    const user = userEvent.setup()

    render(<EventEditor event={event} scope="event" canEditParticipation onDone={onDone} onClose={vi.fn()} />)

    const limit = await screen.findByLabelText('Límite de plazas de alumno')
    await user.clear(limit)
    await user.type(limit, '6')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('Sesión actualizada.'))
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(patch?.[0]).toBe('/api/calendar/events/40')
    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({ courseId: 1, roomId: 3, participantLimit: 6, showAttendeeCount: true })
  })

  it('edita el horario habitual de una sesión recurrente', async () => {
    const fetchMock = mockApi()
    const onDone = vi.fn()
    const user = userEvent.setup()

    render(<EventEditor event={event} scope="rule" canEditParticipation onDone={onDone} onClose={vi.fn()} />)

    expect(await screen.findByText('Editar horario habitual')).toBeTruthy()
    await user.click(screen.getByLabelText('Mostrar a los alumnos cuántos asisten'))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('Horario habitual actualizado.'))
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(patch?.[0]).toBe('/api/calendar/recurring-rules/7')
    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({ showAttendeeCount: false })
  })
})
