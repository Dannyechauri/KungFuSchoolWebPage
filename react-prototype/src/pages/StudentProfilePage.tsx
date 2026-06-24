import { useQuery } from '@tanstack/react-query'
import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api/databaseApi'
import { getStudentProfile } from '../features/students/studentsService'

const fullDateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

const courseDateFormatter = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function StudentProfilePage() {
  const { studentId = '' } = useParams()
  const numericStudentId = Number(studentId)
  const profileQuery = useQuery({
    queryKey: ['student-profile', numericStudentId],
    queryFn: () => getStudentProfile(numericStudentId),
    enabled: Number.isFinite(numericStudentId),
  })

  if (profileQuery.isPending) {
    return <div className="skeleton profile-skeleton" aria-label="Cargando ficha" />
  }

  if (profileQuery.isError) {
    const message =
      profileQuery.error instanceof ApiError
        ? profileQuery.error.message
        : 'No se ha podido cargar la ficha del alumno.'

    return (
      <section className="error-state">
        <p className="page-kicker">Ficha del alumno</p>
        <h1>Error al cargar la información.</h1>
        <p className="page-description">{message}</p>
      </section>
    )
  }

  const profile = profileQuery.data
  if (!profile) {
    return (
      <section className="error-state">
        <p className="page-kicker">Ficha del alumno</p>
        <h1>Alumno no encontrado.</h1>
        <Link to="/alumnos">Volver al directorio</Link>
      </section>
    )
  }

  const formsByStyle = new Map<string, typeof profile.knownForms>()
  profile.knownForms.forEach((form) => {
    const styleForms = formsByStyle.get(form.style) ?? []
    styleForms.push(form)
    formsByStyle.set(form.style, styleForms)
  })

  return (
    <div className="student-profile-page">
      <Link className="back-link" to="/alumnos">
        ← Volver a alumnos
      </Link>

      <header className="profile-header">
        <div className="profile-avatar" aria-hidden="true">
          {profile.fullName
            .split(' ')
            .slice(0, 2)
            .map((part) => part[0])
            .join('')}
        </div>
        <div>
          <p className="page-kicker">{profile.enrollmentNumber}</p>
          <h1>{profile.fullName}</h1>
          <span className={`status-badge ${profile.active ? 'active' : 'inactive'}`}>
            {profile.active ? 'Alumno activo' : 'Alumno inactivo'}
          </span>
        </div>
      </header>

      <section className="profile-facts" aria-label="Información personal">
        <div>
          <span>Ingreso</span>
          <strong>{fullDateFormatter.format(new Date(profile.joinedAt))}</strong>
        </div>
        <div>
          <span>Nacimiento</span>
          <strong>
            {profile.birthDate
              ? fullDateFormatter.format(new Date(profile.birthDate))
              : 'Sin registrar'}
          </strong>
        </div>
        <div>
          <span>Correo</span>
          <strong>{profile.email ?? 'Sin registrar'}</strong>
        </div>
        <div>
          <span>Teléfono</span>
          <strong>{profile.phone ?? 'Sin registrar'}</strong>
        </div>
        <div>
          <span>Dirección</span>
          <strong>{profile.address ?? 'Sin registrar'}</strong>
        </div>
      </section>

      <div className="profile-columns">
        <section className="content-panel">
          <div className="section-heading">
            <div>
              <p className="page-kicker">Conocimiento</p>
              <h2>Formas aprendidas</h2>
            </div>
            <strong>{profile.knownForms.length}</strong>
          </div>

          {formsByStyle.size === 0 ? (
            <p className="profile-empty">No hay formas registradas.</p>
          ) : (
            <div className="profile-form-groups">
              {[...formsByStyle.entries()].map(([style, forms]) => (
                <div key={style}>
                  <h3>{style}</h3>
                  <ul>
                    {forms.map((form) => (
                      <li key={form.id}>
                        <span>{form.name}</span>
                        <time dateTime={form.learnedAt}>
                          {fullDateFormatter.format(new Date(form.learnedAt))}
                        </time>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="content-panel">
          <div className="section-heading">
            <div>
              <p className="page-kicker">Programa técnico</p>
              <h2>Preparación por grado</h2>
            </div>
          </div>
          <div className="grade-progress-list">
            {profile.gradeProgress.map((grade) => (
              <article className={grade.completed ? 'completed' : undefined} key={grade.id}>
                <div className="grade-progress-heading">
                  <span
                    className="belt-dot"
                    style={{ '--belt-color': grade.beltColor } as CSSProperties}
                  />
                  <strong>{grade.name}</strong>
                  <span>
                    {grade.learnedRequiredForms}/{grade.requiredForms}
                  </span>
                </div>
                <div className="grade-progress-track">
                  <span
                    style={{
                      width: `${grade.requiredForms === 0 ? 0 : (grade.learnedRequiredForms / grade.requiredForms) * 100}%`,
                    }}
                  />
                </div>
                <p>
                  {grade.completed
                    ? 'Requisitos de formas cumplidos'
                    : grade.missingForms.join(', ')}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="content-panel profile-courses">
        <div className="section-heading">
          <div>
            <p className="page-kicker">Actividad</p>
            <h2>Cursos e inscripciones</h2>
          </div>
        </div>
        {profile.courses.length === 0 ? (
          <p className="profile-empty">No hay inscripciones registradas.</p>
        ) : (
          <div className="profile-course-list">
            {profile.courses.map((course) => (
              <article key={course.id}>
                <div>
                  <span>{course.topic}</span>
                  <strong>{course.name}</strong>
                </div>
                <time dateTime={course.scheduledAt}>
                  {courseDateFormatter.format(new Date(course.scheduledAt))}
                </time>
                <span className={`status-badge ${course.enrollmentStatus}`}>
                  {course.enrollmentStatus}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
