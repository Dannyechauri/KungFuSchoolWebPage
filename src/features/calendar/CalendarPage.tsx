import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'
import { PanelCard } from '../../components/PanelCard'
import { SelectField } from '../../components/SelectField'
import { useAuth } from '../auth/useAuth'
import { canManageCalendar, canManageSchoolData, hasOwnProfile } from '../auth/permissions'
import {
  entityKey,
  getCalendarEvents,
  getCalendarRooms,
  type CalendarEvent,
  type CalendarRoom,
} from './calendarApi'
import { calendarErrorMessage } from './calendarErrors'
import { EventEditor, type EventEditScope } from './EventEditor'
import { EventParticipation } from './EventParticipation'
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
import type { CalendarNavigationState, CalendarPageState, CalendarView } from './calendarNavigation'

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
const courseColors = [
  { surface: 'bg-red/10', border: 'border-red/25', text: 'text-red-dark', marker: 'bg-red' },
  { surface: 'bg-gold/20', border: 'border-gold/50', text: 'text-ink', marker: 'bg-gold' },
  { surface: 'bg-green-100', border: 'border-green-200', text: 'text-green-900', marker: 'bg-green-600' },
  { surface: 'bg-blue-100', border: 'border-blue-200', text: 'text-blue-900', marker: 'bg-blue-600' },
  { surface: 'bg-purple-100', border: 'border-purple-200', text: 'text-purple-900', marker: 'bg-purple-600' },
  { surface: 'bg-orange-100', border: 'border-orange-200', text: 'text-orange-900', marker: 'bg-orange-600' },
  { surface: 'bg-teal-100', border: 'border-teal-200', text: 'text-teal-900', marker: 'bg-teal-600' },
]

function courseColor(courseId: CalendarEvent['id_curso']) {
  let hash = 2_166_136_261
  for (const character of entityKey(courseId)) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619)
  return courseColors[(hash >>> 0) % courseColors.length]!
}

function eventTimeRange(event: CalendarEvent) {
  const startDate = event.fecha_hora.slice(0, 10)
  const endDate = event.fecha_hora_fin.slice(0, 10)
  if (startDate === endDate) return `${formatTime(event.fecha_hora)}–${formatTime(event.fecha_hora_fin)}`
  return `${formatCalendarDate(startDate, { day: 'numeric', month: 'short' })} ${formatTime(event.fecha_hora)} – ${formatCalendarDate(endDate, { day: 'numeric', month: 'short' })} ${formatTime(event.fecha_hora_fin)}`
}

