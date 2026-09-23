import { useMemo, useState } from 'react'
import { PanelCard } from '../components/PanelCard'
import { dateKey, formatActivityDate, getDemoActivities, getUpcomingDemoActivities } from '../data/demoActivities'

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

export function CalendarPage() {
  const [view, setView] = useState<CalendarView>('month')
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()))
  const activities = useMemo(() => getDemoActivities(), [])
  const upcomingActivities = useMemo(() => getUpcomingDemoActivities(), [])
  const activitiesByDay = useMemo(() => {
    const grouped = new Map<string, typeof activities>()

    for (const activity of activities) {
      const key = dateKey(activity.date)
      grouped.set(key, [...(grouped.get(key) ?? []), activity])
    }

    return grouped
  }, [activities])
  const monthTitle = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(monthDate)

  return (
    <section className="max-w-6xl">
      <p className="mb-2 text-xs font-black tracking-[0.12em] text-red uppercase">Calendario</p>
      <h1 className="m-0 text-4xl font-bold tracking-tight text-ink md:text-5xl">Agenda de clases y actividades</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
        Aquí mostraremos las actividades agendadas por curso, instructor y fecha.
      </p>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

      {view === 'month' ? (
        <PanelCard className="mt-5 overflow-x-auto p-5">
          <div className="min-w-[46rem]">
            <div className="mb-2 grid grid-cols-7 gap-2 text-center text-sm font-bold text-muted">
              {weekdays.map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {monthCells(monthDate).map((date) => {
                const dayActivities = activitiesByDay.get(dateKey(date)) ?? []
                const outsideMonth = date.getMonth() !== monthDate.getMonth()

                return (
                  <article key={dateKey(date)} className={`min-h-32 rounded-soft border border-line p-2.5 ${outsideMonth ? 'bg-canvas/45 text-muted' : 'bg-white/60'}`}>
                    <strong className="text-sm">{date.getDate()}</strong>
                    <div className="mt-2 grid gap-1.5">
                      {dayActivities.map((activity) => (
                        <span key={activity.id} className={`truncate rounded-full px-2 py-1 text-xs font-bold ${activity.active ? 'bg-red/10 text-red-dark' : 'bg-line text-muted line-through'}`}>
                          {activity.time} {activity.title}
                        </span>
                      ))}
                    </div>
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
    </section>
  )
}
