import { useState, type FormEvent } from 'react'
import { apiRequest } from '../../api/client'

export function PasswordChangeForm({ onPasswordChanged }: { onPasswordChanged?: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const currentPassword = String(data.get('currentPassword'))
    const newPassword = String(data.get('newPassword'))
    const confirmation = String(data.get('confirmation'))

    setError(null)
    setNotice(null)
    if (newPassword !== confirmation) {
      setError('La nueva contraseña y su confirmación no coinciden.')
      return
    }

    setSaving(true)
    let changedPassword = false
    try {
      await apiRequest('/api/me/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      form.reset()
      setNotice('Tu contraseña se ha cambiado correctamente.')
      changedPassword = true
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cambiar la contraseña.')
    } finally {
      setSaving(false)
    }
    if (changedPassword) await onPasswordChanged?.().catch(() => window.location.reload())
  }

  return (
    <details className="mt-3 border-t border-white/15 pt-3">
      <summary className="cursor-pointer text-sm font-bold text-cream-muted hover:text-white">Cambiar contraseña</summary>
      <form className="mt-3 grid gap-3" onSubmit={(event) => void submit(event)}>
        <label className="grid gap-1.5 text-xs font-bold text-cream-muted">
          Contraseña actual
          <input className="min-h-10 rounded-soft border border-white/20 bg-white px-3 text-sm text-ink" name="currentPassword" type="password" autoComplete="current-password" required />
        </label>
        <label className="grid gap-1.5 text-xs font-bold text-cream-muted">
          Nueva contraseña
          <input className="min-h-10 rounded-soft border border-white/20 bg-white px-3 text-sm text-ink" name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <label className="grid gap-1.5 text-xs font-bold text-cream-muted">
          Confirmar nueva contraseña
          <input className="min-h-10 rounded-soft border border-white/20 bg-white px-3 text-sm text-ink" name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        {error ? <p className="m-0 text-xs font-bold text-red-200" role="alert">{error}</p> : null}
        {notice ? <p className="m-0 text-xs font-bold text-gold" role="status">{notice}</p> : null}
        <button className="min-h-10 rounded-soft bg-gold px-3 text-sm font-bold text-ink hover:bg-gold/90 disabled:opacity-60" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </details>
  )
}