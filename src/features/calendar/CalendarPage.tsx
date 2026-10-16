import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { ApiRequestError } from '../../api/client'
import { PanelCard } from '../../components/PanelCard'
import { SelectField } from '../../components/SelectField'
import { useAuth } from '../auth/useAuth'
import {
  cancelCalendarEvent,
  cancelRecurringRule,
  createCalendarCourse,
  createCalendarEvent,
  createRecurringRules,
  entityKey,
  getCalendarCourses,
  getCalendarEvents,
  getCalendarInstructors,
  getCalendarRooms,
  getRecurringRules,
  updateCalendarCourse,
  updateCalendarEvent,
  updateRecurringRule,
  type CalendarCourse,
  type CalendarEvent,
  type CalendarInstructor,
  type CalendarRoom,
  type CoursePayload,
  type EventPayload,
  type RecurringPayload,
  type RecurringRule,
} from './calendarApi'
import {
  addDays,
  addDaysToKey,
  addMonths,
  dateFromKey,
  dateKey,
  eventOverlapsDay,
  formatCalendarDate,
  formatTime,
  madridNowParts,
  minutesOfDateTime,
  monthDateKeys,
  startOfMonth,
  startOfWeek,
  weekDateKeys,
} from './calendarDate'
import { RoomManager } from './RoomManager'
import { ScheduleForm, type ScheduleFormTarget } from './ScheduleForm'

type CalendarView = 'month' | 'week' | 'upcoming'
type PositionedEvent = { event: CalendarEvent; start: number; end: number; lane: number; laneCount: number }

const weekdays = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
]

const buttonClass = 'min-h-10 rounded-full px-4 text-sm font-bold'
const inputClass = 'min-h-11 rounded-soft border border-line bg-white px-3 text-ink'
const labelClass = 'grid gap-2 text-sm font-bold text-muted'

function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError && error.status === 409) {
    if (error.message.toLowerCase().includes('solapa')) return `La sala ya está ocupada en ese horario. ${error.message}`
    return error.message
  }
  return error instanceof Error ? error.message : 'No se pudo completar la operación.'
}

function eventTimeRange(event: CalendarEvent) {
  const startDate = event.fecha_hora.slice(0, 10)
  const endDate = event.fecha_hora_fin.slice(0, 10)
  if (startDate === endDate) return `${formatTime(event.fecha_hora)}–${formatTime(event.fecha_hora_fin)}`
  return `${formatCalendarDate(startDate, { day: 'numeric', month: 'short' })} ${formatTime(event.fecha_hora)} – ${formatCalendarDate(endDate, { day: 'numeric', month: 'short' })} ${formatTime(event.fecha_hora_fin)}`
}

function eventRoom(event: CalendarEvent) {
  return event.sala_nombre ?? 'Sala sin asignar'
}

function dayEvents(events: CalendarEvent[], day: string) {
  return events.filter((event) => eventOverlapsDay(event, day))
}

function layoutDayEvents(events: CalendarEvent[], day: string): PositionedEvent[] {
  const positioned = dayEvents(events, day)
    .filter((event) => event.fecha_hora.slice(0, 10) === event.fecha_hora_fin.slice(0, 10))
    .map((event) => ({ event, start: minutesOfDateTime(event.fecha_hora), end: minutesOfDateTime(event.fecha_hora_fin), lane: 0, laneCount: 1 }))
    .sort((first, second) => first.start - second.start || first.end - second.end)

  const clusters: PositionedEvent[][] = []
  let clusterEnd = -1
  for (const event of positioned) {
    if (!clusters.length || event.start >= clusterEnd) {
      clusters.push([event])
      clusterEnd = event.end
    } else {
      clusters[clusters.length - 1]?.push(event)
      clusterEnd = Math.max(clusterEnd, event.end)
    }
  }

  for (const cluster of clusters) {
    const laneEnds: number[] = []
    for (const event of cluster) {
      let lane = laneEnds.findIndex((end) => end <= event.start)
      if (lane < 0) lane = laneEnds.length
      laneEnds[lane] = event.end
      event.lane = lane
    }
    for (const event of cluster) event.laneCount = laneEnds.length
  }
  return positioned
}

