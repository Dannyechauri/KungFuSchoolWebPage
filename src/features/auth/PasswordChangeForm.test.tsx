import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PasswordChangeForm } from './PasswordChangeForm'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PasswordChangeForm', () => {
  it('exige que la nueva contraseña coincida con la confirmación', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<PasswordChangeForm />)

    await user.click(screen.getByText('Cambiar contraseña'))
    await user.type(screen.getByLabelText('Contraseña actual'), 'current-password')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'new-password-123')
    await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'different-password')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect((await screen.findByRole('alert')).textContent).toContain('no coinciden')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envía la contraseña actual y la nueva, y confirma el cambio', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ updated: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<PasswordChangeForm />)

    await user.click(screen.getByText('Cambiar contraseña'))
    await user.type(screen.getByLabelText('Contraseña actual'), 'current-password')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'new-password-123')
    await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'new-password-123')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect((await screen.findByRole('status')).textContent).toContain('cambiado correctamente')
    expect(fetchMock).toHaveBeenCalledWith('/api/me/password', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ currentPassword: 'current-password', newPassword: 'new-password-123' }),
    }))
  })
})