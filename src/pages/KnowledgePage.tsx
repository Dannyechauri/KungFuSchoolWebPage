import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { databaseApi } from '../api/schoolApi';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../features/auth/AuthProvider';
import { useSchoolData } from '../hooks/useSchoolData';
import type { CourseRow, FormRow, GradeFormRow, GradeRow, StyleRow } from '../types/school';

export function KnowledgePage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const { isLoading, styles, forms, grades, courses } = useSchoolData();
  const [requiredFormByGrade, setRequiredFormByGrade] = useState<Record<number, string>>({});

  const invalidateSchoolData = () => queryClient.invalidateQueries({ queryKey: ['school-data'] });

  const createStyleMutation = useMutation({
    mutationFn: (payload: Partial<StyleRow>) => databaseApi.insert<StyleRow>('estilos', payload),
    onSuccess: invalidateSchoolData,
  });

  const createFormMutation = useMutation({
    mutationFn: (payload: Partial<FormRow>) => databaseApi.insert<FormRow>('formas', payload),
    onSuccess: invalidateSchoolData,
  });

  const createGradeMutation = useMutation({
    mutationFn: (payload: Partial<GradeRow>) => databaseApi.insert<GradeRow>('grados', payload),
    onSuccess: invalidateSchoolData,
  });

  const createCourseMutation = useMutation({
    mutationFn: (payload: Partial<CourseRow>) => databaseApi.insert<CourseRow>('cursos', payload),
    onSuccess: invalidateSchoolData,
  });

  const addRequiredFormMutation = useMutation({
    mutationFn: (payload: GradeFormRow) => databaseApi.insert<GradeFormRow>('grado_forma', payload),
    onSuccess: invalidateSchoolData,
  });

  const removeRequiredFormMutation = useMutation({
    mutationFn: (rowId: string) => databaseApi.delete('grado_forma', rowId),
    onSuccess: invalidateSchoolData,
  });

  function formToPayload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return new FormData(event.currentTarget);
  }

  if (isLoading) return <LoadingState />;

  return (
    <section>
      <PageHeader
        eyebrow="Conocimiento"
        title="Estructura de grados, estilos y formas"
        description="Aquí se ordena el mapa técnico de la escuela para que luego alumnos y calendario tengan sentido."
      />

      <div className="knowledge-grid">
        <article className="panel-card">
          <div className="panel-card-header">
            <h2>Estilos</h2>
          </div>
          <div className="tag-list">
            {styles.map((style) => (
              <span key={style.id_estilo} className="soft-tag">
                {style.nombre}
              </span>
            ))}
          </div>
          {isAdmin ? (
            <form
              className="compact-form"
              onSubmit={(event) => {
                const formData = formToPayload(event);
                createStyleMutation.mutate({
                  nombre: String(formData.get('nombre') ?? '').trim(),
                  descripcion: String(formData.get('descripcion') ?? '') || null,
                });
                event.currentTarget.reset();
              }}
            >
              <input name="nombre" placeholder="Nuevo estilo" required />
              <input name="descripcion" placeholder="Descripción breve" />
              <button className="secondary-action" type="submit">Añadir</button>
            </form>
          ) : null}
        </article>

        <article className="panel-card">
          <div className="panel-card-header">
            <h2>Formas</h2>
            <span className="soft-pill">{forms.length}</span>
          </div>
          {forms.length === 0 ? (
            <EmptyState title="Sin formas" text="Añade estilos y formas para empezar a registrar progreso." />
          ) : (
            <div className="simple-list">
              {forms.map((form) => (
                <div key={form.id_forma} className="list-row">
                  <div>
                    <strong>{form.nombre}</strong>
                    <span>{form.style?.nombre ?? 'Sin estilo'}</span>
                  </div>
                  <small>{form.knownByStudents.length} alumno(s)</small>
                </div>
              ))}
            </div>
          )}
          {isAdmin ? (
            <form
              className="compact-form"
              onSubmit={(event) => {
                const formData = formToPayload(event);
                createFormMutation.mutate({
                  nombre: String(formData.get('nombre') ?? '').trim(),
                  descripcion: String(formData.get('descripcion') ?? '') || null,
                  id_estilo: Number(formData.get('id_estilo')),
                });
                event.currentTarget.reset();
              }}
            >
              <input name="nombre" placeholder="Nueva forma" required />
              <select name="id_estilo" required defaultValue={styles[0]?.id_estilo ?? ''}>
                {styles.map((style) => (
                  <option key={style.id_estilo} value={style.id_estilo}>
                    {style.nombre}
                  </option>
                ))}
              </select>
              <input name="descripcion" placeholder="Descripción" />
              <button className="secondary-action" type="submit" disabled={styles.length === 0}>
                Añadir
              </button>
            </form>
          ) : null}
        </article>
      </div>

      <article className="panel-card spaced-panel">
        <div className="panel-card-header">
          <h2>Grados y formas requeridas</h2>
          <span className="soft-pill">{grades.length} grado(s)</span>
        </div>

        {grades.length === 0 ? (
          <EmptyState title="Sin grados" text="Crea grados para clasificar alumnos y progreso." />
        ) : (
          <div className="grade-grid">
            {grades.map((grade) => {
              const selectedFormId = requiredFormByGrade[grade.id_grado] ?? '';
              const availableForms = forms.filter(
                (form) => !grade.requiredForms.some((required) => Number(required.id_forma) === Number(form.id_forma)),
              );

              return (
                <section key={grade.id_grado} className="grade-card">
                  <div>
                    <strong>{grade.nombre}</strong>
                    <span>{grade.color_cinturon} · orden {grade.orden_grado}</span>
                    <small>{grade.students.length} alumno(s)</small>
                  </div>

                  <div className="tag-list">
                    {grade.requiredForms.length === 0 ? (
                      <span className="muted">Sin formas requeridas</span>
                    ) : (
                      grade.requiredForms.map((form) => (
                        <span key={form.id_forma} className="removable-tag">
                          <span className="removable-tag-text">{form.nombre}</span>
                          {isAdmin ? (
                            <button
                              type="button"
                              onClick={() => removeRequiredFormMutation.mutate(`${grade.id_grado},${form.id_forma}`)}
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
                        value={selectedFormId}
                        onChange={(event) =>
                          setRequiredFormByGrade((current) => ({
                            ...current,
                            [grade.id_grado]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Añadir forma...</option>
                        {availableForms.map((form) => (
                          <option key={form.id_forma} value={form.id_forma}>
                            {form.nombre}
                          </option>
                        ))}
                      </select>
                      <button
                        className="secondary-action"
                        type="button"
                        disabled={!selectedFormId}
                        onClick={() =>
                          addRequiredFormMutation.mutate({
                            id_grado: grade.id_grado,
                            id_forma: Number(selectedFormId),
                            es_opcional: false,
                          })
                        }
                      >
                        Añadir
                      </button>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}

        {isAdmin ? (
          <form
            className="compact-form"
            onSubmit={(event) => {
              const formData = formToPayload(event);
              createGradeMutation.mutate({
                nombre: String(formData.get('nombre') ?? '').trim(),
                orden_grado: Number(formData.get('orden_grado')),
                color_cinturon: String(formData.get('color_cinturon') ?? '').trim(),
                formas_requeridas: 0,
              });
              event.currentTarget.reset();
            }}
          >
            <input name="nombre" placeholder="Nuevo grado" required />
            <input name="color_cinturon" placeholder="Color cinturón" required />
            <input name="orden_grado" type="number" min="1" placeholder="Orden" required />
            <button className="secondary-action" type="submit">Añadir grado</button>
          </form>
        ) : null}
      </article>

      <article className="panel-card spaced-panel">
        <div className="panel-card-header">
          <h2>Tipos de curso</h2>
          <span className="soft-pill">{courses.length}</span>
        </div>
        <div className="simple-list">
          {courses.map((course) => (
            <div key={course.id_curso} className="list-row">
              <div>
                <strong>{course.nombre}</strong>
                <span>{course.tema}</span>
              </div>
              <small>{course.descripcion ?? '—'}</small>
            </div>
          ))}
        </div>
        {isAdmin ? (
          <form
            className="compact-form"
            onSubmit={(event) => {
              const formData = formToPayload(event);
              createCourseMutation.mutate({
                nombre: String(formData.get('nombre') ?? '').trim(),
                tema: String(formData.get('tema') ?? '').trim(),
                descripcion: String(formData.get('descripcion') ?? '') || null,
              });
              event.currentTarget.reset();
            }}
          >
            <input name="nombre" placeholder="Nombre del curso" required />
            <input name="tema" placeholder="Tema" required />
            <input name="descripcion" placeholder="Descripción" />
            <button className="secondary-action" type="submit">Añadir curso</button>
          </form>
        ) : null}
      </article>
    </section>
  );
}
