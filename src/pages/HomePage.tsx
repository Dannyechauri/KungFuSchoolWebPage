import { Link } from 'react-router'
import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api/client'
import { PanelCard } from '../components/PanelCard'
import { formatActivityDate } from '../data/demoActivities'

type Row = Record<string, unknown>

export function HomePage() {
  const [students, setStudents] = useState<Row[]>([])
  const [courses, setCourses] = useState<Row[]>([])
  const [instructors, setInstructors] = useState<Row[]>([])
  const [scheduledCourses, setScheduledCourses] = useState<Row[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [referenceTime] = useState(() => Date.now())
  const [reloadKey, setReloadKey] = useState(0)

  function retryLoad() {
    setIsLoading(true)
    setLoadError(null)
    setReloadKey((key) => key + 1)
  }

  useEffect(() => {
    let active = true
    void Promise.all([
      apiRequest<Row[]>('/api/database/tables/alumnos/rows?limit=500'),
      apiRequest<Row[]>('/api/database/tables/cursos/rows?limit=500'),
      apiRequest<Row[]>('/api/database/tables/instructores/rows?limit=500'),
      apiRequest<Row[]>('/api/database/tables/cursos_agendados/rows?limit=500'),
    ]).then(([loadedStudents, loadedCourses, loadedInstructors, loadedScheduledCourses]) => {
      if (!active) return
      setStudents(loadedStudents)
      setCourses(loadedCourses)
      setInstructors(loadedInstructors)
      setScheduledCourses(loadedScheduledCourses)
      setLoadError(null)
    }).catch((error: unknown) => {
      if (!active) return
      setLoadError(error instanceof Error ? error.message : 'No se pudo cargar el resumen.')
    }).finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [reloadKey])

  const upcomingActivities = useMemo(() => {
    const coursesById = new Map(courses.map((course) => [Number(course.id_curso), course]))
    const instructorsById = new Map(instructors.map((instructor) => [Number(instructor.id_instructor), instructor]))
    return scheduledCourses.map((scheduledCourse) => {
      const date = new Date(String(scheduledCourse.fecha_hora))
      const course = coursesById.get(Number(scheduledCourse.id_curso))
      const instructor = instructorsById.get(Number(scheduledCourse.id_instructor))
      return { id: String(scheduledCourse.id_curso_agendado), date, title: String(course?.nombre ?? 'Curso'), topic: String(course?.tema ?? 'Sin tema'), instructor: String(instructor?.nombre ?? 'Sin instructor'), active: scheduledCourse.activo !== false }
    }).filter((activity) => activity.active && !Number.isNaN(activity.date.getTime()) && activity.date.getTime() >= referenceTime).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5)
  }, [courses, instructors, referenceTime, scheduledCourses])
  const summaryItems = [
    { label: 'Alumnos activos', value: String(students.filter((student) => student.activo !== false).length), detail: `${students.length} registrados` },
    { label: 'Instructores', value: String(instructors.filter((instructor) => instructor.activo !== false).length), detail: 'equipo docente activo' },
    { label: 'Cursos', value: String(courses.length), detail: 'en el catálogo' },
    { label: 'Próximas actividades', value: String(upcomingActivities.length), detail: 'durante las próximas semanas' },
  ]
  const nextActivity = upcomingActivities[0]

  return (
    <section className="max-w-6xl">
      <p className="mb-2 text-xs font-black tracking-[0.12em] text-red uppercase">Inicio</p>
      <h1 className="m-0 text-4xl font-bold tracking-tight text-ink md:text-5xl">Resumen de la escuela</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
        Aquí construiremos la vista principal para mostrar la información útil de la escuela y las próximas actividades.
      </p>

      {loadError ? (
        <div className="mt-8 rounded-soft bg-red/10 p-4" role="alert">
          <p className="m-0 text-sm font-bold text-red-dark">{loadError}</p>
          <button className="mt-2 text-sm font-bold underline" type="button" onClick={retryLoad}>Reintentar</button>
        </div>
      ) : null}
      {isLoading ? <p className="mt-8 text-muted">Cargando resumen…</p> : <><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryItems.map((item) => (
          <PanelCard key={item.label} className="p-5">
            <span className="block text-sm font-bold text-muted">{item.label}</span>
            <strong className="mt-3 block text-4xl leading-none text-ink">{item.value}</strong>
            <small className="mt-3 block text-sm text-muted">{item.detail}</small>
          </PanelCard>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <PanelCard className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="m-0 text-xl font-bold text-ink">Próximas actividades</h2>
              <p className="mt-1 text-sm text-muted">Agenda programada para las próximas semanas.</p>
            </div>
            <Link className="font-bold text-red hover:text-red-dark" to="/calendario">
              Ver calendario
            </Link>
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

        <PanelCard className="flex flex-col justify-between p-6">
          <div>
            <p className="m-0 text-xs font-black tracking-[0.12em] text-red uppercase">Siguiente clase</p>
            <h2 className="mt-3 text-2xl font-bold leading-tight text-ink">{nextActivity?.title}</h2>
            <p className="mt-3 text-base leading-7 text-muted">{nextActivity?.instructor} dirige la próxima sesión del calendario.</p>
          </div>
          <div className="mt-8 border-t border-line pt-4">
            <time className="block text-lg font-bold text-red-dark">{nextActivity ? formatActivityDate(nextActivity.date) : 'Sin actividades'}</time>
            <span className="mt-1 block text-sm text-muted">{nextActivity?.topic}</span>
          </div>
        </PanelCard>
      </div></>}
    </section>
  )
}
