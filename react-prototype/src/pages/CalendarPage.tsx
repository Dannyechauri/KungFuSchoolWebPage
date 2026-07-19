import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import esLocale from '@fullcalendar/core/locales/es'
import { ApiError, databaseApi } from '../api/databaseApi'
import { getCalendarDirectory } from '../features/calendar/calendarService'
import type { CourseRow, ScheduledCourseRow } from '../types/database'

const courseDateFormatter = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function CalendarPage() {
  const queryClient = useQueryClient()
  const [openedAt] = useState(Date.now)
  const [instructorId, setInstructorId] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [newCourse, setNewCourse] = useState({
    nombre: '',
    tema: 'Clase técnica',
    descripcion: '',
    id_instructor: '',
    fecha_hora: '',
  })
  const calendarQuery = useQuery({
    queryKey: ['calendar-directory'],
    queryFn: getCalendarDirectory,
  })

  const refreshCalendar = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['calendar-directory'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['student-profile'] }),
    ])
  }

  const createEventMutation = useMutation({
    mutationFn: async () => {
      const course = await databaseApi.insert<CourseRow>('cursos', {
        nombre: newCourse.nombre.trim(),
        tema: newCourse.tema.trim(),
        descripcion: newCourse.descripcion.trim() || null,
      })

      return databaseApi.insert<ScheduledCourseRow>('cursos_agendados', {
        id_curso: course.id_curso,
        id_instructor: Number(newCourse.id_instructor),
        fecha_hora: newCourse.fecha_hora,
        activo: true,
      })
    },
    onSuccess: async () => {
      setFormMessage('Curso agendado.')
      setNewCourse({
        nombre: '',
        tema: 'Clase técnica',
        descripcion: '',
        id_instructor: '',
        fecha_hora: '',
      })
      await refreshCalendar()
    },
    onError: (error) => {
      setFormMessage(
        error instanceof Error ? error.message : 'No se ha podido crear el evento.',
      )
    },
  })

  const cancelEventMutation = useMutation({
    mutationFn: (scheduleId: number) =>
      databaseApi.update<ScheduledCourseRow>('cursos_agendados', scheduleId, {
        activo: false,
      }),
    onSuccess: async () => {
      setSelectedCourseId(null)
      await refreshCalendar()
    },
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

  function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage(null)

    if (!newCourse.id_instructor || !newCourse.fecha_hora || !newCourse.nombre.trim()) {
      setFormMessage('Completa nombre, instructor y fecha.')
      return
    }

    createEventMutation.mutate()
  }

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
              <button
                className="danger-action"
                type="button"
                disabled={cancelEventMutation.isPending}
                onClick={() => cancelEventMutation.mutate(selectedCourse.id)}
              >
                {cancelEventMutation.isPending ? 'Cancelando…' : 'Cancelar evento'}
              </button>
            </>
          ) : (
            <p className="profile-empty">No hay cursos para este filtro.</p>
          )}
        </aside>
      </div>

      <section className="content-panel management-panel">
        <div className="section-heading">
          <div>
            <p className="page-kicker">Gestión de agenda</p>
            <h2>Crear curso agendado</h2>
          </div>
        </div>
        <form className="management-form" onSubmit={handleCreateEvent}>
          <label>
            <span>Nombre del curso</span>
            <input
              value={newCourse.nombre}
              onChange={(event) =>
                setNewCourse((current) => ({
                  ...current,
                  nombre: event.target.value,
                }))
              }
              placeholder="Aplicaciones de Ving Tsun"
              required
            />
          </label>
          <label>
            <span>Tema</span>
            <input
              value={newCourse.tema}
              onChange={(event) =>
                setNewCourse((current) => ({ ...current, tema: event.target.value }))
              }
              required
            />
          </label>
          <label>
            <span>Instructor</span>
            <select
              value={newCourse.id_instructor}
              onChange={(event) =>
                setNewCourse((current) => ({
                  ...current,
                  id_instructor: event.target.value,
                }))
              }
              required
            >
              <option value="">Selecciona instructor</option>
              {calendarQuery.data.instructors.map((instructor) => (
                <option value={instructor.id} key={instructor.id}>
                  {instructor.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Fecha y hora</span>
            <input
              type="datetime-local"
              value={newCourse.fecha_hora}
              onChange={(event) =>
                setNewCourse((current) => ({
                  ...current,
                  fecha_hora: event.target.value,
                }))
              }
              required
            />
          </label>
          <label className="management-wide">
            <span>Descripción</span>
            <textarea
              value={newCourse.descripcion}
              onChange={(event) =>
                setNewCourse((current) => ({
                  ...current,
                  descripcion: event.target.value,
                }))
              }
              rows={3}
            />
          </label>
          <div className="management-actions">
            <button type="submit" disabled={createEventMutation.isPending}>
              {createEventMutation.isPending ? 'Creando…' : 'Crear evento'}
            </button>
            {formMessage ? <span>{formMessage}</span> : null}
          </div>
        </form>
      </section>
    </div>
  )
}
