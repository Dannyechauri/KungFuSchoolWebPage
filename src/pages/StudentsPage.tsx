import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { databaseApi } from '../api/schoolApi';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../features/auth/AuthProvider';
import { useSchoolData } from '../hooks/useSchoolData';
import type { StudentRow } from '../types/school';
import { todayInputValue } from '../utils/date';

export function StudentsPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const { isLoading, students, grades, forms } = useSchoolData();

  /**
   * Estos estados son puramente de pantalla: qué busca quien usa el panel y qué
   * filtros tiene activos. No viven en backend porque son una preferencia momentánea.
   */
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [formFilter, setFormFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const createStudentMutation = useMutation({
    mutationFn: (payload: Partial<StudentRow>) => databaseApi.insert<StudentRow>('alumnos', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['school-data'] });
      setIsCreateOpen(false);
    },
  });

  const filteredStudents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        normalizedSearch === '' ||
        student.nombre.toLowerCase().includes(normalizedSearch) ||
        student.numero_matricula.toLowerCase().includes(normalizedSearch) ||
        (student.correo_electronico ?? '').toLowerCase().includes(normalizedSearch);

      const matchesGrade = gradeFilter === 'all' || String(student.id_grado) === gradeFilter;
      const matchesForm =
        formFilter === 'all' || student.knownForms.some((form) => String(form.id_forma) === formFilter);

      return matchesSearch && matchesGrade && matchesForm;
    });
  }, [formFilter, gradeFilter, searchTerm, students]);

  function handleCreateStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get('password_hash') ?? '').trim();

    createStudentMutation.mutate({
      nombre: String(formData.get('nombre') ?? '').trim(),
      numero_matricula: String(formData.get('numero_matricula') ?? '').trim(),
      fecha_ingreso: String(formData.get('fecha_ingreso') ?? todayInputValue()),
      fecha_nacimiento: String(formData.get('fecha_nacimiento') ?? '') || null,
      correo_electronico: String(formData.get('correo_electronico') ?? '') || null,
      id_grado: Number(formData.get('id_grado')),
      activo: true,
      ...(password ? { password_hash: password } : {}),
    });
  }

  if (isLoading) return <LoadingState />;

  return (
    <section>
      <PageHeader
        eyebrow="Alumnos"
        title="Alumnos de la escuela"
        description="Búsqueda, filtros por grado y forma, alta rápida y acceso a ficha."
        actions={
          isAdmin ? (
            <button className="primary-action" type="button" onClick={() => setIsCreateOpen(true)}>
              + Nuevo alumno
            </button>
          ) : null
        }
      />

      <div className="filter-card">
        <label className="wide-field">
          Buscar alumno
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Nombre, matrícula o correo"
          />
        </label>

        <label>
          Grado
          <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}>
            <option value="all">Todos</option>
            {grades.map((grade) => (
              <option key={grade.id_grado} value={grade.id_grado}>
                {grade.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Forma
          <select value={formFilter} onChange={(event) => setFormFilter(event.target.value)}>
            <option value="all">Todas</option>
            {forms.map((form) => (
              <option key={form.id_forma} value={form.id_forma}>
                {form.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredStudents.length === 0 ? (
        <EmptyState title="No hay alumnos con esos filtros" text="Prueba una búsqueda más amplia." />
      ) : (
        <div className="student-grid">
          {filteredStudents.map((student) => (
            <Link key={student.id_alumno} className="student-card" to={`/alumnos/${student.id_alumno}`}>
              <div className="student-avatar">{student.nombre.slice(0, 1).toUpperCase()}</div>
              <div>
                <strong>{student.nombre}</strong>
                <span>{student.grade?.nombre ?? 'Sin grado'}</span>
                <small>
                  {student.numero_matricula} · {student.knownForms.length} forma(s)
                </small>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal title="Nuevo alumno" isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)}>
        <form className="stacked-form" onSubmit={handleCreateStudent}>
          <label>
            Nombre completo
            <input name="nombre" required />
          </label>
          <label>
            Matrícula
            <input name="numero_matricula" placeholder="IW-2026-001" required />
          </label>
          <div className="form-grid">
            <label>
              Fecha de ingreso
              <input name="fecha_ingreso" type="date" defaultValue={todayInputValue()} required />
            </label>
            <label>
              Fecha de nacimiento
              <input name="fecha_nacimiento" type="date" />
            </label>
          </div>
          <label>
            Correo electrónico
            <input name="correo_electronico" type="email" />
          </label>
          <label>
            Grado inicial
            <select name="id_grado" required defaultValue={grades[0]?.id_grado ?? ''}>
              {grades.map((grade) => (
                <option key={grade.id_grado} value={grade.id_grado}>
                  {grade.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Contraseña inicial opcional
            <input name="password_hash" type="password" minLength={7} />
          </label>
          {createStudentMutation.isError ? (
            <p className="form-error">No se pudo crear el alumno. Revisa los datos obligatorios.</p>
          ) : null}
          <button className="primary-action" type="submit" disabled={createStudentMutation.isPending}>
            {createStudentMutation.isPending ? 'Guardando...' : 'Guardar alumno'}
          </button>
        </form>
      </Modal>
    </section>
  );
}
