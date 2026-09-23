import type { FormEvent } from 'react'
import { useState } from 'react'
import { useAuth } from './useAuth'

export function LoginPage() {
  const { login } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError(null)
    setIsSubmitting(true)

    try {
      await login(String(formData.get('email')), String(formData.get('password')))
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'No se ha podido iniciar sesión.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-md rounded-panel border border-line bg-paper/90 p-7 shadow-panel">
        <div className="flex items-center gap-4">
          <img className="size-16 object-contain" src="/logo-instituto-wushu.png" alt="Instituto de Wu-shu de Barcelona" />
          <div>
            <p className="m-0 text-xs font-black tracking-[0.12em] text-red uppercase">Administración</p>
            <h1 className="mt-1 text-2xl font-bold text-ink">Instituto de Wu-shu</h1>
          </div>
        </div>

        <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-bold text-muted">
            Correo electrónico
            <input className="min-h-12 rounded-soft border border-line bg-white px-3 text-ink" name="email" type="email" autoComplete="email" required />
          </label>
          <label className="grid gap-2 text-sm font-bold text-muted">
            Contraseña
            <input className="min-h-12 rounded-soft border border-line bg-white px-3 text-ink" name="password" type="password" autoComplete="current-password" required />
          </label>
          {error ? <p className="m-0 rounded-soft bg-red/10 p-3 text-sm font-bold text-red-dark">{error}</p> : null}
          <button className="min-h-12 rounded-full bg-red px-5 font-bold text-white hover:bg-red-dark disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Accediendo…' : 'Iniciar sesión'}
          </button>
        </form>
      </section>
    </main>
  )
}