function CalendarEventCard({ event, onSelect, compact = false }: { event: CalendarEvent; onSelect: () => void; compact?: boolean }) {
  return (
    <button
      className={`w-full rounded-soft border p-3 text-left ${event.activo ? 'border-red/20 bg-red/10 text-red-dark hover:bg-red/15' : 'border-line bg-line/60 text-muted'}`}
      type="button"
      onClick={onSelect}
      aria-label={`${event.curso_nombre}, ${eventTimeRange(event)}, ${eventRoom(event)}`}
    >
      <span className="block truncate text-xs font-black">{eventTimeRange(event)}</span>
      <strong className={`mt-1 block leading-5 ${compact ? 'truncate text-xs' : 'text-sm'}`}>{event.curso_nombre}</strong>
      {!compact ? <span className="mt-1 block truncate text-xs opacity-80">{eventRoom(event)} · {event.instructor_nombre}</span> : null}
      {!event.activo ? <span className="mt-1 block text-[0.68rem] font-bold uppercase tracking-wide">Cancelada</span> : null}
    </button>
  )
}

function WeekSchedule({ events, weekKeys, onSelectDay, onSelectEvent }: {
  events: CalendarEvent[]
  weekKeys: string[]
  onSelectDay: (day: string) => void
  onSelectEvent: (event: CalendarEvent) => void
}) {
  const singleDayEvents = events.filter((event) => event.fecha_hora.slice(0, 10) === event.fecha_hora_fin.slice(0, 10))
  const allTimes = singleDayEvents.flatMap((event) => [minutesOfDateTime(event.fecha_hora), minutesOfDateTime(event.fecha_hora_fin)])
  const firstHour = Math.min(8, ...allTimes.map((minutes) => Math.floor(minutes / 60)))
  const lastHour = Math.max(21, ...allTimes.map((minutes) => Math.ceil(minutes / 60)))
  const startMinute = Math.max(0, firstHour * 60)
  const endMinute = Math.min(24 * 60, lastHour * 60)
  const pixelsPerMinute = 1.15
  const timelineHeight = Math.max((endMinute - startMinute) * pixelsPerMinute, 13 * 60 * pixelsPerMinute)
  const hours = Array.from({ length: Math.max(1, Math.ceil(endMinute / 60) - Math.floor(startMinute / 60) + 1) }, (_, index) => Math.floor(startMinute / 60) + index)
  const spanningEvents = events.filter((event) => event.fecha_hora.slice(0, 10) !== event.fecha_hora_fin.slice(0, 10))

  return (
    <div className="grid gap-4">
      {spanningEvents.length ? (
        <section className="rounded-soft border border-gold/50 bg-gold/10 p-4">
          <h3 className="m-0 text-sm font-black uppercase tracking-wide text-red-dark">Actividades de varios días</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {spanningEvents.map((event) => (
              <CalendarEventCard key={entityKey(event.id_curso_agendado)} event={event} onSelect={() => onSelectEvent(event)} />
            ))}
          </div>
        </section>
      ) : null}
      <div className="overflow-x-auto rounded-soft border border-line bg-white/70">
        <div className="min-w-[76rem]">
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-line bg-paper/70">
            <div />
            {weekKeys.map((day, index) => (
              <button key={day} className="border-l border-line px-2 py-3 text-center hover:bg-gold/10" type="button" onClick={() => onSelectDay(day)}>
                <span className="block text-xs font-black uppercase tracking-wide text-red-dark">{weekdays[index]?.label}</span>
                <strong className="mt-1 block text-lg text-ink">{formatCalendarDate(day, { day: 'numeric', month: 'short' })}</strong>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
            <div className="relative text-right text-xs font-semibold text-muted" style={{ height: timelineHeight }}>
              {hours.map((hour) => (
                <span key={hour} className="absolute right-2 -translate-y-1/2" style={{ top: (hour * 60 - startMinute) * pixelsPerMinute }}>{String(hour).padStart(2, '0')}:00</span>
              ))}
            </div>
            {weekKeys.map((day) => {
              const laidOut = layoutDayEvents(events, day)
              const today = day === madridNowParts().date
              return (
                <div key={day} className={`relative border-l border-line ${today ? 'bg-gold/5' : ''}`} style={{ height: timelineHeight }}>
                  {hours.map((hour) => (
                    <div key={hour} className="absolute inset-x-0 border-t border-line/70" style={{ top: (hour * 60 - startMinute) * pixelsPerMinute }} />
                  ))}
                  {laidOut.map(({ event, start, end, lane, laneCount }) => {
                    const style: CSSProperties = {
                      top: (start - startMinute) * pixelsPerMinute + 2,
                      height: Math.max((end - start) * pixelsPerMinute - 3, 46),
                      left: `calc(${lane * 100 / laneCount}% + 3px)`,
                      width: `calc(${100 / laneCount}% - 6px)`,
                      zIndex: 2 + lane,
                    }
                    return (
                      <div key={entityKey(event.id_curso_agendado)} className="absolute" style={style}>
                        <CalendarEventCard event={event} onSelect={() => onSelectEvent(event)} compact />
                      </div>
                    )
                  })}
                  {!dayEvents(events, day).length ? <span className="absolute left-2 top-3 text-xs text-muted">Sin actividades</span> : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export function CalendarPage() {
  const { user } = useAuth()
  const canManage = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR'
  const isAdmin = user?.role === 'ADMIN'
  const initialToday = madridNowParts().date
  const [view, setView] = useState<CalendarView>('week')
  const [monthDate, setMonthDate] = useState(() => startOfMonth(dateFromKey(initialToday)))
  const [weekDate, setWeekDate] = useState(() => startOfWeek(dateFromKey(initialToday)))
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [formTarget, setFormTarget] = useState<ScheduleFormTarget | null>(null)
  const [courses, setCourses] = useState<CalendarCourse[]>([])
  const [instructors, setInstructors] = useState<CalendarInstructor[]>([])
  const [rooms, setRooms] = useState<CalendarRoom[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [loadedMetadataKey, setLoadedMetadataKey] = useState<string | null>(null)
  const [loadedEventsKey, setLoadedEventsKey] = useState<string | null>(null)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [metadataVersion, setMetadataVersion] = useState(0)
  const [eventsVersion, setEventsVersion] = useState(0)
  const [editingCourse, setEditingCourse] = useState<CalendarCourse | null>(null)
  const [courseError, setCourseError] = useState<string | null>(null)
  const [courseSaving, setCourseSaving] = useState(false)

  const today = madridNowParts()
  const weekKeys = useMemo(() => weekDateKeys(weekDate), [weekDate])
  const monthKeys = useMemo(() => monthDateKeys(monthDate), [monthDate])
  const range = useMemo(() => {
    if (view === 'week') return { from: `${weekKeys[0]}T00:00`, to: `${addDaysToKey(weekKeys[6] ?? today.date, 1)}T00:00` }
    if (view === 'month') return { from: `${monthKeys[0]}T00:00`, to: `${addDaysToKey(monthKeys[41] ?? today.date, 1)}T00:00` }
    return { from: `${today.date}T00:00`, to: `${addDaysToKey(today.date, 90)}T23:59` }
  }, [view, weekKeys, monthKeys, today.date])
  const metadataRequestKey = `${canManage ? 'manager' : 'viewer'}:${metadataVersion}`
  const eventsRequestKey = `${range.from}|${range.to}|${selectedRoomId ?? 'all'}|${eventsVersion}`
  const metadataLoading = loadedMetadataKey !== metadataRequestKey
  const eventsLoading = loadedEventsKey !== eventsRequestKey
  const monthTitle = formatCalendarDate(dateKey(monthDate), { month: 'long', year: 'numeric' })
  const weekTitle = `${formatCalendarDate(weekKeys[0] ?? today.date, { day: 'numeric', month: 'short' })} – ${formatCalendarDate(weekKeys[6] ?? today.date, { day: 'numeric', month: 'long', year: 'numeric' })}`
  const activitiesForSelectedDate = useMemo(() => selectedDate ? dayEvents(events, selectedDate) : [], [events, selectedDate])
  const upcomingEvents = useMemo(() => events
    .filter((event) => event.activo && event.fecha_hora_fin >= today.dateTime)
    .sort((first, second) => first.fecha_hora.localeCompare(second.fecha_hora)), [events, today.dateTime])

  useEffect(() => {
    let active = true
    Promise.all([
      getCalendarCourses(),
      getCalendarRooms(),
      ...(canManage ? [getCalendarInstructors(), getRecurringRules()] : []),
    ])
      .then((results) => {
        if (!active) return
        setCourses(results[0] as CalendarCourse[])
        setRooms(results[1] as CalendarRoom[])
        if (canManage) {
          setInstructors(results[2] as CalendarInstructor[])
          setRules(results[3] as RecurringRule[])
        } else {
          setInstructors([])
          setRules([])
        }
        setMetadataError(null)
      })
      .catch((error: unknown) => { if (active) setMetadataError(errorMessage(error)) })
      .finally(() => { if (active) setLoadedMetadataKey(metadataRequestKey) })
    return () => { active = false }
  }, [canManage, metadataVersion, metadataRequestKey])

  useEffect(() => {
    let active = true
    const startedAt = performance.now()
    let loadingTimer: number | undefined
    getCalendarEvents(range.from, range.to, selectedRoomId)
      .then((loadedEvents) => {
        if (active) {
          setEvents(loadedEvents)
          setEventsError(null)
        }
      })
      .catch((error: unknown) => { if (active) setEventsError(errorMessage(error)) })
      .finally(() => {
        if (!active) return
        const minimumLoadingTime = import.meta.env.DEV ? 1000 : 0
        const remainingTime = Math.max(0, minimumLoadingTime - (performance.now() - startedAt))
        if (remainingTime === 0) setLoadedEventsKey(eventsRequestKey)
        else loadingTimer = window.setTimeout(() => { if (active) setLoadedEventsKey(eventsRequestKey) }, remainingTime)
      })
    return () => {
      active = false
      if (loadingTimer !== undefined) window.clearTimeout(loadingTimer)
    }
  }, [range, selectedRoomId, eventsRequestKey])

  const refreshMetadata = useCallback(() => setMetadataVersion((version) => version + 1), [])
  const refreshEvents = useCallback(() => setEventsVersion((version) => version + 1), [])

  async function saveEvent(id: CalendarEvent['id_curso_agendado'] | null, payload: EventPayload) {
    setIsSaving(true)
    setActionError(null)
    try {
      if (id === null) await createCalendarEvent(payload)
      else await updateCalendarEvent(id, payload)
      setFormTarget(null)
      const startDate = payload.startAt.slice(0, 10)
      setWeekDate(startOfWeek(dateFromKey(startDate)))
      setMonthDate(startOfMonth(dateFromKey(startDate)))
      setView('week')
      refreshEvents()
    } catch (error) {
      setActionError(errorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function saveRule(id: RecurringRule['id_horario_recurrente'] | null, payload: RecurringPayload) {
    setIsSaving(true)
    setActionError(null)
    try {
      if (id === null) await createRecurringRules(payload)
      else await updateRecurringRule(id, payload)
      setFormTarget(null)
      refreshMetadata()
      refreshEvents()
    } catch (error) {
      setActionError(errorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function cancelEvent(event: CalendarEvent) {
    if (!window.confirm(`¿Cancelar «${event.curso_nombre}» en ${eventRoom(event)}? La actividad quedará visible como cancelada.`)) return
    setActionError(null)
    try {
      await cancelCalendarEvent(event.id_curso_agendado)
      refreshEvents()
    } catch (error) {
      setActionError(errorMessage(error))
    }
  }

  async function cancelRule(rule: RecurringRule) {
    if (!window.confirm(`¿Cancelar el horario semanal de «${rule.curso_nombre}» en ${rule.sala_nombre ?? 'sala sin asignar'}? También se cancelarán sus sesiones futuras.`)) return
    setActionError(null)
    try {
      await cancelRecurringRule(rule.id_horario_recurrente)
      refreshMetadata()
      refreshEvents()
    } catch (error) {
      setActionError(errorMessage(error))
    }
  }

  async function saveCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const payload: CoursePayload = {
      nombre: String(data.get('nombre')).trim(),
      tema: String(data.get('tema')).trim(),
      descripcion: String(data.get('descripcion') || '').trim() || null,
      tipo_curso: String(data.get('tipo_curso')) as CoursePayload['tipo_curso'],
    }
    setCourseSaving(true)
    setCourseError(null)
    try {
      if (editingCourse) await updateCalendarCourse(editingCourse.id_curso, payload)
      else await createCalendarCourse(payload)
      form.reset()
      setEditingCourse(null)
      refreshMetadata()
    } catch (error) {
      setCourseError(errorMessage(error))
    } finally {
      setCourseSaving(false)
    }
  }

  function openEventEditor(event: CalendarEvent) {
    setSelectedDate(null)
    setActionError(null)
    setFormTarget({ kind: 'event-edit', event })
  }

  if (metadataLoading && eventsLoading) {
    return <section className="w-full text-muted">Cargando agenda y salas…</section>
  }

  return (
    <section className="w-full">
      <p className="mb-2 text-xs font-black tracking-[0.12em] text-red uppercase">Calendario</p>
      <h1 className="m-0 text-4xl font-bold tracking-tight text-ink md:text-5xl">Agenda de clases y actividades</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-muted">Consulta las actividades por semana, mes o sala. Las sesiones simultáneas se muestran en paralelo cuando ocupan salas diferentes.</p>

      {metadataError ? (
        <PanelCard className="mt-5 p-4">
          <p className="m-0 text-sm font-bold text-red-dark" role="alert">{metadataError}</p>
          <button className={`${buttonClass} mt-3 border border-line text-red-dark`} type="button" onClick={refreshMetadata}>Reintentar</button>
        </PanelCard>
      ) : null}

      <div className="mt-7 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex w-fit rounded-full border border-line bg-paper p-1" role="group" aria-label="Vista de calendario">
            {([['month', 'Mes'], ['week', 'Semana'], ['upcoming', 'Próximas']] as const).map(([value, label]) => (
              <button key={value} className={`${buttonClass} ${view === value ? 'bg-red text-white' : 'text-muted'}`} type="button" onClick={() => setView(value)} aria-pressed={view === value}>{label}</button>
            ))}
          </div>
          {canManage ? (
            <>
              <button className={`${buttonClass} bg-red text-white hover:bg-red-dark`} type="button" onClick={() => { setActionError(null); setFormTarget({ kind: 'event-create', date: today.date }) }}>+ Sesión puntual</button>
              <button className={`${buttonClass} border border-red bg-paper text-red-dark`} type="button" onClick={() => { setActionError(null); setFormTarget({ kind: 'rule-create', date: today.date }) }}>+ Horario habitual</button>
            </>
          ) : null}
        </div>

        {view !== 'upcoming' ? (
          <div className="flex items-center gap-3">
            <button className="size-10 rounded-soft border border-line bg-paper font-bold text-red-dark" type="button" onClick={() => view === 'month' ? setMonthDate((date) => addMonths(date, -1)) : setWeekDate((date) => addDays(date, -7))} aria-label={view === 'month' ? 'Mes anterior' : 'Semana anterior'}>←</button>
            <strong className="min-w-56 text-center text-base capitalize text-ink">{view === 'month' ? monthTitle : weekTitle}</strong>
            <button className="size-10 rounded-soft border border-line bg-paper font-bold text-red-dark" type="button" onClick={() => view === 'month' ? setMonthDate((date) => addMonths(date, 1)) : setWeekDate((date) => addDays(date, 7))} aria-label={view === 'month' ? 'Mes siguiente' : 'Semana siguiente'}>→</button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex flex-col items-start gap-2 text-sm font-bold text-muted sm:flex-row sm:items-center sm:gap-3">
          Filtrar por sala
          <SelectField wrapperClassName="w-48 shrink-0" value={selectedRoomId ?? ''} onChange={(event) => setSelectedRoomId(event.target.value || null)}>
              <option value="">Todas las salas</option>
              {rooms.map((room) => <option key={entityKey(room.id_sala)} value={entityKey(room.id_sala)}>{room.nombre}{room.activo ? '' : ' · Inactiva'}</option>)}
          </SelectField>
        </label>
        {eventsLoading ? <span className="text-sm text-muted" role="status" aria-live="polite">Actualizando…</span> : null}
      </div>

      {canManage ? (
        <div className="mt-5 grid gap-3">
          {formTarget ? (
            <PanelCard className="p-5 md:p-6">
              <ScheduleForm
                key={`${formTarget.kind}-${formTarget.kind === 'event-edit' ? entityKey(formTarget.event.id_curso_agendado) : formTarget.kind === 'rule-edit' ? entityKey(formTarget.rule.id_horario_recurrente) : formTarget.date}`}
                target={formTarget}
                courses={courses}
                instructors={instructors}
                rooms={rooms}
                saving={isSaving}
                error={actionError}
                onCancel={() => { setFormTarget(null); setActionError(null) }}
                onSubmitEvent={(id, payload) => void saveEvent(id, payload)}
                onSubmitRule={(id, payload) => void saveRule(id, payload)}
              />
            </PanelCard>
          ) : null}

          <details className="rounded-panel border border-line bg-paper/85 p-5 shadow-sm">
            <summary className="cursor-pointer font-bold text-ink">Gestionar cursos <span className="ml-1 text-sm font-medium text-muted">({courses.length})</span></summary>
            <div className="mt-4 grid gap-4">
              <ul className="grid gap-2 md:grid-cols-2">
                {courses.map((course) => (
                  <li key={entityKey(course.id_curso)} className="flex items-center justify-between gap-3 rounded-soft border border-line bg-white/60 px-3 py-2">
                    <span className="min-w-0"><strong className="block truncate text-sm text-ink">{course.nombre}</strong><span className="text-xs text-muted">{course.tipo_curso === 'HABITUAL' ? 'Habitual' : 'Especial'} · {course.tema}</span></span>
                    <button className="shrink-0 text-sm font-bold text-red-dark underline" type="button" onClick={() => { setEditingCourse(course); setCourseError(null) }}>Editar</button>
                  </li>
                ))}
              </ul>
              <form className="grid gap-4 border-t border-line pt-4 md:grid-cols-2 xl:grid-cols-4" key={editingCourse ? entityKey(editingCourse.id_curso) : 'new-course'} onSubmit={saveCourse}>
                <h3 className="m-0 text-base font-bold text-ink md:col-span-2 xl:col-span-4">{editingCourse ? `Editar ${editingCourse.nombre}` : 'Añadir curso'}</h3>
                <label className={labelClass}>Nombre<input className={inputClass} name="nombre" defaultValue={editingCourse?.nombre ?? ''} maxLength={100} required /></label>
                <label className={labelClass}>Tema<input className={inputClass} name="tema" defaultValue={editingCourse?.tema ?? ''} maxLength={120} required /></label>
                <label className={labelClass}>Tipo<SelectField name="tipo_curso" defaultValue={editingCourse?.tipo_curso ?? 'HABITUAL'}><option value="HABITUAL">Habitual</option><option value="CURSO_ESPECIAL">Curso especial</option></SelectField></label>
                <label className={labelClass}>Descripción<input className={inputClass} name="descripcion" defaultValue={editingCourse?.descripcion ?? ''} maxLength={255} /></label>
                {courseError ? <p className="m-0 text-sm font-bold text-red-dark md:col-span-2 xl:col-span-4" role="alert">{courseError}</p> : null}
                <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-4">
                  <button className={`${buttonClass} bg-red text-white disabled:opacity-50`} type="submit" disabled={courseSaving}>{courseSaving ? 'Guardando…' : editingCourse ? 'Guardar curso' : 'Crear curso'}</button>
                  {editingCourse ? <button className={`${buttonClass} border border-line text-muted`} type="button" onClick={() => { setEditingCourse(null); setCourseError(null) }}>Dejar de editar</button> : null}
                </div>
              </form>
            </div>
          </details>

          {isAdmin ? (
            <details className="rounded-panel border border-line bg-paper/85 p-5 shadow-sm">
              <summary className="cursor-pointer font-bold text-ink">Gestionar salas <span className="ml-1 text-sm font-medium text-muted">({rooms.length})</span></summary>
              <div className="mt-4"><RoomManager rooms={rooms} onChanged={() => { refreshMetadata(); refreshEvents() }} /></div>
            </details>
          ) : null}

          <PanelCard className="p-5">
            <h2 className="m-0 text-lg font-bold text-ink">Horarios habituales</h2>
            <p className="mt-1 text-sm text-muted">Editar una regla actualiza sus sesiones futuras no modificadas. Cancelarla cancela sus sesiones futuras.</p>
            {!rules.filter((rule) => rule.activo).length ? <p className="mt-4 text-sm text-muted">No hay horarios habituales activos.</p> : (
              <ul className="mt-4 grid gap-2 md:grid-cols-2">
                {rules.filter((rule) => rule.activo).map((rule) => (
                  <li key={entityKey(rule.id_horario_recurrente)} className="rounded-soft border border-line bg-white/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <strong className="block text-sm text-ink">{rule.curso_nombre}</strong>
                        <span className="mt-1 block text-xs text-muted">{weekdays[rule.dia_semana - 1]?.label} · {rule.hora_inicio.slice(0, 5)}–{rule.hora_fin.slice(0, 5)}</span>
                        <span className="mt-1 block text-xs text-muted">{rule.sala_nombre ?? 'Sala sin asignar'} · {rule.instructor_nombre}</span>
                        <span className="mt-1 block text-xs text-muted">Desde {formatCalendarDate(rule.fecha_inicio)}{rule.fecha_fin ? ` hasta ${formatCalendarDate(rule.fecha_fin)}` : ' · sin fecha final'}</span>
                      </div>
                      <div className="flex gap-3">
                        <button className="text-sm font-bold text-red-dark underline" type="button" onClick={() => { setActionError(null); setFormTarget({ kind: 'rule-edit', rule }) }}>Editar</button>
                        <button className="text-sm font-bold text-red-dark underline" type="button" onClick={() => void cancelRule(rule)}>Cancelar regla</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>
        </div>
      ) : null}

      {eventsError ? (
        <PanelCard className="mt-5 p-4">
          <p className="m-0 text-sm font-bold text-red-dark" role="alert">{eventsError}</p>
          <button className={`${buttonClass} mt-3 border border-line text-red-dark`} type="button" onClick={refreshEvents}>Reintentar</button>
        </PanelCard>
      ) : null}

      {view === 'week' ? (
        <PanelCard className="mt-5 p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="m-0 text-xl font-bold text-ink">Horario semanal</h2><p className="mt-1 text-sm text-muted">Los bloques simultáneos se distribuyen en columnas paralelas.</p></div>
            <span className="rounded-full bg-red/10 px-3 py-1 text-sm font-bold text-red-dark">{events.length} actividades</span>
          </div>
          {eventsLoading && !events.length ? <p className="text-sm text-muted">Cargando actividades…</p> : <WeekSchedule events={events} weekKeys={weekKeys} onSelectDay={setSelectedDate} onSelectEvent={(event) => { setSelectedDate(event.fecha_hora.slice(0, 10)) }} />}
        </PanelCard>
      ) : view === 'month' ? (
        <PanelCard className="mt-5 w-full overflow-x-auto p-4 md:p-5">
          <div className="min-w-[58rem]">
            <div className="mb-2 grid grid-cols-7 gap-2 text-center text-sm font-bold text-muted">{weekdays.map((day) => <span key={day.value}>{day.label}</span>)}</div>
            <div className="grid grid-cols-7 gap-2">
              {monthKeys.map((day) => {
                const dayActivities = dayEvents(events, day)
                const outsideMonth = dateFromKey(day).getUTCMonth() !== monthDate.getUTCMonth()
                return (
                  <article key={day} className={`min-h-36 rounded-soft border p-2 ${outsideMonth ? 'border-line/70 bg-canvas/45 text-muted' : 'border-line bg-white/60 text-ink'}`}>
                    <button className="font-bold hover:text-red-dark" type="button" onClick={() => setSelectedDate(day)}>{formatCalendarDate(day, { day: 'numeric' })}</button>
                    <div className="mt-2 grid gap-1">
                      {dayActivities.slice(0, 3).map((activity) => (
                        <button key={entityKey(activity.id_curso_agendado)} className={`truncate rounded-full px-2 py-1 text-left text-[0.68rem] font-bold ${activity.activo ? 'bg-red/10 text-red-dark' : 'bg-line text-muted line-through'}`} type="button" onClick={() => setSelectedDate(day)}>
                          {formatTime(activity.fecha_hora)} {activity.curso_nombre} · {eventRoom(activity)}
                        </button>
                      ))}
                      {dayActivities.length > 3 ? <button className="text-left text-xs font-bold text-red-dark" type="button" onClick={() => setSelectedDate(day)}>+{dayActivities.length - 3} más</button> : null}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </PanelCard>
      ) : (
        <PanelCard className="mt-5 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><h2 className="m-0 text-xl font-bold text-ink">Próximas actividades</h2><p className="mt-1 text-sm text-muted">Sesiones activas de los próximos 90 días.</p></div>
            <span className="rounded-full bg-red/10 px-3 py-1 text-sm font-bold text-red-dark">{upcomingEvents.length} activas</span>
          </div>
          {!upcomingEvents.length ? <p className="mt-5 text-sm text-muted">No hay actividades próximas para este filtro.</p> : (
            <ul className="mt-4 grid divide-y divide-line">
              {upcomingEvents.map((event) => (
                <li key={entityKey(event.id_curso_agendado)} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                  <button className="text-left" type="button" onClick={() => setSelectedDate(event.fecha_hora.slice(0, 10))}>
                    <strong className="block text-base text-ink">{event.curso_nombre}</strong>
                    <span className="mt-1 block text-sm text-muted">{event.curso_tema} · {event.instructor_nombre} · {eventRoom(event)}</span>
                  </button>
                  <time className="shrink-0 text-sm font-bold text-red-dark">{formatCalendarDate(event.fecha_hora.slice(0, 10), { day: 'numeric', month: 'short' })} · {eventTimeRange(event)}</time>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      )}

      {selectedDate ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-ink/55 p-4" role="presentation" onClick={() => setSelectedDate(null)}>
          <div className="w-full max-w-3xl" role="dialog" aria-modal="true" aria-labelledby="selected-day-title" onClick={(event) => event.stopPropagation()}>
            <PanelCard className="max-h-[88vh] overflow-y-auto p-5 shadow-xl md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div><p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-red">Agenda del día</p><h2 id="selected-day-title" className="mt-2 text-2xl font-bold capitalize text-ink">{formatCalendarDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2></div>
                <button className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-white text-lg font-bold text-red-dark" type="button" onClick={() => setSelectedDate(null)} aria-label="Cerrar detalle del día">×</button>
              </div>
              {actionError ? <p className="mt-4 rounded-soft bg-red/10 p-3 text-sm font-bold text-red-dark" role="alert">{actionError}</p> : null}
              {!activitiesForSelectedDate.length ? <p className="mt-5 text-sm text-muted">No hay actividades para este día y filtro.</p> : (
                <div className="mt-5 grid gap-3">
                  {activitiesForSelectedDate.map((event) => (
                    <article key={entityKey(event.id_curso_agendado)} className="rounded-soft border border-line bg-white/70 p-4">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <h3 className="m-0 text-base font-bold text-ink">{event.curso_nombre}</h3>
                          <p className="mt-1 text-sm text-muted">{event.curso_tema} · {event.instructor_nombre}</p>
                          <p className="mt-1 text-sm font-bold text-red-dark">{eventTimeRange(event)} · {eventRoom(event)}</p>
                          <p className="mt-1 text-xs text-muted">{event.tipo_curso === 'HABITUAL' ? 'Clase habitual' : 'Curso especial'}{event.id_horario_recurrente ? ' · Regla semanal' : ''}{event.modificado_manualmente ? ' · Sesión modificada' : ''}</p>
                        </div>
                        <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${event.activo ? 'bg-green-100 text-green-800' : 'bg-line text-muted'}`}>{event.activo ? 'Activa' : 'Cancelada'}</span>
                      </div>
                      {canManage && event.activo ? (
                        <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-3">
                          <button className="text-sm font-bold text-red-dark underline" type="button" onClick={() => openEventEditor(event)}>Editar sesión</button>
                          <button className="text-sm font-bold text-red-dark underline" type="button" onClick={() => void cancelEvent(event)}>Cancelar sesión</button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </PanelCard>
          </div>
        </div>
      ) : null}
    </section>
  )
}
