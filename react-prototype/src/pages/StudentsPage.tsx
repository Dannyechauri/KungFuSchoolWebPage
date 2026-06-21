import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/databaseApi'
import {
  getStudentsDirectory,
  type StudentSummary,
} from '../features/students/studentsService'

type StudentStatus = 'all' | 'active' | 'inactive'
type StudentSort = 'name' | 'recent' | 'forms'

const joinedAtFormatter = new Intl.DateTimeFormat('es-ES', {
  month: 'short',
  year: 'numeric',
})

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function studentInitials(student: StudentSummary) {
  return student.fullName
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
}

function StudentsSkeleton() {
  return (
    <div className="students-skeleton" aria-label="Cargando alumnos">
      <div className="skeleton students-title-skeleton" />
      <div className="skeleton students-filter-skeleton" />
      {[1, 2, 3, 4, 5].map((item) => (
        <div className="skeleton students-row-skeleton" key={item} />
      ))}
    </div>
  )
}

export function StudentsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StudentStatus>('all')
  const [formId, setFormId] = useState('')
  const [gradeId, setGradeId] = useState('')
  const [sort, setSort] = useState<StudentSort>('name')
  const studentsQuery = useQuery({
    queryKey: ['students-directory'],
    queryFn: getStudentsDirectory,
  })

  const filteredStudents = useMemo(() => {
    if (!studentsQuery.data) return []

    const normalizedSearch = normalizeText(search.trim())
    const selectedFormId = Number(formId)
    const selectedGradeId = Number(gradeId)

    return studentsQuery.data.students
      .filter((student) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          normalizeText(
            `${student.fullName} ${student.enrollmentNumber} ${student.email ?? ''}`,
          ).includes(normalizedSearch)
        const matchesStatus =
          status === 'all' ||
          (status === 'active' ? student.active : !student.active)
        const matchesForm =
          !formId || student.knownForms.some((form) => form.id === selectedFormId)
        const matchesGrade =
          !gradeId || student.completedGradeIds.includes(selectedGradeId)

        return matchesSearch && matchesStatus && matchesForm && matchesGrade
      })
      .sort((left, right) => {
        if (sort === 'recent') {
          return (
            new Date(right.joinedAt).getTime() - new Date(left.joinedAt).getTime()
          )
        }

        if (sort === 'forms') {
          return right.knownForms.length - left.knownForms.length
        }

        return left.fullName.localeCompare(right.fullName, 'es')
      })
  }, [formId, gradeId, search, sort, status, studentsQuery.data])

  if (studentsQuery.isPending) return <StudentsSkeleton />

  if (studentsQuery.isError) {
    const message =
      studentsQuery.error instanceof ApiError
        ? studentsQuery.error.message
        : 'No se ha podido construir el directorio de alumnos.'

    return (
      <section className="error-state">
        <p className="page-kicker">Alumnos</p>
        <h1>No se ha podido cargar el directorio.</h1>
        <p className="page-description">{message}</p>
        <button type="button" onClick={() => studentsQuery.refetch()}>
          Volver a intentar
        </button>
      </section>
    )
  }

  const { students, formOptions, gradeOptions } = studentsQuery.data
  const activeStudents = students.filter((student) => student.active).length

  return (
    <div className="students-page">
      <header className="page-header">
        <div>
          <p className="page-kicker">Gestión académica</p>
          <h1>Alumnos</h1>
          <p>
            {students.length} fichas · {activeStudents} alumnos activos
          </p>
        </div>
        <div className="page-header-note">
          <span>Vista de consulta</span>
          <p>Los filtros se calculan con la información actual de la escuela.</p>
        </div>
      </header>

      <section className="student-filters" aria-label="Filtros de alumnos">
        <label className="search-field">
          <span>Buscar</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, matrícula o correo"
          />
        </label>

        <label>
          <span>Estado</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StudentStatus)}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </label>

        <label>
          <span>Conoce la forma</span>
          <select value={formId} onChange={(event) => setFormId(event.target.value)}>
            <option value="">Cualquier forma</option>
            {formOptions.map((form) => (
              <option value={form.id} key={form.id}>
                {form.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Cumple requisitos de</span>
          <select value={gradeId} onChange={(event) => setGradeId(event.target.value)}>
            <option value="">Cualquier grado</option>
            {gradeOptions.map((grade) => (
              <option value={grade.id} key={grade.id}>
                {grade.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Ordenar</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as StudentSort)}
          >
            <option value="name">Nombre</option>
            <option value="recent">Ingreso más reciente</option>
            <option value="forms">Más formas aprendidas</option>
          </select>
        </label>
      </section>

      <section className="students-directory" aria-live="polite">
        <div className="directory-heading">
          <strong>{filteredStudents.length} resultados</strong>
          {(search || status !== 'all' || formId || gradeId) && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setStatus('all')
                setFormId('')
                setGradeId('')
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {filteredStudents.length === 0 ? (
          <div className="directory-empty">
            <strong>No hay alumnos que coincidan</strong>
            <p>Prueba a quitar algún filtro o cambiar la búsqueda.</p>
          </div>
        ) : (
          <div className="student-list">
            <div className="student-list-header" aria-hidden="true">
              <span>Alumno</span>
              <span>Estado</span>
              <span>Conocimiento</span>
              <span>Actividad</span>
              <span>Ingreso</span>
            </div>
            {filteredStudents.map((student) => (
              <article className="student-row" key={student.id}>
                <div className="student-identity">
                  <span className="student-avatar">{studentInitials(student)}</span>
                  <div>
                    <h2>
                      <Link to={`/alumnos/${student.id}`}>{student.fullName}</Link>
                    </h2>
                    <p>
                      {student.enrollmentNumber} · {student.email ?? 'Sin correo'}
                    </p>
                  </div>
                </div>

                <div>
                  <span
                    className={`status-badge ${student.active ? 'active' : 'inactive'}`}
                  >
                    {student.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="student-knowledge">
                  <strong>{student.knownForms.length} formas</strong>
                  <div>
                    {student.knownForms.slice(0, 2).map((form) => (
                      <span key={form.id}>{form.name}</span>
                    ))}
                  </div>
                </div>

                <div className="student-activity">
                  <strong>{student.activeEnrollments}</strong>
                  <span>inscripciones activas</span>
                </div>

                <time dateTime={student.joinedAt}>
                  {joinedAtFormatter.format(new Date(student.joinedAt))}
                </time>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
