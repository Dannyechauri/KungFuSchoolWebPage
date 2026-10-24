import { useEffect, useState } from 'react'
import {
  getEventParticipants,
  joinCalendarEvent,
  leaveCalendarEvent,
  type CalendarEvent,
  type EventParticipant,
  type ParticipationRole,
  type ParticipationScope,
} from './calendarApi'
import { calendarErrorMessage } from './calendarErrors'
import { formatCalendarDate } from './calendarDate'

const buttonClass = 'min-h-10 rounded-full px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50'
const roleLabels: Record<ParticipationRole, string> = { ALUMNO: 'alumno', INSTRUCTOR: 'instructor' }

type Props = {
  event: CalendarEvent
  canParticipate: boolean
  canChooseInstructorRole: boolean
  canSeeParticipants: boolean
  hasStarted: boolean
  onChanged: () => void
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

function attendanceSummary(event: CalendarEvent) {
  if (!event.asistentes) {
    if (event.completo) return 'Plazas completas'
    return event.limite_participantes === null ? 'Sin límite de plazas' : 'Quedan plazas libres'
  }
  const students = event.limite_participantes === null
    ? plural(event.asistentes.alumnos, 'alumno apuntado', 'alumnos apuntados')
    : `${event.asistentes.alumnos} / ${event.limite_participantes} plazas ocupadas`
  const instructors = plural(event.asistentes.instructores, 'instructor', 'instructores')
  const limit = event.limite_participantes === null ? ' · Sin límite de plazas' : ''
  return `${students} · ${instructors}${limit}`
}

export function EventParticipation({ event, canParticipate, canChooseInstructorRole, canSeeParticipants, hasStarted, onChanged }: Props) {
  const recurring = event.id_horario_recurrente !== null
  const [scope, setScope] = useState<ParticipationScope>('occurrence')
  const [role, setRole] = useState<ParticipationRole>('ALUMNO')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [participants, setParticipants] = useState<EventParticipant[] | null>(null)
  const [participantsError, setParticipantsError] = useState<string | null>(null)
  const countsKey = JSON.stringify([event.id_curso_agendado, event.asistentes])

  useEffect(() => {
    if (!canSeeParticipants) return
    let active = true
    getEventParticipants(event.id_curso_agendado)
      .then((loaded) => { if (active) { setParticipants(loaded); setParticipantsError(null) } })
      .catch((error: unknown) => { if (active) setParticipantsError(calendarErrorMessage(error)) })
    return () => { active = false }
  }, [canSeeParticipants, event.id_curso_agendado, countsKey])

  const seatBlocked = role === 'ALUMNO' && scope === 'occurrence' && event.completo
  const editable = canParticipate && event.activo && !hasStarted

  async function join() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await joinCalendarEvent(event.id_curso_agendado, recurring ? scope : 'occurrence', role)
      const skipped = result.skipped.map((date) => formatCalendarDate(date, { day: 'numeric', month: 'short' }))
      const text = scope === 'series' && recurring
        ? `Te has apuntado a ${plural(result.joined.length, 'fecha', 'fechas')} de la serie.${skipped.length ? ` Sin plaza: ${skipped.join(', ')}.` : ''}`
        : `Te has apuntado como ${roleLabels[role]}.`
      setMessage({ tone: 'ok', text })
      onChanged()
    } catch (error) {
      setMessage({ tone: 'error', text: calendarErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  async function leave(leaveScope: ParticipationScope) {
    setBusy(true)
    setMessage(null)
    try {
      await leaveCalendarEvent(event.id_curso_agendado, leaveScope)
      setMessage({ tone: 'ok', text: leaveScope === 'series' ? 'Te has quitado de la serie desde este día.' : 'Te has quitado de este día.' })
      onChanged()
    } catch (error) {
      setMessage({ tone: 'error', text: calendarErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const mine = event.mi_participacion

  return (
    <section className="grid gap-3 rounded-soft border border-line bg-white/60 p-4" aria-labelledby="event-participants-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="event-participants-title" className="m-0 text-xs font-bold uppercase tracking-wide text-muted">Participantes</h3>
        {event.completo ? <span className="rounded-full bg-red/10 px-3 py-1 text-xs font-bold text-red-dark">Completo</span> : null}
      </div>
      <p className="m-0 font-semibold text-ink">{attendanceSummary(event)}</p>
      {canSeeParticipants && !event.mostrar_asistentes ? <p className="m-0 text-xs text-muted">Los alumnos no ven el número de asistentes de esta actividad.</p> : null}

      {canParticipate && mine ? (
        <p className="m-0 text-sm text-ink">
          Estás apuntado como <strong>{roleLabels[mine.rol]}</strong>{recurring ? (mine.serie ? ' a toda la serie' : ' solo a este día') : ''}.
        </p>
      ) : null}

      {editable && mine ? (
        <div className="flex flex-wrap gap-2">
          <button className={`${buttonClass} border border-line text-red-dark`} type="button" disabled={busy} onClick={() => void leave('occurrence')}>
            {recurring ? 'Quitarme de este día' : 'Quitarme'}
          </button>
          {recurring ? (
            <button className={`${buttonClass} border border-line text-red-dark`} type="button" disabled={busy} onClick={() => void leave('series')}>
              Quitarme de la serie
            </button>
          ) : null}
        </div>
      ) : null}

      {editable && !mine ? (
        <div className="grid gap-3">
          {recurring ? (
            <fieldset className="m-0 flex flex-wrap gap-4 border-0 p-0">
              <legend className="mb-1 text-xs font-bold text-muted">Asistencia</legend>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="participation-scope" checked={scope === 'occurrence'} onChange={() => setScope('occurrence')} />Solo este día</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="participation-scope" checked={scope === 'series'} onChange={() => setScope('series')} />Toda la serie</label>
            </fieldset>
          ) : null}
          {canChooseInstructorRole ? (
            <fieldset className="m-0 flex flex-wrap gap-4 border-0 p-0">
              <legend className="mb-1 text-xs font-bold text-muted">Participar como</legend>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="participation-role" checked={role === 'ALUMNO'} onChange={() => setRole('ALUMNO')} />Alumno</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="participation-role" checked={role === 'INSTRUCTOR'} onChange={() => setRole('INSTRUCTOR')} />Instructor</label>
            </fieldset>
          ) : null}
          <div>
            <button className={`${buttonClass} bg-red text-white`} type="button" disabled={busy || seatBlocked} onClick={() => void join()}>
              Apuntarme
            </button>
          </div>
          {seatBlocked ? <p className="m-0 text-xs text-muted">No quedan plazas de alumno en este día.</p> : null}
        </div>
      ) : null}

      {canParticipate && hasStarted && event.activo ? <p className="m-0 text-xs text-muted">La actividad ya ha empezado; no se puede cambiar la participación.</p> : null}
      {message ? <p className={`m-0 text-sm font-semibold ${message.tone === 'ok' ? 'text-green-800' : 'text-red-dark'}`} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      {canSeeParticipants ? (
        <div className="border-t border-line pt-3">
          <h4 className="m-0 text-xs font-bold uppercase tracking-wide text-muted">Lista de participantes</h4>
          {participantsError ? <p className="m-0 mt-2 text-sm text-red-dark">{participantsError}</p> : null}
          {participants && participants.length === 0 ? <p className="m-0 mt-2 text-sm text-muted">Todavía no hay nadie apuntado.</p> : null}
          {participants && participants.length > 0 ? (
            <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-sm">
              {participants.map((participant) => (
                <li key={String(participant.id_alumno)} className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold text-ink">{participant.nombre}</span>
                  <span className="text-muted">{participant.rol === 'INSTRUCTOR' ? 'Instructor' : 'Alumno'}{participant.serie ? ' · serie' : ''}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
