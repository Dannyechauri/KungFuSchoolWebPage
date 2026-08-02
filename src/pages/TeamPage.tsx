import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { databaseApi } from '../api/schoolApi';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../features/auth/AuthProvider';
import { useSchoolData } from '../hooks/useSchoolData';
import type { InstructorRow, InstructorStyleRow } from '../types/school';
import { formatDateTime, todayInputValue } from '../utils/date';

export function TeamPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const { isLoading, instructors, styles, events } = useSchoolData();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [styleByInstructor, setStyleByInstructor] = useState<Record<number, string>>({});

  const invalidateSchoolData = () => queryClient.invalidateQueries({ queryKey: ['school-data'] });

  const createInstructorMutation = useMutation({
    mutationFn: (payload: Partial<InstructorRow>) => databaseApi.insert<InstructorRow>('instructores', payload),
    onSuccess: async () => {
      await invalidateSchoolData();
      setIsCreateOpen(false);
    },
  });

  const addStyleMutation = useMutation({
    mutationFn: (payload: InstructorStyleRow) => databaseApi.insert<InstructorStyleRow>('instructor_estilo', payload),
    onSuccess: invalidateSchoolData,
  });

  const removeStyleMutation = useMutation({
    mutationFn: (rowId: string) => databaseApi.delete('instructor_estilo', rowId),
    onSuccess: invalidateSchoolData,
  });

  function handleCreateInstructor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    createInstructorMutation.mutate({
      nombre: String(formData.get('nombre') ?? '').trim(),
      fecha_contratacion: String(formData.get('fecha_contratacion') ?? '') || null,
      especialidad: String(formData.get('especialidad') ?? '') || null,
      correo_electronico: String(formData.get('correo_electronico') ?? '').trim(),
      password_hash: String(formData.get('password_hash') ?? '').trim(),
      activo: true,
    });
  }

  if (isLoading) return <LoadingState />;

  return (
    <section>
      <PageHeader
        eyebrow="Equipo"
        title="Instructores y estilos"
        description="Una vista sencilla para saber quién enseña qué y qué actividad tiene asignada."
        actions={
          isAdmin ? (
            <button className="primary-action" type="button" onClick={() => setIsCreateOpen(true)}>
              + Nuevo instructor
            </button>
          ) : null
        }
      />

      {instructors.length === 0 ? (
        <EmptyState title="Sin instructores" text="Añade instructores para poder agendar actividades." />
      ) : (
        <div className="team-grid">
          {instructors.map((instructor) => {
            const instructorEvents = events
              .filter((event) => Number(event.id_instructor) === Number(instructor.id_instructor))
              .filter((event) => new Date(event.fecha_hora).getTime() >= Date.now())
              .slice(0, 3);
            const selectedStyleId = styleByInstructor[instructor.id_instructor] ?? '';
            const availableStyles = styles.filter(
              (style) => !instructor.styles.some((current) => Number(current.id_estilo) === Number(style.id_estilo)),
            );

            return (
              <article key={instructor.id_instructor} className="team-card">
                <div className="team-card-header">
                  <div className="student-avatar">{instructor.nombre.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <strong>{instructor.nombre}</strong>
                    <span>{instructor.especialidad ?? 'Instructor'}</span>
                    <small>{instructor.correo_electronico ?? 'Sin correo de acceso'}</small>
                  </div>
                </div>

                <h3>Estilos que enseña</h3>
                <div className="tag-list">
                  {instructor.styles.length === 0 ? (
                    <span className="muted">Sin estilos asignados</span>
                  ) : (
                    instructor.styles.map((style) => (
                      <span key={style.id_estilo} className="removable-tag">
                        <span className="removable-tag-text">{style.nombre}</span>
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => removeStyleMutation.mutate(`${instructor.id_instructor},${style.id_estilo}`)}
                          >
                            ✕
                          </button>
                        ) : null}
                      </span>
                    ))
                  )}
                </div>

                {isAdmin ? (
                  <div className="inline-form">
                    <select
                      value={selectedStyleId}
                      onChange={(event) =>
                        setStyleByInstructor((current) => ({
                          ...current,
                          [instructor.id_instructor]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Asignar estilo...</option>
                      {availableStyles.map((style) => (
                        <option key={style.id_estilo} value={style.id_estilo}>
                          {style.nombre}
                        </option>
                      ))}
                    </select>
                    <button
                      className="secondary-action"
                      type="button"
                      disabled={!selectedStyleId}
                      onClick={() =>
                        addStyleMutation.mutate({
                          id_instructor: instructor.id_instructor,
                          id_estilo: Number(selectedStyleId),
                        })
                      }
                    >
                      Añadir
                    </button>
                  </div>
                ) : null}

                <h3>Próximas actividades</h3>
                {instructorEvents.length === 0 ? (
                  <p className="muted">Sin actividades próximas.</p>
                ) : (
                  <div className="mini-list">
                    {instructorEvents.map((event) => (
                      <span key={event.id_curso_agendado}>
                        {event.course?.nombre ?? 'Clase'} · {formatDateTime(event.fecha_hora)}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Modal title="Nuevo instructor" isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)}>
        <form className="stacked-form" onSubmit={handleCreateInstructor}>
          <label>
            Nombre completo
            <input name="nombre" required />
          </label>
          <div className="form-grid">
            <label>
              Fecha de alta
              <input name="fecha_contratacion" type="date" defaultValue={todayInputValue()} />
            </label>
            <label>
              Especialidad
              <input name="especialidad" placeholder="Ving Tsun, armas, formas..." />
            </label>
          </div>
          <label>
            Correo de acceso
            <input name="correo_electronico" type="email" required />
          </label>
          <label>
            Contraseña inicial
            <input name="password_hash" type="password" minLength={7} required />
          </label>
          <p className="form-help">
            El backend nuevo exige correo y contraseña si el instructor no está vinculado a un alumno existente.
          </p>
          {createInstructorMutation.isError ? <p className="form-error">No se pudo crear el instructor.</p> : null}
          <button className="primary-action" type="submit" disabled={createInstructorMutation.isPending}>
            {createInstructorMutation.isPending ? 'Guardando...' : 'Guardar instructor'}
          </button>
        </form>
      </Modal>
    </section>
  );
}
