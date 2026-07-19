import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, databaseApi } from '../api/databaseApi'
import type {
  AdministratorRow,
  InstructorRow,
  InstructorStyleRow,
  StyleRow,
} from '../types/database'

type TeamDirectory = {
  administrators: AdministratorRow[]
  instructors: InstructorRow[]
  styles: StyleRow[]
  instructorStyles: InstructorStyleRow[]
}

async function getTeamDirectory(): Promise<TeamDirectory> {
  const [administrators, instructors, styles, instructorStyles] = await Promise.all([
    databaseApi.rows<AdministratorRow>('administradores'),
    databaseApi.rows<InstructorRow>('instructores'),
    databaseApi.rows<StyleRow>('estilos'),
    databaseApi.rows<InstructorStyleRow>('instructor_estilo'),
  ])

  return { administrators, instructors, styles, instructorStyles }
}

export function TeamPage() {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState<string | null>(null)
  const [newInstructor, setNewInstructor] = useState({
    nombre: '',
    cinturon_actual: '',
    especialidad: '',
    fecha_contratacion: '',
  })
  const [newAdmin, setNewAdmin] = useState({
    nombre: '',
    correo_electronico: '',
    fecha_inicio: new Date().toISOString().slice(0, 10),
    password_hash: '',
  })
  const teamQuery = useQuery({
    queryKey: ['team-directory'],
    queryFn: getTeamDirectory,
  })

  const refreshTeam = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['team-directory'] }),
      queryClient.invalidateQueries({ queryKey: ['calendar-directory'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  }

  const createInstructorMutation = useMutation({
    mutationFn: () =>
      databaseApi.insert<InstructorRow>('instructores', {
        nombre: newInstructor.nombre.trim(),
        cinturon_actual: newInstructor.cinturon_actual.trim(),
        especialidad: newInstructor.especialidad.trim() || null,
        fecha_contratacion: newInstructor.fecha_contratacion || null,
        activo: true,
      }),
    onSuccess: async (instructor) => {
      setMessage(`Instructor creado: ${instructor.nombre}`)
      setNewInstructor({
        nombre: '',
        cinturon_actual: '',
        especialidad: '',
        fecha_contratacion: '',
      })
      await refreshTeam()
    },
    onError: (error) => {
      setMessage(
        error instanceof Error ? error.message : 'No se ha podido crear instructor.',
      )
    },
  })

  const createAdminMutation = useMutation({
    mutationFn: () =>
      databaseApi.insert<AdministratorRow>('administradores', {
        nombre: newAdmin.nombre.trim(),
        correo_electronico: newAdmin.correo_electronico.trim(),
        fecha_inicio: newAdmin.fecha_inicio,
        password_hash: newAdmin.password_hash.trim(),
      }),
    onSuccess: async (admin) => {
      setMessage(`Administrador creado: ${admin.nombre}`)
      setNewAdmin({
        nombre: '',
        correo_electronico: '',
        fecha_inicio: new Date().toISOString().slice(0, 10),
        password_hash: '',
      })
      await refreshTeam()
    },
    onError: (error) => {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se ha podido crear administrador.',
      )
    },
  })

  function handleCreateInstructor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    createInstructorMutation.mutate()
  }

  function handleCreateAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    createAdminMutation.mutate()
  }

  if (teamQuery.isPending) {
    return <div className="skeleton knowledge-skeleton" aria-label="Cargando equipo" />
  }

  if (teamQuery.isError) {
    const text =
      teamQuery.error instanceof ApiError
        ? teamQuery.error.message
        : 'No se ha podido cargar el equipo.'

    return (
      <section className="error-state">
        <p className="page-kicker">Equipo</p>
        <h1>No se ha podido cargar el equipo.</h1>
        <p className="page-description">{text}</p>
      </section>
    )
  }

  const { administrators, instructors, styles, instructorStyles } = teamQuery.data
  const stylesById = new Map(styles.map((style) => [style.id_estilo, style]))

  return (
    <div className="team-page">
      <header className="page-header">
        <div>
          <p className="page-kicker">Permisos y docencia</p>
          <h1>Equipo</h1>
          <p>
            {instructors.length} instructores · {administrators.length}{' '}
            administradores
          </p>
        </div>
        {message ? <div className="page-header-note">{message}</div> : null}
      </header>

      <div className="dashboard-columns">
        <section className="content-panel">
          <div className="section-heading">
            <div>
              <p className="page-kicker">Docencia</p>
              <h2>Instructores</h2>
            </div>
          </div>
          <div className="style-list">
            {instructors.map((instructor) => {
              const instructorStyleNames = instructorStyles
                .filter((relation) => relation.id_instructor === instructor.id_instructor)
                .map(
                  (relation) =>
                    stylesById.get(relation.id_estilo)?.nombre ?? 'Estilo',
                )

              return (
                <div className="style-row" key={instructor.id_instructor}>
                  <span>{String(instructor.id_instructor).padStart(2, '0')}</span>
                  <div>
                    <strong>{instructor.nombre ?? 'Instructor sin nombre'}</strong>
                    <p>
                      {instructor.cinturon_actual ?? 'Cinturón sin registrar'} ·{' '}
                      {instructor.especialidad ?? 'Sin especialidad'} ·{' '}
                      {instructorStyleNames.join(', ') || 'Sin estilos'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="content-panel">
          <div className="section-heading">
            <div>
              <p className="page-kicker">Acceso</p>
              <h2>Administradores</h2>
            </div>
          </div>
          <div className="style-list">
            {administrators.map((admin) => (
              <div className="style-row" key={admin.id_administrador}>
                <span>{String(admin.id_administrador).padStart(2, '0')}</span>
                <div>
                  <strong>{admin.nombre}</strong>
                  <p>{admin.correo_electronico ?? 'Sin correo de acceso'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="content-panel management-panel">
        <div className="section-heading">
          <div>
            <p className="page-kicker">Altas</p>
            <h2>Crear perfiles de equipo</h2>
          </div>
        </div>
        <div className="management-columns">
          <form className="inline-management-form" onSubmit={handleCreateInstructor}>
            <h3>Nuevo instructor</h3>
            <label>
              <span>Nombre</span>
              <input
                value={newInstructor.nombre}
                onChange={(event) =>
                  setNewInstructor((current) => ({
                    ...current,
                    nombre: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              <span>Cinturón actual</span>
              <input
                value={newInstructor.cinturon_actual}
                onChange={(event) =>
                  setNewInstructor((current) => ({
                    ...current,
                    cinturon_actual: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              <span>Especialidad</span>
              <input
                value={newInstructor.especialidad}
                onChange={(event) =>
                  setNewInstructor((current) => ({
                    ...current,
                    especialidad: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Fecha contratación</span>
              <input
                type="date"
                value={newInstructor.fecha_contratacion}
                onChange={(event) =>
                  setNewInstructor((current) => ({
                    ...current,
                    fecha_contratacion: event.target.value,
                  }))
                }
              />
            </label>
            <button type="submit" disabled={createInstructorMutation.isPending}>
              Crear instructor
            </button>
          </form>

          <form className="inline-management-form" onSubmit={handleCreateAdmin}>
            <h3>Nuevo administrador</h3>
            <label>
              <span>Nombre</span>
              <input
                value={newAdmin.nombre}
                onChange={(event) =>
                  setNewAdmin((current) => ({
                    ...current,
                    nombre: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              <span>Correo</span>
              <input
                type="email"
                value={newAdmin.correo_electronico}
                onChange={(event) =>
                  setNewAdmin((current) => ({
                    ...current,
                    correo_electronico: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              <span>Fecha inicio</span>
              <input
                type="date"
                value={newAdmin.fecha_inicio}
                onChange={(event) =>
                  setNewAdmin((current) => ({
                    ...current,
                    fecha_inicio: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              <span>Contraseña</span>
              <input
                type="password"
                value={newAdmin.password_hash}
                onChange={(event) =>
                  setNewAdmin((current) => ({
                    ...current,
                    password_hash: event.target.value,
                  }))
                }
                placeholder="Mínimo 7 caracteres"
                required
              />
            </label>
            <button type="submit" disabled={createAdminMutation.isPending}>
              Crear administrador
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
