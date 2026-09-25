import type { FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api/client'
import { PanelCard } from '../components/PanelCard'
import { dateKey, formatActivityDate } from '../data/demoActivities'
import { useAuth } from '../features/auth/useAuth'

type CalendarView = 'month' | 'week' | 'upcoming'

const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type Course = {
  id_curso: number
  nombre: string
  tema: string
}

type Instructor = {
  id_instructor: number
  nombre: string
}

type ScheduledCourse = {
  id_curso_agendado: number
  id_curso: number
  id_instructor: number
  fecha_hora: string
  activo: boolean
}

type CalendarActivity = {
  id: number
  date: Date
  time: string
  title: string
  topic: string
  instructor: string
  active: boolean
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function startOfWeek(date: Date) {
  const weekStart = new Date(date)
  const offset = (weekStart.getDay() + 6) % 7
  weekStart.setDate(weekStart.getDate() - offset)
  weekStart.setHours(0, 0, 0, 0)
  return weekStart
}

function addWeeks(date: Date, amount: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + (amount * 7))
  return startOfWeek(result)
}

function weekDays(weekDate: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekDate)
    date.setDate(date.getDate() + index)
    return date
  })
}

function formatWeekRange(firstDay: Date, lastDay: Date) {
  const dayFormatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric' })
  const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
  return dayFormatter.format(firstDay) + '–' + dayFormatter.format(lastDay) + ' de ' + monthFormatter.format(lastDay)
}

function monthCells(monthDate: Date) {
  const firstDay = startOfMonth(monthDate)
  const startOffset = (firstDay.getDay() + 6) % 7
  const firstCell = new Date(firstDay)
  firstCell.setDate(firstDay.getDate() - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell)
    date.setDate(firstCell.getDate() + index)
    return date
  })
}

function requestCalendarData() {
  return Promise.all([
    apiRequest<Course[]>('/api/database/tables/cursos/rows?limit=500'),
    apiRequest<Instructor[]>('/api/database/tables/instructores/rows?limit=500'),
    apiRequest<ScheduledCourse[]>('/api/database/tables/cursos_agendados/rows?limit=500'),
  ])
}

