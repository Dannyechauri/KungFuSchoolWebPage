import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function profile(learning: { percent: number; updatedOn: string } | null) {
  return {
    student: { id: 1, name: 'Marc Soler', enrollmentNumber: 'A-02', email: null, birthDate: null, joinedOn: '2024-01-10', active: true, isInstructor: false },
    grade: { id: 4, name: 'Cinta Naranja', beltColor: 'Naranja', order: 3, requiredForms: 2 },
    knownForms: [
      { id: 9, name: 'Forma anterior', description: null, style: 'Ving Tsun', learnedOn: '2024-03-10' },
      { id: 10, name: 'Wu Bu Quan', description: null, style: 'Shaolin', learnedOn: '2024-05-01' },
    ],
    gradeForms: [
      { id: 10, name: 'Wu Bu Quan', description: null, style: 'Shaolin', optional: false, known: true, learning: null },
      { id: 11, name: 'Lian Bu Quan', description: 'Puños encadenados', style: 'Shaolin', optional: false, known: false, learning },
      { id: 12, name: 'Abanico', description: null, style: 'Taiji', optional: true, known: false, learning: null },
    ],
    instructor: null,
  }
}

function mockApi() {
  let learning: { percent: number; updatedOn: string } | null = null
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/me/forms/11/progress')) {
      if (init?.method === 'DELETE') learning = null
      else learning = { percent: JSON.parse(String(init?.body)).percent, updatedOn: '2026-02-01' }
      return new Response(JSON.stringify({ formId: 11 }), { status: 200 })
    }
    return new Response(JSON.stringify(profile(learning)), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('ProfilePage', () => {
  it('combina las formas aprendidas y del grado por estilo y guarda el avance', async () => {
    const fetchMock = mockApi()
    const user = userEvent.setup()
    render(<ProfilePage />)

    const formsHeading = await screen.findByRole('heading', { name: 'Formas' })
    expect(screen.queryByRole('heading', { name: 'Obligatorias' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Opcionales' })).toBeNull()
    expect(screen.getAllByText('Wu Bu Quan')).toHaveLength(1)
    expect(screen.getByText('Forma anterior')).toBeTruthy()
    expect(screen.getByText('Ving Tsun')).toBeTruthy()
    expect(screen.getByText('Opcional')).toBeTruthy()
    expect(screen.getByText('1 de 2 obligatorias')).toBeTruthy()
    expect(formsHeading).toBeTruthy()
    expect(screen.getAllByText('Sabida')).toHaveLength(2)

    const [markLearning] = screen.getAllByRole('button', { name: 'Marcar como aprendiendo' })
    await user.click(markLearning!)
    await screen.findByText('Aprendiendo · 0%')

    fireEvent.change(screen.getByLabelText('Porcentaje de avance en Lian Bu Quan'), { target: { value: '45' } })
    await user.click(screen.getByRole('button', { name: 'Guardar avance' }))
    await screen.findByText('Aprendiendo · 45%')
    expect(screen.getByRole('status').textContent).toContain('45%')
    const puts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')
    expect(JSON.parse(String(puts.at(-1)?.[1]?.body))).toEqual({ percent: 45 })

    await user.click(screen.getByRole('button', { name: 'Dejar de aprender' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Marcar como aprendiendo' })).toHaveLength(2))
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true)
  })
})
