import { useEffect, useState } from 'react'
import { PanelCard } from '../../components/PanelCard'
import { formatCalendarDate, formatTime } from './calendarDate'
import { calendarErrorMessage } from './calendarErrors'
import { getPendingInvitations, respondToInvitation, type EventInvitation } from './calendarApi'

export function EventInvitationInbox({ onResponded }: { onResponded: () => void }) {
  const [invitations, setInvitations] = useState<EventInvitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function refresh() {
      try {
        const loaded = await getPendingInvitations()
        if (active) { setInvitations(loaded); setError(null) }
      } catch (loadError) {
        if (active) setError(calendarErrorMessage(loadError))
      } finally {
        if (active) setIsLoading(false)
      }
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 30_000)
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  async function respond(invitation: EventInvitation, response: 'ACEPTADA' | 'RECHAZADA') {
    const id = String(invitation.id_invitacion)
    setRespondingId(id)
    setError(null)
    try {
      await respondToInvitation(invitation.id_invitacion, response)
      setInvitations((current) => current.filter((item) => String(item.id_invitacion) !== id))
      onResponded()
    } catch (responseError) {
      setError(calendarErrorMessage(responseError))
    } finally {
      setRespondingId(null)
    }
  }

  if (isLoading || (!invitations.length && !error)) return null

  return (
    <PanelCard className="mt-5 border-gold/70 bg-gold/10 p-5" aria-label="Invitaciones pendientes">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-red">Pendiente de respuesta</p>
          <h2 className="mt-2 text-xl font-bold text-ink">Invitaciones</h2>
        </div>
        <span className="rounded-full bg-gold px-3 py-1 text-sm font-black text-ink">{invitations.length}</span>
      </div>
      {error ? <p className="mt-3 text-sm font-bold text-red-dark" role="alert">{error}</p> : null}
      <ul className="mt-4 grid divide-y divide-gold/50">
        {invitations.map((invitation) => {
          const date = invitation.fecha_hora.slice(0, 10)
          const label = `${formatCalendarDate(date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${formatTime(invitation.fecha_hora)}–${formatTime(invitation.fecha_hora_fin)}`
          const id = String(invitation.id_invitacion)
          return (
            <li key={id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block text-base text-ink">{invitation.curso_nombre}</strong>
                  <span className="mt-1 block text-sm text-muted">{label} · {invitation.sala_nombre ?? 'Sala sin asignar'}</span>
                  <span className="mt-1 block text-sm text-muted">Invitación como {invitation.rol === 'INSTRUCTOR' ? 'instructor' : 'alumno'}{invitation.es_titular ? ' titular' : ''} · {invitation.invitado_por_nombre} te ha invitado</span>
                  {invitation.descripcion ? <span className="mt-2 block text-sm text-ink">{invitation.descripcion}</span> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button className="min-h-10 rounded-full bg-green-800 px-4 text-sm font-bold text-white disabled:opacity-50" type="button" disabled={respondingId !== null} onClick={() => void respond(invitation, 'ACEPTADA')}>Aceptar</button>
                  <button className="min-h-10 rounded-full border border-line bg-white px-4 text-sm font-bold text-muted disabled:opacity-50" type="button" disabled={respondingId !== null} onClick={() => void respond(invitation, 'RECHAZADA')}>Rechazar</button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </PanelCard>
  )
}