function eventTimeRangeForDay(event: CalendarEvent, day: string) {
  const startDate = event.fecha_hora.slice(0, 10)
  const endDate = event.fecha_hora_fin.slice(0, 10)
  if (startDate === endDate) return `${formatTime(event.fecha_hora)}–${formatTime(event.fecha_hora_fin)}`
  if (day === startDate) return `Desde ${formatTime(event.fecha_hora)}`
  if (day === endDate) return `Hasta ${formatTime(event.fecha_hora_fin)}`
  return 'Durante el día'
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

function tooltipPosition(button: HTMLButtonElement) {
  const rect = button.getBoundingClientRect()
  const width = 280
  const height = 150
  const left = rect.right + width + 12 < window.innerWidth ? rect.right + 8 : Math.max(8, rect.left - width - 8)
  const top = Math.max(8, Math.min(rect.top, window.innerHeight - height - 8))
  return { left, top }
}

function CalendarEventCard({ event, onSelect, compact = false, showTooltip = false }: { event: CalendarEvent; onSelect: () => void; compact?: boolean; showTooltip?: boolean }) {
  const [tooltip, setTooltip] = useState<{ left: number; top: number } | null>(null)
  const color = courseColor(event.id_curso)
  const duration = minutesOfDateTime(event.fecha_hora_fin) - minutesOfDateTime(event.fecha_hora)
  const compactLabel = compact && duration < 55
  const updateTooltip = (button: HTMLButtonElement) => {
    const position = tooltipPosition(button)
    setTooltip((current) => current?.left === position.left && current.top === position.top ? current : position)
  }
  const openEvent = () => {
    setTooltip(null)
    onSelect()
  }

  return (
    <>
      <button
        className={`w-full rounded-soft border text-left ${compact ? 'h-full min-h-0 overflow-hidden' : ''} ${compactLabel ? duration < 22 ? 'px-1 py-0' : 'p-1.5' : compact ? 'p-2' : 'p-3'} ${color.border} ${color.surface} ${color.text} ${event.activo ? 'hover:brightness-95' : 'opacity-70'}`}
        type="button"
        onClick={openEvent}
        onMouseEnter={(mouseEvent) => { if (showTooltip) updateTooltip(mouseEvent.currentTarget) }}
        onMouseMove={(mouseEvent) => { if (showTooltip && tooltip) updateTooltip(mouseEvent.currentTarget) }}
        onMouseLeave={() => setTooltip(null)}
        onFocus={(focusEvent) => { if (showTooltip) updateTooltip(focusEvent.currentTarget) }}
        onBlur={() => setTooltip(null)}
        aria-label={`${event.curso_nombre}, ${eventTimeRange(event)}, ${eventRoom(event)}`}
        aria-describedby={tooltip && showTooltip ? `event-tooltip-${entityKey(event.id_curso_agendado)}` : undefined}
      >
        {compactLabel ? (
          <span className={`block truncate font-black ${duration < 22 ? 'text-[0.6rem] leading-3' : 'text-[0.68rem] leading-4'} ${!event.activo ? 'line-through' : ''}`}>
            {eventTimeRange(event)} · {event.curso_nombre}
          </span>
        ) : (
          <>
            <span className={`block truncate text-xs font-black ${!event.activo ? 'line-through' : ''}`}>{eventTimeRange(event)}</span>
            <strong className={`mt-1 block leading-5 ${compact ? 'truncate text-xs' : 'text-sm'} ${!event.activo ? 'line-through' : ''}`}>{event.curso_nombre}</strong>
          </>
        )}
        {!compact ? <span className="mt-1 block truncate text-xs opacity-80">{eventRoom(event)} · {event.instructor_nombre}</span> : null}
        {!compact && event.activo && (event.mi_participacion || event.asistentes || event.completo) ? (
          <span className="mt-1 block truncate text-[0.68rem] font-bold">
            {[
              event.mi_participacion ? '✓ Apuntado' : null,
              event.asistentes ? `${event.asistentes.alumnos}${event.limite_participantes === null ? '' : `/${event.limite_participantes}`} asistentes` : null,
              event.completo ? 'Completo' : null,
            ].filter(Boolean).join(' · ')}
          </span>
        ) : null}
        {!event.activo ? <span className="mt-1 block text-[0.68rem] font-bold uppercase tracking-wide">Cancelada</span> : null}
      </button>
      {tooltip && showTooltip ? createPortal(
        <div
          id={`event-tooltip-${entityKey(event.id_curso_agendado)}`}
          className={`pointer-events-none fixed z-50 w-70 rounded-panel border p-3 text-sm shadow-xl ${color.border} ${color.surface} ${color.text}`}
          style={tooltip}
          role="tooltip"
        >
          <strong className="block">{event.curso_nombre}</strong>
          <span className="mt-1 block">{eventTimeRange(event)} · {eventRoom(event)}</span>
          <span className="mt-1 block">{event.instructor_nombre}</span>
          <span className="mt-1 block text-xs opacity-80">{event.curso_tema} · {event.tipo_curso === 'HABITUAL' ? 'Habitual' : 'Especial'}</span>
        </div>,
        document.body,
      ) : null}
    </>
  )
}

function WeekSchedule({ events, weekKeys, onSelectDay, onSelectEvent, onCreateEvent }: {
  events: CalendarEvent[]
  weekKeys: string[]
  onSelectDay: (day: string) => void
  onSelectEvent: (event: CalendarEvent) => void
  onCreateEvent?: (day: string, time: string) => void
}) {
  const singleDayEvents = events.filter((event) => event.fecha_hora.slice(0, 10) === event.fecha_hora_fin.slice(0, 10))
  const allTimes = singleDayEvents.flatMap((event) => [minutesOfDateTime(event.fecha_hora), minutesOfDateTime(event.fecha_hora_fin)])
  const firstHour = Math.min(8, ...allTimes.map((minutes) => Math.floor(minutes / 60)))
  const lastHour = Math.max(21, ...allTimes.map((minutes) => Math.ceil(minutes / 60)))
  const startMinute = Math.max(0, firstHour * 60)
  const endMinute = Math.min(24 * 60, lastHour * 60)
  const pixelsPerMinute = 1.2
  const timelineHeight = Math.max((endMinute - startMinute) * pixelsPerMinute, 13 * 60 * pixelsPerMinute)
  const hours = Array.from({ length: Math.max(1, Math.ceil(endMinute / 60) - Math.floor(startMinute / 60) + 1) }, (_, index) => Math.floor(startMinute / 60) + index)
  const spanningEvents = events.filter((event) => event.fecha_hora.slice(0, 10) !== event.fecha_hora_fin.slice(0, 10))

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto overflow-y-clip rounded-soft border border-line bg-white/70">
        <div className="min-w-[76rem]">
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-line bg-paper/70">
            <div />
            {weekKeys.map((day, index) => (
              <div key={day} className="border-l border-line">
                <button className="w-full px-2 py-3 text-center hover:bg-gold/10" type="button" onClick={() => onSelectDay(day)}>
                  <span className="block text-xs font-black uppercase tracking-wide text-red-dark">{weekdays[index]?.label}</span>
                  <strong className="mt-1 block text-lg text-ink">{formatCalendarDate(day, { day: 'numeric', month: 'short' })}</strong>
                </button>
                {spanningEvents.filter((event) => event.fecha_hora.slice(0, 10) === day).map((event) => (
                  <div key={entityKey(event.id_curso_agendado)} className="px-1 pb-2">
                    <CalendarEventCard event={event} onSelect={() => onSelectEvent(event)} compact />
                  </div>
                ))}
              </div>
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
                <div
                  key={day}
                  className={`relative border-l border-line ${today ? 'bg-gold/5' : ''}`}
                  style={{
                    height: timelineHeight,
                    backgroundImage: 'linear-gradient(to bottom, rgb(225 210 196 / 36%) 1px, transparent 1px)',
                    backgroundSize: `100% ${5 * pixelsPerMinute}px`,
                  }}
                >
                  {hours.map((hour) => (
                    <div key={hour} className="absolute inset-x-0 border-t border-line/70" style={{ top: (hour * 60 - startMinute) * pixelsPerMinute }} />
                  ))}
                      {onCreateEvent ? Array.from({ length: Math.ceil((endMinute - startMinute) / 30) }, (_, index) => {
                        const minute = startMinute + index * 30
                        const hour = Math.floor(minute / 60)
                        const minutePart = minute % 60
                        const time = `${String(hour).padStart(2, '0')}:${String(minutePart).padStart(2, '0')}`
                        const slotHeight = Math.min(30, endMinute - minute) * pixelsPerMinute
                        return (
                          <button
                            key={time}
                            className="group absolute inset-x-0 z-[1] cursor-crosshair text-left hover:bg-red/5 focus-visible:z-[5]"
                            style={{ top: (minute - startMinute) * pixelsPerMinute, height: slotHeight }}
                            type="button"
                            aria-label={`Crear actividad el ${formatCalendarDate(day, { day: 'numeric', month: 'long' })} a las ${time}`}
                            onClick={() => onCreateEvent(day, time)}
                          >
                            <span className="sr-only">Crear actividad a las {time}</span>
                            <span className="pointer-events-none absolute right-2 top-1 hidden text-sm font-bold text-red-dark group-hover:block" aria-hidden="true">+</span>
                          </button>
                        )
                      }) : null}
                  {laidOut.map(({ event, start, end, lane, laneCount }) => {
                    const style: CSSProperties = {
                      top: (start - startMinute) * pixelsPerMinute,
                      height: (end - start) * pixelsPerMinute,
                      left: `calc(${lane * 100 / laneCount}% + 3px)`,
                      width: `calc(${100 / laneCount}% - 6px)`,
                      zIndex: 2 + lane,
                    }
                    return (
                      <div key={entityKey(event.id_curso_agendado)} className="absolute" style={style}>
                        <CalendarEventCard event={event} onSelect={() => onSelectEvent(event)} compact showTooltip={laneCount > 1 || end - start < 55} />
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
  const canManage = canManageCalendar(user?.role)
  const canParticipate = hasOwnProfile(user?.role)
  const canEditParticipation = canManageSchoolData(user?.role)
  const navigate = useNavigate()
  const location = useLocation()
  const navigationState = location.state as CalendarNavigationState | null
  const restoredCalendarState = navigationState?.calendarState
  const initialToday = madridNowParts().date
  const [view, setView] = useState<CalendarView>(restoredCalendarState?.view ?? 'week')
  const [monthDate, setMonthDate] = useState(() => startOfMonth(dateFromKey(restoredCalendarState?.monthDate ?? initialToday)))
  const [weekDate, setWeekDate] = useState(() => startOfWeek(dateFromKey(restoredCalendarState?.weekDate ?? initialToday)))
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(restoredCalendarState?.roomId ?? null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [editing, setEditing] = useState<{ eventKey: string; scope: EventEditScope } | null>(null)
  const [eventNotice, setEventNotice] = useState<{ eventKey: string; text: string } | null>(null)

  function closeEvent() {
    setSelectedEvent(null)
    setEditing(null)
    setEventNotice(null)
  }

  useEffect(() => {
    if (!selectedDate && !selectedEvent) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (selectedEvent) closeEvent()
        else setSelectedDate(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedDate, selectedEvent])

  const [rooms, setRooms] = useState<CalendarRoom[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loadedMetadataKey, setLoadedMetadataKey] = useState<string | null>(null)
  const [loadedEventsKey, setLoadedEventsKey] = useState<string | null>(null)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [metadataVersion, setMetadataVersion] = useState(0)
  const [eventsVersion, setEventsVersion] = useState(0)

  const today = madridNowParts()
  const weekKeys = useMemo(() => weekDateKeys(weekDate), [weekDate])
  const monthKeys = useMemo(() => monthDateKeys(monthDate), [monthDate])
  const range = useMemo(() => {
    if (view === 'week') return { from: `${weekKeys[0]}T00:00`, to: `${addDaysToKey(weekKeys[6] ?? today.date, 1)}T00:00` }
    if (view === 'month') return { from: `${monthKeys[0]}T00:00`, to: `${addDaysToKey(monthKeys[41] ?? today.date, 1)}T00:00` }
    return { from: `${today.date}T00:00`, to: `${addDaysToKey(today.date, 90)}T23:59` }
  }, [view, weekKeys, monthKeys, today.date])
  const metadataRequestKey = `rooms:${metadataVersion}`
  const eventsRequestKey = `${range.from}|${range.to}|${selectedRoomId ?? 'all'}|${eventsVersion}`
  const metadataLoading = loadedMetadataKey !== metadataRequestKey
  const eventsLoading = loadedEventsKey !== eventsRequestKey
  const monthTitle = formatCalendarDate(dateKey(monthDate), { month: 'long', year: 'numeric' })
  const weekTitle = `${formatCalendarDate(weekKeys[0] ?? today.date, { day: 'numeric', month: 'short' })} – ${formatCalendarDate(weekKeys[6] ?? today.date, { day: 'numeric', month: 'long', year: 'numeric' })}`
  const activitiesForSelectedDate = useMemo(() => selectedDate ? dayEvents(events, selectedDate) : [], [events, selectedDate])
  const shownEvent = selectedEvent
    ? events.find((event) => entityKey(event.id_curso_agendado) === entityKey(selectedEvent.id_curso_agendado)) ?? selectedEvent
    : null
  const shownEventKey = shownEvent ? entityKey(shownEvent.id_curso_agendado) : ''
  const editScope = shownEvent && editing?.eventKey === shownEventKey ? editing.scope : null
  const shownNotice = shownEvent && eventNotice?.eventKey === shownEventKey ? eventNotice.text : null
  const upcomingEvents = useMemo(() => events
    .filter((event) => event.activo && event.fecha_hora_fin >= today.dateTime)
    .sort((first, second) => first.fecha_hora.localeCompare(second.fecha_hora)), [events, today.dateTime])

  useEffect(() => {
    let active = true
    getCalendarRooms()
      .then((loadedRooms) => {
        if (!active) return
        setRooms(loadedRooms)
        setMetadataError(null)
      })
      .catch((error: unknown) => { if (active) setMetadataError(calendarErrorMessage(error)) })
      .finally(() => { if (active) setLoadedMetadataKey(metadataRequestKey) })
    return () => { active = false }
  }, [metadataVersion, metadataRequestKey])

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
      .catch((error: unknown) => { if (active) setEventsError(calendarErrorMessage(error)) })
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

  function openManagement(event?: CalendarEvent, createEventAt?: string) {
    setSelectedDate(null)
    closeEvent()
    const calendarState: CalendarPageState = {
      view,
      monthDate: dateKey(monthDate),
      weekDate: dateKey(weekDate),
      roomId: selectedRoomId,
    }
    navigate('/calendario/gestionar', {
      state: {
        returnTo: `${location.pathname}${location.search}`,
        calendarState,
        ...(event ? { editEvent: event } : {}),
        ...(createEventAt ? { createEventAt } : {}),
      } satisfies CalendarNavigationState,
    })
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
          <button className={`${buttonClass} mt-3 border border-line text-red-dark`} type="button" onClick={() => setMetadataVersion((version) => version + 1)}>Reintentar</button>
        </PanelCard>
      ) : null}

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <div className="inline-flex w-fit rounded-full border border-line bg-paper p-1" role="group" aria-label="Vista de calendario">
          {([['month', 'Mes'], ['week', 'Semana'], ['upcoming', 'Próximas']] as const).map(([value, label]) => (
            <button key={value} className={`${buttonClass} ${view === value ? 'bg-red text-white' : 'text-muted'}`} type="button" onClick={() => setView(value)} aria-pressed={view === value}>{label}</button>
          ))}
        </div>
        {canManage ? <button className={`${buttonClass} bg-red text-white hover:bg-red-dark`} type="button" onClick={() => openManagement()}>Gestionar agenda</button> : null}
        <label className="flex items-center gap-2 text-sm font-bold text-muted">
          Filtrar por sala
          <SelectField wrapperClassName="w-48 shrink-0" value={selectedRoomId ?? ''} onChange={(event) => setSelectedRoomId(event.target.value || null)}>
            <option value="">Todas las salas</option>
            {rooms.map((room) => <option key={entityKey(room.id_sala)} value={entityKey(room.id_sala)}>{room.nombre}{room.activo ? '' : ' · Inactiva'}</option>)}
          </SelectField>
        </label>
        {eventsLoading ? <span className="text-sm text-muted" role="status" aria-live="polite">Actualizando…</span> : null}
        {view !== 'upcoming' ? (
          <div className="ml-auto flex items-center gap-3">
            <button className="size-10 rounded-soft border border-line bg-paper font-bold text-red-dark" type="button" onClick={() => view === 'month' ? setMonthDate((date) => addMonths(date, -1)) : setWeekDate((date) => addDays(date, -7))} aria-label={view === 'month' ? 'Mes anterior' : 'Semana anterior'}>←</button>
            <strong className="min-w-56 text-center text-base capitalize text-ink">{view === 'month' ? monthTitle : weekTitle}</strong>
            <button className="size-10 rounded-soft border border-line bg-paper font-bold text-red-dark" type="button" onClick={() => view === 'month' ? setMonthDate((date) => addMonths(date, 1)) : setWeekDate((date) => addDays(date, 7))} aria-label={view === 'month' ? 'Mes siguiente' : 'Semana siguiente'}>→</button>
          </div>
        ) : null}
      </div>

      {eventsError ? (
        <PanelCard className="mt-5 p-4">
          <p className="m-0 text-sm font-bold text-red-dark" role="alert">{eventsError}</p>
          <button className={`${buttonClass} mt-3 border border-line text-red-dark`} type="button" onClick={() => setEventsVersion((version) => version + 1)}>Reintentar</button>
        </PanelCard>
      ) : null}

      {view === 'week' ? (
        <PanelCard className="mt-5 p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="m-0 text-xl font-bold text-ink">Horario semanal</h2><p className="mt-1 text-sm text-muted">Los bloques simultáneos se distribuyen en columnas paralelas.</p></div>
            <span className="rounded-full bg-red/10 px-3 py-1 text-sm font-bold text-red-dark">{events.length} actividades</span>
          </div>
          {eventsLoading && !events.length ? <p className="text-sm text-muted">Cargando actividades…</p> : <WeekSchedule events={events} weekKeys={weekKeys} onSelectDay={setSelectedDate} onSelectEvent={setSelectedEvent} onCreateEvent={canManage ? (day, time) => openManagement(undefined, `${day}T${time}`) : undefined} />}
        </PanelCard>
      ) : view === 'month' ? (
        <PanelCard className="mt-5 w-full overflow-x-auto overflow-y-clip p-4 md:p-5">
          <div className="min-w-[58rem]">
            <div className="mb-2 grid grid-cols-7 gap-2 text-center text-sm font-bold text-muted">{weekdays.map((day) => <span key={day.value}>{day.label}</span>)}</div>
            <div className="grid grid-cols-7 gap-2">
              {monthKeys.map((day) => {
                const dayActivities = dayEvents(events, day)
                const outsideMonth = dateFromKey(day).getUTCMonth() !== monthDate.getUTCMonth()
                return (
                  <article key={day} className={`min-h-36 rounded-soft border p-2 ${outsideMonth ? 'border-line/70 bg-canvas/45 text-muted' : 'border-line bg-white/60 text-ink'}`}>
                    <div className="flex items-center justify-between gap-1">
                      <button className="font-bold hover:text-red-dark" type="button" onClick={() => setSelectedDate(day)}>{formatCalendarDate(day, { day: 'numeric' })}</button>
                      {canManage ? <button className="grid size-6 place-items-center rounded-full text-sm font-black text-red-dark hover:bg-red/10" type="button" aria-label={`Crear actividad el ${formatCalendarDate(day, { day: 'numeric', month: 'long' })}`} onClick={() => openManagement(undefined, `${day}T18:30`)}>+</button> : null}
                    </div>
                    <div className="mt-2 grid gap-1">
                      {dayActivities.slice(0, 3).map((activity) => (
                        <button key={entityKey(activity.id_curso_agendado)} className={`truncate rounded-full border px-2 py-1 text-left text-[0.68rem] font-bold ${courseColor(activity.id_curso).border} ${activity.activo ? `${courseColor(activity.id_curso).surface} ${courseColor(activity.id_curso).text}` : 'bg-line text-muted line-through'}`} type="button" onClick={() => setSelectedEvent(activity)}>
                          {eventTimeRangeForDay(activity, day)} {activity.curso_nombre} · {eventRoom(activity)}
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
                  <button className="flex items-start gap-3 text-left" type="button" onClick={() => setSelectedEvent(event)}>
                    <span className={`mt-1.5 size-3 shrink-0 rounded-full ${courseColor(event.id_curso).marker}`} aria-hidden="true" />
                    <span><strong className="block text-base text-ink">{event.curso_nombre}</strong>
                    <span className="mt-1 block text-sm text-muted">{event.curso_tema} · {event.instructor_nombre} · {eventRoom(event)}</span>
                    </span>
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
              {!activitiesForSelectedDate.length ? <p className="mt-5 text-sm text-muted">No hay actividades para este día y filtro.</p> : (
                <div className="mt-5 grid gap-3">
                  {activitiesForSelectedDate.map((event) => (
                    <article key={entityKey(event.id_curso_agendado)} className={`rounded-soft border ${courseColor(event.id_curso).border} ${courseColor(event.id_curso).surface} p-4`}>
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <button className="text-left" type="button" onClick={() => { setSelectedDate(null); setSelectedEvent(event) }}><h3 className="m-0 text-base font-bold text-ink">{event.curso_nombre}</h3></button>
                          <p className="mt-1 text-sm text-muted">{event.curso_tema} · {event.instructor_nombre}</p>
                          <p className="mt-1 text-sm font-bold text-red-dark">{eventTimeRange(event)} · {eventRoom(event)}</p>
                          <p className="mt-1 text-xs text-muted">{event.tipo_curso === 'HABITUAL' ? 'Clase habitual' : 'Curso especial'}{event.id_horario_recurrente ? ' · Regla semanal' : ''}{event.modificado_manualmente ? ' · Sesión modificada' : ''}</p>
                        </div>
                        <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${event.activo ? 'bg-green-100 text-green-800' : 'bg-line text-muted'}`}>{event.activo ? 'Activa' : 'Cancelada'}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {canManage ? <button className={`${buttonClass} mt-5 bg-red text-white`} type="button" onClick={() => openManagement(undefined, `${selectedDate}T18:30`)}>Crear actividad para este día</button> : null}
            </PanelCard>
          </div>
        </div>
      ) : null}

      {shownEvent ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/55 p-4" role="presentation" onClick={closeEvent}>
          <div className="w-full max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="selected-event-title" onClick={(event) => event.stopPropagation()}>
            <PanelCard className={`max-h-[88vh] overflow-y-auto border-t-4 p-5 shadow-xl md:p-6 ${courseColor(shownEvent.id_curso).border}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-red">Detalle de la actividad</p>
                  <h2 id="selected-event-title" className="mt-2 text-2xl font-bold text-ink">{shownEvent.curso_nombre}</h2>
                </div>
                <button className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-white text-lg font-bold text-red-dark" type="button" onClick={closeEvent} aria-label="Cerrar detalle de la actividad">×</button>
              </div>
              {editScope ? (
                <div className="mt-5">
                  <EventEditor
                    key={`${editScope}-${entityKey(shownEvent.id_curso_agendado)}`}
                    event={shownEvent}
                    scope={editScope}
                    canEditParticipation={canEditParticipation}
                    onClose={() => setEditing(null)}
                    onDone={(text) => {
                      setEditing(null)
                      setEventNotice({ eventKey: shownEventKey, text })
                      setEventsVersion((version) => version + 1)
                    }}
                  />
                </div>
              ) : (
              <div className="mt-5 grid gap-3 text-sm">
                {shownNotice ? <p className="m-0 rounded-soft bg-green-100 p-3 text-sm font-bold text-green-800" role="status">{shownNotice}</p> : null}
                <p className="m-0 text-base font-bold text-red-dark">{eventTimeRange(shownEvent)}</p>
                <p className="m-0 text-muted">{shownEvent.curso_tema}</p>
                {shownEvent.descripcion ? <p className="m-0 whitespace-pre-wrap leading-6 text-ink">{shownEvent.descripcion}</p> : null}
                {shownEvent.curso_descripcion ? <p className="m-0 leading-6 text-muted">{shownEvent.curso_descripcion}</p> : null}
                <dl className="grid gap-3 rounded-soft border border-line bg-white/60 p-4 sm:grid-cols-2">
                  <div><dt className="text-xs font-bold uppercase tracking-wide text-muted">Instructor</dt><dd className="mt-1 font-semibold text-ink">{shownEvent.instructor_nombre}</dd></div>
                  <div><dt className="text-xs font-bold uppercase tracking-wide text-muted">Sala</dt><dd className="mt-1 font-semibold text-ink">{eventRoom(shownEvent)}</dd></div>
                  <div><dt className="text-xs font-bold uppercase tracking-wide text-muted">Tipo</dt><dd className="mt-1 font-semibold text-ink">{shownEvent.tipo_curso === 'HABITUAL' ? 'Clase habitual' : 'Curso especial'}</dd></div>
                  <div><dt className="text-xs font-bold uppercase tracking-wide text-muted">Estado</dt><dd className="mt-1 font-semibold text-ink">{shownEvent.activo ? 'Activa' : 'Cancelada'}</dd></div>
                  {shownEvent.id_horario_recurrente ? <div className="sm:col-span-2"><dt className="text-xs font-bold uppercase tracking-wide text-muted">Origen</dt><dd className="mt-1 font-semibold text-ink">{shownEvent.modificado_manualmente ? 'Ocurrencia de horario habitual, modificada individualmente' : 'Ocurrencia de horario habitual'}</dd></div> : null}
                </dl>
                <EventParticipation
                  key={entityKey(shownEvent.id_curso_agendado)}
                  event={shownEvent}
                  canParticipate={canParticipate}
                  canChooseInstructorRole={user?.role === 'INSTRUCTOR'}
                  canSeeParticipants={canManage}
                  hasStarted={shownEvent.fecha_hora <= today.dateTime}
                  onChanged={() => setEventsVersion((version) => version + 1)}
                />
              </div>
              )}
              {editScope ? null : (
              <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-4">
                {canManage && shownEvent.activo ? <button className={`${buttonClass} bg-red text-white`} type="button" onClick={() => { setEventNotice(null); setEditing({ eventKey: shownEventKey, scope: 'event' }) }}>{shownEvent.id_horario_recurrente ? 'Editar esta sesión' : 'Editar sesión'}</button> : null}
                {canManage && shownEvent.activo && shownEvent.id_horario_recurrente ? <button className={`${buttonClass} border border-red text-red-dark`} type="button" onClick={() => { setEventNotice(null); setEditing({ eventKey: shownEventKey, scope: 'rule' }) }}>Editar horario habitual</button> : null}
                <button className={`${buttonClass} border border-line text-muted`} type="button" onClick={closeEvent}>Cerrar</button>
              </div>
              )}
            </PanelCard>
          </div>
        </div>
      ) : null}
    </section>
  )
}