export function CalendarPage() {
  const { user } = useAuth()
  const [view, setView] = useState<CalendarView>('week')
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()))
  const [weekDate, setWeekDate] = useState(() => startOfWeek(new Date()))
  const [referenceTime] = useState(() => Date.now())
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [scheduledCourses, setScheduledCourses] = useState<ScheduledCourse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCalendar = useCallback(async () => {
    try {
      const [loadedCourses, loadedInstructors, loadedScheduledCourses] = await requestCalendarData()
      setCourses(loadedCourses)
      setInstructors(loadedInstructors)
      setScheduledCourses(loadedScheduledCourses)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el calendario.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    async function synchronizeCalendar() {
      try {
        const [loadedCourses, loadedInstructors, loadedScheduledCourses] = await requestCalendarData()
        if (!active) return
        setCourses(loadedCourses)
        setInstructors(loadedInstructors)
        setScheduledCourses(loadedScheduledCourses)
        setError(null)
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el calendario.')
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void synchronizeCalendar()

    return () => {
      active = false
    }
  }, [])

  const activities = useMemo<CalendarActivity[]>(() => {
    const coursesById = new Map(courses.map((course) => [course.id_curso, course]))
    const instructorsById = new Map(instructors.map((instructor) => [instructor.id_instructor, instructor]))

    return scheduledCourses
      .map((scheduledCourse) => {
        const date = new Date(scheduledCourse.fecha_hora)
        const course = coursesById.get(scheduledCourse.id_curso)
        const instructor = instructorsById.get(scheduledCourse.id_instructor)
        return {
          id: scheduledCourse.id_curso_agendado,
          date,
          time: new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date),
          title: course?.nombre ?? 'Curso sin nombre',
          topic: course?.tema ?? 'Sin tema',
          instructor: instructor?.nombre ?? 'Instructor sin asignar',
          active: scheduledCourse.activo !== false,
        }
      })
      .filter((activity) => !Number.isNaN(activity.date.getTime()))
      .sort((first, second) => first.date.getTime() - second.date.getTime())
  }, [courses, instructors, scheduledCourses])
  const upcomingActivities = useMemo(
    () => activities.filter((activity) => activity.active && activity.date.getTime() >= referenceTime),
    [activities, referenceTime],
  )
  const activitiesByDay = useMemo(() => {
    const grouped = new Map<string, typeof activities>()

    for (const activity of activities) {
      const key = dateKey(activity.date)
      grouped.set(key, [...(grouped.get(key) ?? []), activity])
    }

    return grouped
  }, [activities])
  const monthTitle = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(monthDate)
  const weekDates = useMemo(() => weekDays(weekDate), [weekDate])
  const weekTitle = formatWeekRange(weekDates[0], weekDates[6])
  const selectedActivities = selectedDate ? activitiesByDay.get(dateKey(selectedDate)) ?? [] : []

  async function handleCreateActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const dateValue = String(formData.get('date'))
    const timeValue = String(formData.get('time'))
    const date = new Date(`${dateValue}T${timeValue}`)

    if (Number.isNaN(date.getTime())) {
      setError('La fecha y la hora no son válidas.')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await apiRequest('/api/database/tables/cursos_agendados/rows', {
        method: 'POST',
        body: JSON.stringify({
          id_curso: Number(formData.get('course')),
          id_instructor: Number(formData.get('instructor')),
          fecha_hora: `${dateValue}T${timeValue}`,
          activo: true,
        }),
      })
      await loadCalendar()
      setMonthDate(startOfMonth(date))
      setWeekDate(startOfWeek(date))
      setView('week')
      setIsCreateOpen(false)
      form.reset()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la actividad.')
    } finally {
      setIsSaving(false)
    }
  }

  const isAdmin = user?.role === 'ADMIN'

  if (isLoading) {
    return <section className="w-full text-muted">Cargando calendario…</section>
  }

  if (error && courses.length === 0) {
    return (
      <section className="w-full">
        <h1 className="m-0 text-4xl font-bold text-ink">Calendario</h1>
        <PanelCard className="mt-6 p-6">
          <p className="m-0 text-red-dark">{error}</p>
          <button className="mt-4 min-h-10 rounded-full bg-red px-4 text-sm font-bold text-white" type="button" onClick={() => { setIsLoading(true); void loadCalendar() }}>
            Reintentar
          </button>
        </PanelCard>
      </section>
    )
  }

  return (
    <section className="w-full">
      <p className="mb-2 text-xs font-black tracking-[0.12em] text-red uppercase">Calendario</p>
      <h1 className="m-0 text-4xl font-bold tracking-tight text-ink md:text-5xl">Agenda de clases y actividades</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
        Aquí mostraremos las actividades agendadas por curso, instructor y fecha.
      </p>

      <div className="mt-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex w-fit rounded-full border border-line bg-paper p-1">
            <button
              className={`min-h-10 rounded-full px-4 text-sm font-bold ${view === 'month' ? 'bg-red text-white' : 'text-muted'}`}
              type="button"
              onClick={() => setView('month')}
            >
              Mes
            </button>
            <button
              className={'min-h-10 rounded-full px-4 text-sm font-bold ' + (view === 'week' ? 'bg-red text-white' : 'text-muted')}
              type="button"
              onClick={() => setView('week')}
            >
              Semana
            </button>
            <button
              className={`min-h-10 rounded-full px-4 text-sm font-bold ${view === 'upcoming' ? 'bg-red text-white' : 'text-muted'}`}
              type="button"
              onClick={() => setView('upcoming')}
            >
              Próximas actividades
            </button>
          </div>
          {isAdmin ? (
            <button className="min-h-10 rounded-full bg-red px-4 text-sm font-bold text-white hover:bg-red-dark" type="button" onClick={() => setIsCreateOpen((open) => !open)}>
              {isCreateOpen ? 'Cerrar formulario' : '+ Añadir actividad'}
            </button>
          ) : null}
        </div>

        {view !== 'upcoming' ? (
          <div className="flex items-center gap-3">
            <button className="size-10 rounded-soft border border-line bg-paper font-bold text-red-dark" type="button" onClick={() => view === 'month' ? setMonthDate(addMonths(monthDate, -1)) : setWeekDate(addWeeks(weekDate, -1))} aria-label={view === 'month' ? 'Mes anterior' : 'Semana anterior'}>
              ←
            </button>
            <strong className="min-w-56 text-center text-base capitalize text-ink">{view === 'month' ? monthTitle : weekTitle}</strong>
            <button className="size-10 rounded-soft border border-line bg-paper font-bold text-red-dark" type="button" onClick={() => view === 'month' ? setMonthDate(addMonths(monthDate, 1)) : setWeekDate(addWeeks(weekDate, 1))} aria-label={view === 'month' ? 'Mes siguiente' : 'Semana siguiente'}>
              →
            </button>
          </div>
        ) : null}
      </div>

      {isCreateOpen ? (
        <PanelCard className="mt-5 p-6">
          <h2 className="m-0 text-xl font-bold text-ink">Añadir actividad</h2>
          <p className="mt-1 text-sm text-muted">La actividad se guardará en el calendario de la escuela.</p>
          <form className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleCreateActivity}>
            <label className="grid gap-2 text-sm font-bold text-muted">
              Curso
              <select className="min-h-11 rounded-soft border border-line bg-white px-3 text-ink" name="course" defaultValue={courses[0]?.id_curso} required>
                {courses.map((course) => <option key={course.id_curso} value={course.id_curso}>{course.nombre}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-muted">
              Instructor
              <select className="min-h-11 rounded-soft border border-line bg-white px-3 text-ink" name="instructor" defaultValue={instructors[0]?.id_instructor} required>
                {instructors.map((instructor) => <option key={instructor.id_instructor} value={instructor.id_instructor}>{instructor.nombre}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-muted">
              Fecha
              <input className="min-h-11 rounded-soft border border-line bg-white px-3 text-ink" name="date" type="date" required />
            </label>
            <label className="grid gap-2 text-sm font-bold text-muted">
              Hora
              <input className="min-h-11 rounded-soft border border-line bg-white px-3 text-ink" name="time" type="time" defaultValue="18:30" required />
            </label>
            <div className="md:col-span-2 xl:col-span-4">
              {error ? <p className="mb-3 rounded-soft bg-red/10 p-3 text-sm font-bold text-red-dark">{error}</p> : null}
              <button className="min-h-11 rounded-full bg-red px-5 text-sm font-bold text-white hover:bg-red-dark disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSaving || courses.length === 0 || instructors.length === 0}>
                {isSaving ? 'Guardando…' : 'Añadir al calendario'}
              </button>
            </div>
          </form>
        </PanelCard>
      ) : null}

      {view === 'month' ? (
        <PanelCard className="mt-5 w-full overflow-x-auto p-5">
          <div className="min-w-[52rem]">
            <div className="mb-2 grid grid-cols-7 gap-2 text-center text-sm font-bold text-muted">
              {weekdays.map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {monthCells(monthDate).map((date) => {
                const dayActivities = activitiesByDay.get(dateKey(date)) ?? []
                const outsideMonth = date.getMonth() !== monthDate.getMonth()

                return (
                  <button
                    key={dateKey(date)}
                    className={`flex min-h-40 flex-col rounded-soft border border-line p-2.5 text-left ${outsideMonth ? 'bg-canvas/45 text-muted' : 'bg-white/60 text-ink hover:border-gold'}`}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                  >
                    <strong className="text-sm">{date.getDate()}</strong>
                    <div className="mt-2 grid gap-1.5">
                      {dayActivities.map((activity) => (
                        <span key={activity.id} className={`truncate rounded-full px-2 py-1 text-xs font-bold ${activity.active ? 'bg-red/10 text-red-dark' : 'bg-line text-muted line-through'}`}>
                          {activity.time} {activity.title}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </PanelCard>
      ) : view === 'week' ? (
        <PanelCard className="mt-5 w-full overflow-x-auto p-5">
          <div className="min-w-[66rem]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="m-0 text-xl font-bold text-ink">Horario semanal</h2>
                <p className="mt-1 text-sm text-muted">Las actividades se ordenan por su hora de inicio.</p>
              </div>
              <span className="rounded-full bg-red/10 px-3 py-1 text-sm font-bold text-red-dark">Semana</span>
            </div>
            <div className="grid grid-cols-7 gap-3">
              {weekDates.map((date) => {
                const dayActivities = activitiesByDay.get(dateKey(date)) ?? []
                const isToday = dateKey(date) === dateKey(new Date())

                return (
                  <article key={dateKey(date)} className={'min-h-80 rounded-soft border p-3 ' + (isToday ? 'border-gold bg-gold/10' : 'border-line bg-white/60')}>
                    <header className="border-b border-line pb-3">
                      <span className="block text-xs font-black tracking-[0.12em] text-red uppercase">{new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date)}</span>
                      <strong className="mt-1 block text-2xl text-ink">{date.getDate()}</strong>
                    </header>
                    {dayActivities.length === 0 ? (
                      <p className="mt-4 text-sm text-muted">Sin actividades</p>
                    ) : (
                      <ol className="mt-3 grid gap-2">
                        {dayActivities.map((activity) => (
                          <li key={activity.id}>
                            <button className={'w-full rounded-soft p-3 text-left ' + (activity.active ? 'bg-red/10 text-red-dark hover:bg-red/15' : 'bg-line text-muted line-through')} type="button" onClick={() => setSelectedDate(date)}>
                              <time className="block text-sm font-black">{activity.time}</time>
                              <strong className="mt-1 block text-sm leading-5">{activity.title}</strong>
                              <span className="mt-1 block text-xs leading-4 opacity-80">{activity.topic} · {activity.instructor}</span>
                            </button>
                          </li>
                        ))}
                      </ol>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        </PanelCard>
      ) : (
        <PanelCard className="mt-5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="m-0 text-xl font-bold text-ink">Próximas actividades</h2>
              <p className="mt-1 text-sm text-muted">Ordenadas por fecha y hora.</p>
            </div>
            <span className="rounded-full bg-red/10 px-3 py-1 text-sm font-bold text-red-dark">{upcomingActivities.length} activas</span>
          </div>

          <ul className="mt-5 grid divide-y divide-line">
            {upcomingActivities.map((activity) => (
              <li key={activity.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <strong className="block text-base text-ink">{activity.title}</strong>
                  <span className="mt-1 block text-sm text-muted">{activity.topic} · {activity.instructor}</span>
                </div>
                <time className="shrink-0 text-sm font-bold text-red-dark">{formatActivityDate(activity.date)}</time>
              </li>
            ))}
          </ul>
        </PanelCard>
      )}

      {selectedDate ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-ink/55 p-5" role="presentation" onClick={() => setSelectedDate(null)}>
          <div className="w-full max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="selected-day-title" onClick={(event) => event.stopPropagation()}>
            <PanelCard className="max-h-[85vh] overflow-y-auto p-6 shadow-xl">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="m-0 text-xs font-black tracking-[0.12em] text-red uppercase">Día seleccionado</p>
                  <h2 id="selected-day-title" className="mt-2 text-2xl font-bold text-ink">
                    {new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(selectedDate)}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-fit rounded-full bg-red/10 px-3 py-1 text-sm font-bold text-red-dark">
                    {selectedActivities.length} {selectedActivities.length === 1 ? 'actividad' : 'actividades'}
                  </span>
                  <button className="grid size-9 place-items-center rounded-full border border-line bg-white text-lg font-bold text-red-dark hover:border-red" type="button" onClick={() => setSelectedDate(null)} aria-label="Cerrar detalle del día">
                    ×
                  </button>
                </div>
              </div>

              {selectedActivities.length === 0 ? (
                <p className="mt-5 text-base text-muted">No hay actividades programadas para este día.</p>
              ) : (
                <div className="mt-5 grid gap-3">
                  {selectedActivities.map((activity) => (
                    <article key={activity.id} className="rounded-soft border border-line bg-white/60 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="m-0 text-base font-bold text-ink">{activity.title}</h3>
                          <p className="mt-1 text-sm text-muted">{activity.topic} · {activity.instructor}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <time className="text-sm font-bold text-red-dark">{activity.time}</time>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${activity.active ? 'bg-green-100 text-green-800' : 'bg-line text-muted'}`}>
                            {activity.active ? 'Activa' : 'Cancelada'}
                          </span>
                        </div>
                      </div>
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
