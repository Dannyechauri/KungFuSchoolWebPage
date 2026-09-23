import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { PanelCard } from '../components/PanelCard'
import { dateKey, formatActivityDate, getDemoActivities, type DatedDemoActivity } from '../data/demoActivities'

type CalendarView = 'month' | 'upcoming'

const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
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

function dateFromForm(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const [hour, minute] = timeValue.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute)
}

export function CalendarPage() {
  const [view, setView] = useState<CalendarView>('month')
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()))
  const [referenceTime] = useState(() => Date.now())
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [createdActivities, setCreatedActivities] = useState<DatedDemoActivity[]>([])
  const baseActivities = useMemo(() => getDemoActivities(), [])
  const activities = useMemo(
    () => [...baseActivities, ...createdActivities].sort((first, second) => first.date.getTime() - second.date.getTime()),
    [baseActivities, createdActivities],
  )
  const upcomingActivities = useMemo(
    () => activities.filter((activity) => activity.active && activity.date.getTime() >= referenceTime),
    [activities, referenceTime],
  )
  const courses = useMemo(
    () => Array.from(new Map(baseActivities.map((activity) => [activity.title, activity])).values()),
    [baseActivities],
  )
  const instructors = useMemo(
    () => Array.from(new Set(baseActivities.map((activity) => activity.instructor))),
    [baseActivities],
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
  const selectedActivities = selectedDate ? activitiesByDay.get(dateKey(selectedDate)) ?? [] : []

  function handleCreateActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const title = String(formData.get('course'))
    const course = courses.find((item) => item.title === title)
    const date = dateFromForm(String(formData.get('date')), String(formData.get('time')))

    if (!course || Number.isNaN(date.getTime())) return

    const activity: DatedDemoActivity = {
      id: `local-${Date.now()}`,
      dayOffset: 0,
      time: String(formData.get('time')),
      title: course.title,
      topic: course.topic,
      instructor: String(formData.get('instructor')),
      active: true,
      date,
    }

    setCreatedActivities((currentActivities) => [...currentActivities, activity])
    setMonthDate(startOfMonth(date))
    setSelectedDate(date)
    setView('month')
    setIsCreateOpen(false)
    event.currentTarget.reset()
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
              className={`min-h-10 rounded-full px-4 text-sm font-bold ${view === 'upcoming' ? 'bg-red text-white' : 'text-muted'}`}
              type="button"
              onClick={() => setView('upcoming')}
            >
              Próximas actividades
            </button>
          </div>
          <button className="min-h-10 rounded-full bg-red px-4 text-sm font-bold text-white hover:bg-red-dark" type="button" onClick={() => setIsCreateOpen((open) => !open)}>
            {isCreateOpen ? 'Cerrar formulario' : '+ Añadir actividad'}
          </button>
        </div>

        {view === 'month' ? (
          <div className="flex items-center gap-3">
            <button className="size-10 rounded-soft border border-line bg-paper font-bold text-red-dark" type="button" onClick={() => setMonthDate(addMonths(monthDate, -1))} aria-label="Mes anterior">
              ←
            </button>
            <strong className="min-w-40 text-center text-base capitalize text-ink">{monthTitle}</strong>
            <button className="size-10 rounded-soft border border-line bg-paper font-bold text-red-dark" type="button" onClick={() => setMonthDate(addMonths(monthDate, 1))} aria-label="Mes siguiente">
              →
            </button>
          </div>
        ) : null}
      </div>

      {isCreateOpen ? (
        <PanelCard className="mt-5 p-6">
          <h2 className="m-0 text-xl font-bold text-ink">Añadir actividad</h2>
          <p className="mt-1 text-sm text-muted">Esta primera versión la añade solo a la sesión actual de la página.</p>
          <form className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleCreateActivity}>
            <label className="grid gap-2 text-sm font-bold text-muted">
              Curso
              <select className="min-h-11 rounded-soft border border-line bg-white px-3 text-ink" name="course" defaultValue={courses[0]?.title} required>
                {courses.map((course) => <option key={course.id} value={course.title}>{course.title}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-muted">
              Instructor
              <select className="min-h-11 rounded-soft border border-line bg-white px-3 text-ink" name="instructor" defaultValue={instructors[0]} required>
                {instructors.map((instructor) => <option key={instructor} value={instructor}>{instructor}</option>)}
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
              <button className="min-h-11 rounded-full bg-red px-5 text-sm font-bold text-white hover:bg-red-dark" type="submit">
                Añadir al calendario
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
                    className={`self-start rounded-soft border border-line p-2.5 text-left ${outsideMonth ? 'min-h-20 bg-canvas/45 text-muted' : 'min-h-40 bg-white/60 text-ink hover:border-gold'}`}
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
        <PanelCard className="mt-5 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="m-0 text-xs font-black tracking-[0.12em] text-red uppercase">Día seleccionado</p>
              <h2 className="mt-2 text-2xl font-bold text-ink">
                {new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(selectedDate)}
              </h2>
            </div>
            <span className="w-fit rounded-full bg-red/10 px-3 py-1 text-sm font-bold text-red-dark">
              {selectedActivities.length} {selectedActivities.length === 1 ? 'actividad' : 'actividades'}
            </span>
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
      ) : null}
    </section>
  )
}
