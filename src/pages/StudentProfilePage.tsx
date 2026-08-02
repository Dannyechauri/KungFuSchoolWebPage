import { FormEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { databaseApi } from '../api/schoolApi';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../features/auth/AuthProvider';
import { useSchoolData } from '../hooks/useSchoolData';
import type { StudentFormRow, StudentRow } from '../types/school';
import { formatDate, todayInputValue, toDateInputValue } from '../utils/date';

export function StudentProfilePage() {
  const { studentId } = useParams();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const { isLoading, students, grades, forms, gradeForms, studentForms } = useSchoolData();
  const [selectedFormId, setSelectedFormId] = useState('');

  const student = students.find((item) => String(item.id_alumno) === String(studentId));

  const requiredForms = useMemo(() => {
    if (!student?.grade) return [];
    const requiredLinks = gradeForms.filter((link) => Number(link.id_grado) === Number(student.grade?.id_grado));
    return requiredLinks
      .map((link) => forms.find((form) => Number(form.id_forma) === Number(link.id_forma)))
      .filter((form): form is NonNullable<typeof form> => Boolean(form));
  }, [forms, gradeForms, student]);

  const knownFormIds = new Set(student?.knownForms.map((form) => Number(form.id_forma)) ?? []);
  const availableForms = forms.filter((form) => !knownFormIds.has(Number(form.id_forma)));

  const updateStudentMutation = useMutation({
    mutationFn: ({ rowId, payload }: { rowId: number; payload: Partial<StudentRow> }) =>
      databaseApi.update<StudentRow>('alumnos', rowId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['school-data'] }),
  });

  const addFormMutation = useMutation({
    mutationFn: (payload: StudentFormRow) => databaseApi.insert<StudentFormRow>('alumno_forma', payload),
    onSuccess: async () => {
      setSelectedFormId('');
      await queryClient.invalidateQueries({ queryKey: ['school-data'] });
    },
  });

  const removeFormMutation = useMutation({
    mutationFn: (rowId: string) => databaseApi.delete('alumno_forma', rowId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['school-data'] }),
  });

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!student) return;

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get('password_hash') ?? '').trim();

    updateStudentMutation.mutate({
      rowId: student.id_alumno,
      payload: {
        nombre: String(formData.get('nombre') ?? '').trim(),
        numero_matricula: String(formData.get('numero_matricula') ?? '').trim(),
        fecha_ingreso: String(formData.get('fecha_ingreso') ?? ''),
        fecha_nacimiento: String(formData.get('fecha_nacimiento') ?? '') || null,
        correo_electronico: String(formData.get('correo_electronico') ?? '') || null,
        id_grado: Number(formData.get('id_grado')),
        activo: formData.get('activo') === 'on',
        ...(password ? { password_hash: password } : {}),
      },
    });
  }

  function handleAddForm() {
    if (!student || !selectedFormId) return;

    addFormMutation.mutate({
      id_alumno: student.id_alumno,
      id_forma: Number(selectedFormId),
      fecha_aprendida: todayInputValue(),
    });
  }

  if (isLoading) return <LoadingState />;

  if (!student) {
    return <EmptyState title="Alumno no encontrado" text="Puede que el alumno haya sido eliminado o no tengas permisos." />;
  }

  return (
    <section>
      <PageHeader
        eyebrow="Ficha de alumno"
        title={student.nombre}
        description={`${student.grade?.nombre ?? 'Sin grado'} · matrícula ${student.numero_matricula}`}
        actions={<Link className="secondary-action" to="/alumnos">← Volver</Link>}
      />

      <div className="profile-grid">
        <article className="panel-card">
          <div className="panel-card-header">
            <h2>Datos principales</h2>
          </div>

          {isAdmin ? (
            <form className="stacked-form" onSubmit={handleProfileSubmit}>
              <label>
                Nombre
                <input name="nombre" defaultValue={student.nombre} required />
              </label>
              <div className="form-grid">
                <label>
                  Matrícula
                  <input name="numero_matricula" defaultValue={student.numero_matricula} required />
                </label>
                <label>
                  Grado
                  <select name="id_grado" defaultValue={student.id_grado} required>
                    {grades.map((grade) => (
                      <option key={grade.id_grado} value={grade.id_grado}>
                        {grade.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Fecha ingreso
                  <input name="fecha_ingreso" type="date" defaultValue={toDateInputValue(student.fecha_ingreso)} />
                </label>
                <label>
                  Fecha nacimiento
                  <input
                    name="fecha_nacimiento"
                    type="date"
                    defaultValue={toDateInputValue(student.fecha_nacimiento)}
                  />
                </label>
              </div>
              <label>
                Correo
                <input name="correo_electronico" type="email" defaultValue={student.correo_electronico ?? ''} />
              </label>
              <label>
                Nueva contraseña opcional
                <input name="password_hash" type="password" minLength={7} />
              </label>
              <label className="checkbox-row">
                <input name="activo" type="checkbox" defaultChecked={student.activo !== false} />
                Alumno activo
              </label>
              {updateStudentMutation.isSuccess ? <p className="form-success">Datos guardados.</p> : null}
              {updateStudentMutation.isError ? <p className="form-error">No se pudieron guardar los datos.</p> : null}
              <button className="primary-action" type="submit" disabled={updateStudentMutation.isPending}>
                {updateStudentMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          ) : (
            <dl className="detail-list">
              <div><dt>Ingreso</dt><dd>{formatDate(student.fecha_ingreso)}</dd></div>
              <div><dt>Nacimiento</dt><dd>{formatDate(student.fecha_nacimiento)}</dd></div>
              <div><dt>Correo</dt><dd>{student.correo_electronico ?? '—'}</dd></div>
            </dl>
          )}
        </article>

        <article className="panel-card">
          <div className="panel-card-header">
            <h2>Progreso de formas</h2>
            <span className="soft-pill">{student.knownForms.length} aprendida(s)</span>
          </div>

          {requiredForms.length > 0 ? (
            <div className="progress-list">
              {requiredForms.map((form) => {
                const isKnown = knownFormIds.has(Number(form.id_forma));
                return (
                  <div key={form.id_forma} className={`progress-row ${isKnown ? 'done' : ''}`}>
                    <span>{isKnown ? '✓' : '·'}</span>
                    <strong>{form.nombre}</strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted">Este grado todavía no tiene formas requeridas configuradas.</p>
          )}

          <h3>Formas que sabe</h3>
          {student.knownForms.length === 0 ? (
            <p className="muted">Aún no hay formas registradas para este alumno.</p>
          ) : (
            <div className="tag-list">
              {student.knownForms.map((form) => {
                const link = studentForms.find(
                  (item) =>
                    Number(item.id_alumno) === Number(student.id_alumno) &&
                    Number(item.id_forma) === Number(form.id_forma),
                );

                return (
                  <span key={form.id_forma} className="removable-tag">
                    <span className="removable-tag-text">
                      {form.nombre}
                      {link?.fecha_aprendida ? <small>{formatDate(link.fecha_aprendida)}</small> : null}
                    </span>
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => removeFormMutation.mutate(`${student.id_alumno},${form.id_forma}`)}
                        aria-label={`Quitar ${form.nombre}`}
                      >
                        ✕
                      </button>
                    ) : null}
                  </span>
                );
              })}
            </div>
          )}

          {isAdmin ? (
            <div className="inline-form">
              <select value={selectedFormId} onChange={(event) => setSelectedFormId(event.target.value)}>
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
                onClick={handleAddForm}
                disabled={!selectedFormId || addFormMutation.isPending}
              >
                Añadir
              </button>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}
