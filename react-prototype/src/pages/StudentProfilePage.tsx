import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, databaseApi } from '../api/databaseApi'
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
  const queryClient = useQueryClient()
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    nombre: '',
    correo_electronico: '',
    fecha_nacimiento: '',
    fecha_ingreso: '',
    numero_matricula: '',
    id_grado: '',
    grupo: '',
    tutor_nombre: '',
    tutor_telefono: '',
    observaciones: '',
    activo: true,
    password_hash: '',
  })
  const [learnedForm, setLearnedForm] = useState({
    id_forma: '',
    fecha_aprendida: new Date().toISOString().slice(0, 10),
  })
  const profileQuery = useQuery({
    queryKey: ['student-profile', numericStudentId],
    queryFn: () => getStudentProfile(numericStudentId),
    enabled: Number.isFinite(numericStudentId),
  })

  useEffect(() => {
    if (!profileQuery.data) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- la ficha remota debe rehidratar el formulario editable al cambiar de alumno.
    setEditForm({
      nombre: profileQuery.data.fullName,
      correo_electronico: profileQuery.data.email ?? '',
      fecha_nacimiento: profileQuery.data.birthDate ?? '',
      fecha_ingreso: profileQuery.data.joinedAt,
      numero_matricula: profileQuery.data.enrollmentNumber,
      id_grado: profileQuery.data.currentGradeId
        ? String(profileQuery.data.currentGradeId)
        : '',
      grupo: profileQuery.data.group ?? '',
      tutor_nombre: profileQuery.data.tutorName ?? '',
      tutor_telefono: profileQuery.data.tutorPhone ?? '',
      observaciones: profileQuery.data.observations ?? '',
      activo: profileQuery.data.active,
      password_hash: '',
    })
  }, [profileQuery.data])

  const refreshStudentData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['student-profile', numericStudentId] }),
      queryClient.invalidateQueries({ queryKey: ['students-directory'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['knowledge-directory'] }),
    ])
  }

  const updateStudentMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      databaseApi.update('alumnos', numericStudentId, payload),
    onSuccess: async () => {
      setSaveMessage('Ficha actualizada.')
      await refreshStudentData()
    },
    onError: (error) => {
      setSaveMessage(
        error instanceof Error ? error.message : 'No se ha podido actualizar la ficha.',
      )
    },
  })

  const addKnownFormMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      databaseApi.insert('alumno_forma', payload),
    onSuccess: async () => {
      setFormMessage('Forma marcada como aprendida.')
      setLearnedForm((current) => ({ ...current, id_forma: '' }))
      await refreshStudentData()
    },
    onError: (error) => {
      setFormMessage(
        error instanceof Error
          ? error.message
          : 'No se ha podido registrar la forma aprendida.',
      )
    },
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
  const knownFormIds = new Set(profile.knownForms.map((form) => form.id))
  const availableForms = profile.formOptions.filter((form) => !knownFormIds.has(form.id))

  function handleSaveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveMessage(null)

    const payload: Record<string, unknown> = {
      nombre: editForm.nombre.trim(),
      correo_electronico: editForm.correo_electronico.trim() || null,
      fecha_nacimiento: editForm.fecha_nacimiento || null,
      fecha_ingreso: editForm.fecha_ingreso,
      numero_matricula: editForm.numero_matricula.trim(),
      id_grado: editForm.id_grado ? Number(editForm.id_grado) : null,
      grupo: editForm.grupo.trim() || null,
      tutor_nombre: editForm.tutor_nombre.trim() || null,
      tutor_telefono: editForm.tutor_telefono.trim() || null,
      observaciones: editForm.observaciones.trim() || null,
      activo: editForm.activo,
    }

    if (editForm.password_hash.trim()) {
      payload.password_hash = editForm.password_hash.trim()
    }

    updateStudentMutation.mutate(payload)
  }

  function handleAddKnownForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage(null)

    if (!learnedForm.id_forma) {
      setFormMessage('Selecciona una forma.')
      return
    }

    addKnownFormMutation.mutate({
      id_alumno: numericStudentId,
      id_forma: Number(learnedForm.id_forma),
      fecha_aprendida: learnedForm.fecha_aprendida,
    })
  }

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

      <section className="content-panel management-panel">
        <div className="section-heading">
          <div>
            <p className="page-kicker">Edición</p>
            <h2>Ficha académica</h2>
          </div>
          <span className="status-badge active">Admin</span>
        </div>
        <form className="management-form" onSubmit={handleSaveStudent}>
          <label>
            <span>Nombre</span>
            <input
              value={editForm.nombre}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, nombre: event.target.value }))
              }
              required
            />
          </label>
          <label>
            <span>Matrícula</span>
            <input
              value={editForm.numero_matricula}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  numero_matricula: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            <span>Correo</span>
            <input
              type="email"
              value={editForm.correo_electronico}
              onChange={(event) =>
                setEditForm((current) => ({
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
              value={editForm.fecha_nacimiento}
              onChange={(event) =>
                setEditForm((current) => ({
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
              value={editForm.fecha_ingreso}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  fecha_ingreso: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            <span>Grado actual</span>
            <select
              value={editForm.id_grado}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  id_grado: event.target.value,
                }))
              }
              required
            >
              <option value="">Sin grado</option>
              {profile.gradeOptions.map((grade) => (
                <option value={grade.id} key={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Grupo</span>
            <input
              value={editForm.grupo}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, grupo: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Tutor</span>
            <input
              value={editForm.tutor_nombre}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  tutor_nombre: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Teléfono tutor</span>
            <input
              value={editForm.tutor_telefono}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  tutor_telefono: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Nueva contraseña</span>
            <input
              type="password"
              value={editForm.password_hash}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  password_hash: event.target.value,
                }))
              }
              placeholder="Opcional, mínimo 7 caracteres"
            />
          </label>
          <label className="management-checkbox">
            <input
              type="checkbox"
              checked={editForm.activo}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  activo: event.target.checked,
                }))
              }
            />
            Alumno activo
          </label>
          <label className="management-wide">
            <span>Observaciones</span>
            <textarea
              value={editForm.observaciones}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  observaciones: event.target.value,
                }))
              }
              rows={3}
            />
          </label>
          <div className="management-actions">
            <button type="submit" disabled={updateStudentMutation.isPending}>
              {updateStudentMutation.isPending ? 'Guardando…' : 'Guardar ficha'}
            </button>
            {saveMessage ? <span>{saveMessage}</span> : null}
          </div>
        </form>
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
          <form className="inline-management-form" onSubmit={handleAddKnownForm}>
            <h3>Registrar forma aprendida</h3>
            <label>
              <span>Forma</span>
              <select
                value={learnedForm.id_forma}
                onChange={(event) =>
                  setLearnedForm((current) => ({
                    ...current,
                    id_forma: event.target.value,
                  }))
                }
              >
                <option value="">Selecciona forma</option>
                {availableForms.map((form) => (
                  <option value={form.id} key={form.id}>
                    {form.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Fecha</span>
              <input
                type="date"
                value={learnedForm.fecha_aprendida}
                onChange={(event) =>
                  setLearnedForm((current) => ({
                    ...current,
                    fecha_aprendida: event.target.value,
                  }))
                }
              />
            </label>
            <button type="submit" disabled={addKnownFormMutation.isPending}>
              Añadir forma
            </button>
            {formMessage ? <p>{formMessage}</p> : null}
          </form>
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
