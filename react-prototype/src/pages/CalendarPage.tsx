import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import esLocale from '@fullcalendar/core/locales/es'
import { ApiError } from '../api/databaseApi'
import { getCalendarDirectory } from '../features/calendar/calendarService'

const courseDateFormatter = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function CalendarPage() {
  const [openedAt] = useState(Date.now)
  const [instructorId, setInstructorId] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const calendarQuery = useQuery({
    queryKey: ['calendar-directory'],
    queryFn: getCalendarDirectory,
  })

  const filteredCourses = useMemo(() => {
    if (!calendarQuery.data) return []
    const selectedInstructorId = Number(instructorId)

    return calendarQuery.data.courses.filter(
      (course) => !instructorId || course.instructorId === selectedInstructorId,
    )
  }, [calendarQuery.data, instructorId])

  if (calendarQuery.isPending) {
    return <div className="skeleton calendar-skeleton" aria-label="Cargando agenda" />
  }

  if (calendarQuery.isError) {
    const message =
      calendarQuery.error instanceof ApiError
        ? calendarQuery.error.message
        : 'No se ha podido cargar la agenda.'

    return (
      <section className="error-state">
        <p className="page-kicker">Agenda</p>
        <h1>No se ha podido cargar el calendario.</h1>
        <p className="page-description">{message}</p>
      </section>
    )
  }

  const upcomingCourses = filteredCourses.filter(
    (course) => new Date(course.scheduledAt).getTime() >= openedAt,
  )
  const selectedCourse =
    filteredCourses.find((course) => course.id === selectedCourseId) ??
    upcomingCourses[0] ??
    filteredCourses[0]

  return (
    <div className="calendar-page">
      <header className="page-header">
        <div>
          <p className="page-kicker">Programación docente</p>
          <h1>Agenda</h1>
          <p>
            {filteredCourses.length} cursos · {upcomingCourses.length} próximos
          </p>
        </div>
        <label className="compact-filter">
          <span>Instructor</span>
          <select
            value={instructorId}
            onChange={(event) => {
              setInstructorId(event.target.value)
              setSelectedCourseId(null)
            }}
          >
            <option value="">Todos los instructores</option>
            {calendarQuery.data.instructors.map((instructor) => (
              <option value={instructor.id} key={instructor.id}>
                {instructor.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="calendar-layout">
        <section className="calendar-panel" aria-label="Calendario de cursos">
          <FullCalendar
            plugins={[dayGridPlugin, listPlugin]}
            initialView="dayGridMonth"
            locale={esLocale}
            firstDay={1}
            height="auto"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,listMonth',
            }}
            buttonText={{ today: 'Hoy', month: 'Mes', list: 'Lista' }}
            events={filteredCourses.map((course) => ({
              id: String(course.id),
              title: course.name,
              start: course.scheduledAt,
            }))}
            eventClick={(info) => setSelectedCourseId(Number(info.event.id))}
            eventDisplay="block"
            displayEventEnd={false}
          />
        </section>

        <aside className="course-detail-panel">
          <p className="page-kicker">Curso seleccionado</p>
          {selectedCourse ? (
            <>
              <span className="course-detail-topic">{selectedCourse.topic}</span>
              <h2>{selectedCourse.name}</h2>
              <time dateTime={selectedCourse.scheduledAt}>
                {courseDateFormatter.format(new Date(selectedCourse.scheduledAt))}
              </time>
              <dl>
                <div>
                  <dt>Instructor</dt>
                  <dd>{selectedCourse.instructorName}</dd>
                </div>
                <div>
                  <dt>Inscripciones activas</dt>
                  <dd>{selectedCourse.enrollmentCount}</dd>
                </div>
              </dl>
              <p className="course-detail-description">
                {selectedCourse.description ?? 'Sin descripción registrada.'}
              </p>
            </>
          ) : (
            <p className="profile-empty">No hay cursos para este filtro.</p>
          )}
        </aside>
      </div>
    </div>
  )
}
