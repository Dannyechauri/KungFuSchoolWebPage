import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ApiError, databaseApi } from '../api/databaseApi'
import {
  getStudentsDirectory,
  type StudentSummary,
} from '../features/students/studentsService'
import type { StudentRow } from '../types/database'

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
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StudentStatus>('all')
  const [formId, setFormId] = useState('')
  const [gradeId, setGradeId] = useState('')
  const [sort, setSort] = useState<StudentSort>('name')
  const [createMessage, setCreateMessage] = useState<string | null>(null)
  const [newStudent, setNewStudent] = useState({
    nombre: '',
    correo_electronico: '',
    fecha_nacimiento: '',
    numero_matricula: '',
    fecha_ingreso: new Date().toISOString().slice(0, 10),
    id_grado: '',
    grupo: '',
    password_hash: '',
  })
  const studentsQuery = useQuery({
    queryKey: ['students-directory'],
    queryFn: getStudentsDirectory,
  })

  const createStudentMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      databaseApi.insert<StudentRow>('alumnos', payload),
    onSuccess: async (student) => {
      setCreateMessage(`Alumno creado: ${student.nombre ?? student.numero_matricula}`)
      setNewStudent({
        nombre: '',
        correo_electronico: '',
        fecha_nacimiento: '',
        numero_matricula: '',
        fecha_ingreso: new Date().toISOString().slice(0, 10),
        id_grado: '',
        grupo: '',
        password_hash: '',
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['students-directory'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
    },
    onError: (error) => {
      setCreateMessage(
        error instanceof Error ? error.message : 'No se ha podido crear el alumno.',
      )
    },
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

  function handleCreateStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateMessage(null)

    const payload: Record<string, unknown> = {
      nombre: newStudent.nombre.trim(),
      correo_electronico: newStudent.correo_electronico.trim() || null,
      fecha_nacimiento: newStudent.fecha_nacimiento || null,
      numero_matricula: newStudent.numero_matricula.trim(),
      fecha_ingreso: newStudent.fecha_ingreso,
      id_grado: Number(newStudent.id_grado),
      grupo: newStudent.grupo.trim() || null,
      activo: true,
    }

    if (newStudent.password_hash.trim()) {
      payload.password_hash = newStudent.password_hash.trim()
    }

    createStudentMutation.mutate(payload)
  }

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

      <section className="content-panel management-panel">
        <div className="section-heading">
          <div>
            <p className="page-kicker">Alta rápida</p>
            <h2>Crear alumno</h2>
          </div>
          {createMessage ? <span>{createMessage}</span> : null}
        </div>
        <form className="management-form" onSubmit={handleCreateStudent}>
          <label>
            <span>Nombre</span>
            <input
              value={newStudent.nombre}
              onChange={(event) =>
                setNewStudent((current) => ({
                  ...current,
                  nombre: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            <span>Matrícula</span>
            <input
              value={newStudent.numero_matricula}
              onChange={(event) =>
                setNewStudent((current) => ({
                  ...current,
                  numero_matricula: event.target.value,
                }))
              }
              placeholder="IW-2026-041"
              required
            />
          </label>
          <label>
            <span>Correo</span>
            <input
              type="email"
              value={newStudent.correo_electronico}
              onChange={(event) =>
                setNewStudent((current) => ({
                  ...current,
                  correo_electronico: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Nacimiento</span>
            <input
              type="date"
              value={newStudent.fecha_nacimiento}
              onChange={(event) =>
                setNewStudent((current) => ({
                  ...current,
                  fecha_nacimiento: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Ingreso</span>
            <input
              type="date"
              value={newStudent.fecha_ingreso}
              onChange={(event) =>
                setNewStudent((current) => ({
                  ...current,
                  fecha_ingreso: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            <span>Grado</span>
            <select
              value={newStudent.id_grado}
              onChange={(event) =>
                setNewStudent((current) => ({
                  ...current,
                  id_grado: event.target.value,
                }))
              }
              required
            >
              <option value="">Selecciona grado</option>
              {gradeOptions.map((grade) => (
                <option value={grade.id} key={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Grupo</span>
            <input
              value={newStudent.grupo}
              onChange={(event) =>
                setNewStudent((current) => ({
                  ...current,
                  grupo: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Contraseña inicial</span>
            <input
              type="password"
              value={newStudent.password_hash}
              onChange={(event) =>
                setNewStudent((current) => ({
                  ...current,
                  password_hash: event.target.value,
                }))
              }
              placeholder="Opcional"
            />
          </label>
          <div className="management-actions">
            <button type="submit" disabled={createStudentMutation.isPending}>
              {createStudentMutation.isPending ? 'Creando…' : 'Crear alumno'}
            </button>
          </div>
        </form>
      </section>

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
          <span>Grado o requisitos</span>
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
