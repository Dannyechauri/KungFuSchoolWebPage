import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'
import { PanelCard } from './PanelCard'

type Birthday = { id: number; name: string }

const todayFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Madrid',
})

export function BirthdayPanel() {
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let active = true
    apiRequest<Birthday[]>('/api/me/birthdays/today')
      .then((loadedBirthdays) => { if (active) setBirthdays(loadedBirthdays) })
      .catch(() => { if (active) setHasError(true) })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <PanelCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-red">Cumpleaños</p>
          <h2 className="mt-2 text-xl font-bold text-ink">Hoy celebramos</h2>
        </div>
        <time className="shrink-0 pt-1 text-right text-sm font-bold text-muted">{todayFormatter.format(new Date())}</time>
      </div>
      {isLoading ? <p className="mb-0 mt-5 text-sm text-muted">Buscando cumpleañeros…</p> : hasError ? (
        <p className="mb-0 mt-5 text-sm text-red-dark" role="alert">No se pudo cargar la lista.</p>
      ) : birthdays.length ? (
        <>
          <ul className="mt-4 grid divide-y divide-line">
            {birthdays.map((birthday) => <li key={birthday.id} className="py-3 text-base font-bold text-ink first:pt-0">{birthday.name}</li>)}
          </ul>
          <p className="mb-0 mt-2 border-t border-line pt-3 text-sm font-bold text-red-dark">¡Feliz cumpleaños!</p>
        </>
      ) : <p className="mb-0 mt-5 text-sm text-muted">Hoy no hay cumpleaños registrados.</p>}
    </PanelCard>
  )
}