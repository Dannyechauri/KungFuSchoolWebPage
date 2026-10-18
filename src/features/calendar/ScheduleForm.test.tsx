import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScheduleForm } from './ScheduleForm'

afterEach(cleanup)

describe('ScheduleForm', () => {
  it('crea cada sesión puntual dentro de una sola fecha', async () => {
    const onSubmitEvent = vi.fn()
    const user = userEvent.setup()

    render(
      <ScheduleForm
        target={{ kind: 'event-create', date: '2026-10-24' }}
        courses={[{ id_curso: 1, nombre: 'Taller de Shuai Jiao', tema: 'Especialización', descripcion: null, tipo_curso: 'CURSO_ESPECIAL' }]}
        instructors={[{ id_instructor: 2, nombre: 'Chen Wei', activo: true }]}
        rooms={[{ id_sala: 3, nombre: 'Sala Multiusos', activo: true }]}
        saving={false}
        error={null}
        onCancel={vi.fn()}
        onSubmitEvent={onSubmitEvent}
        onSubmitRule={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Fecha de la sesión')).toBeTruthy()
    expect(screen.queryByLabelText('Fecha de fin')).toBeNull()
    await user.clear(screen.getByLabelText('Hora de inicio'))
    await user.type(screen.getByLabelText('Hora de inicio'), '10:00')
    await user.clear(screen.getByLabelText('Hora de fin'))
    await user.type(screen.getByLabelText('Hora de fin'), '13:00')
    await user.click(screen.getByRole('button', { name: 'Añadir a la agenda' }))

    expect(onSubmitEvent).toHaveBeenCalledWith(null, {
      courseId: 1,
      instructorId: 2,
      roomId: 3,
      startAt: '2026-10-24T10:00:00',
      endAt: '2026-10-24T13:00:00',
    })
  })
})
