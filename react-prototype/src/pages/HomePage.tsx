import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/databaseApi'
import {
  getDashboardSnapshot,
  type UpcomingCourse,
} from '../features/dashboard/dashboardService'

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function CourseCard({ course }: { course: UpcomingCourse }) {
  const courseDate = new Date(course.fecha_hora)

  return (
    <article className="course-card">
      <time dateTime={course.fecha_hora}>
        <span>{courseDate.toLocaleDateString('es-ES', { day: '2-digit' })}</span>
        {courseDate.toLocaleDateString('es-ES', { month: 'short' })}
      </time>
      <div>
        <p className="course-topic">{course.tema}</p>
        <h3>{course.nombre}</h3>
        <p>
          {dateFormatter.format(courseDate)} · {course.instructorName}
        </p>
      </div>
    </article>
  )
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="Cargando panel">
      <div className="skeleton skeleton-title" />
      <div className="metric-grid">
        {[1, 2, 3, 4].map((item) => (
          <div className="skeleton skeleton-card" key={item} />
        ))}
      </div>
    </div>
  )
}

export function HomePage() {
  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardSnapshot,
  })

  if (dashboardQuery.isPending) return <DashboardSkeleton />

  if (dashboardQuery.isError) {
    const message =
      dashboardQuery.error instanceof ApiError
        ? dashboardQuery.error.message
        : 'No se ha podido cargar la información de la escuela.'

    return (
      <section className="error-state">
        <p className="page-kicker">Conexión pendiente</p>
        <h1>El panel está listo, pero el backend no responde.</h1>
        <p className="page-description">{message}</p>
        <button type="button" onClick={() => dashboardQuery.refetch()}>
          Volver a intentar
        </button>
      </section>
    )
  }

  const dashboard = dashboardQuery.data
  const metrics = [
    {
      value: dashboard.activeStudents,
      label: 'Alumnos activos',
      hint: 'Personas entrenando',
    },
    {
      value: dashboard.activeInstructors,
      label: 'Instructores',
      hint: 'Equipo docente activo',
    },
    {
      value: dashboard.courses,
      label: 'Cursos',
      hint: 'Programados en la base',
    },
    {
      value: dashboard.forms,
      label: 'Formas',
      hint: 'Conocimiento catalogado',
    },
  ]

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div>
          <p className="page-kicker">Centro pionero desde 1976</p>
          <h1>Conocimiento que se transmite, progreso que se ve.</h1>
          <p className="page-description">
            Una vista clara de la escuela, sus alumnos y la tradición que cada
            generación continúa construyendo.
          </p>
        </div>
        <div className="status-card">
          <span className="status-dot" aria-hidden="true" />
          <div>
            <strong>Sistema conectado</strong>
            <span>
              Actualizado {dateFormatter.format(new Date(dashboard.checkedAt))}
            </span>
          </div>
        </div>
      </section>

      <section className="metric-grid" aria-label="Resumen de la escuela">
        {metrics.map((metric, index) => (
          <article className="metric-card" key={metric.label}>
            <span className="metric-index">0{index + 1}</span>
            <strong>{metric.value}</strong>
            <h2>{metric.label}</h2>
            <p>{metric.hint}</p>
          </article>
        ))}
      </section>

      <div className="dashboard-columns">
        <section className="content-panel">
          <div className="section-heading">
            <div>
              <p className="page-kicker">Agenda</p>
              <h2>Próximos cursos</h2>
            </div>
            <Link to="/agenda">Ver agenda</Link>
          </div>

          {dashboard.upcomingCourses.length > 0 ? (
            <div className="course-list">
              {dashboard.upcomingCourses.map((course) => (
                <CourseCard course={course} key={course.id_curso} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span>日</span>
              <div>
                <strong>No hay próximos cursos programados</strong>
                <p>La agenda aparecerá aquí cuando existan cursos futuros.</p>
              </div>
            </div>
          )}
        </section>

        <aside className="content-panel knowledge-panel">
          <div className="section-heading">
            <div>
              <p className="page-kicker">Linaje técnico</p>
              <h2>Estilos</h2>
            </div>
          </div>
          <div className="style-list">
            {dashboard.styles.map((style, index) => (
              <div className="style-row" key={style.id_estilo}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{style.nombre}</strong>
                  <p>{style.descripcion ?? 'Tradición de la escuela'}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
