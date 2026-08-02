import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { useSchoolData } from '../hooks/useSchoolData';
import { AppLink } from '../navigation/navigation';
import { formatDateTime } from '../utils/date';

export function DashboardPage() {
  const { isLoading, isError, students, forms, grades, instructors, events } = useSchoolData();

  if (isLoading) return <LoadingState />;

  if (isError) {
    return (
      <EmptyState
        title="No se pudo cargar la escuela"
        text="Comprueba que el backend esté encendido y que la sesión siga activa."
      />
    );
  }

  const activeStudents = students.filter((student) => student.activo !== false);
  const upcomingEvents = events.filter((event) => new Date(event.fecha_hora).getTime() >= Date.now()).slice(0, 5);
  const studentsWithoutGrade = students.filter((student) => !student.grade);
  const incompleteProgress = students
    .map((student) => {
      const requiredForms = student.grade
        ? grades.find((grade) => Number(grade.id_grado) === Number(student.grade?.id_grado))?.requiredForms ?? []
        : [];
      const knownRequiredForms = requiredForms.filter((form) =>
        student.knownForms.some((knownForm) => Number(knownForm.id_forma) === Number(form.id_forma)),
      );

      return {
        student,
        missing: Math.max(requiredForms.length - knownRequiredForms.length, 0),
      };
    })
    .filter((item) => item.missing > 0)
    .slice(0, 4);

  return (
    <section>
      <PageHeader
        eyebrow="Vista de trabajo"
        title="Resumen de la escuela"
        description="Lo importante al abrir el panel: alumnos activos, próximas clases y puntos que merecen revisión."
      />

      <div className="stats-grid">
        <StatCard label="Alumnos activos" value={activeStudents.length} hint={`${students.length} registrados`} />
        <StatCard label="Próximas actividades" value={upcomingEvents.length} hint="en calendario" />
        <StatCard label="Formas registradas" value={forms.length} hint={`${grades.length} grados`} />
        <StatCard label="Instructores" value={instructors.length} hint="equipo docente" />
      </div>

      <div className="two-column-grid">
        <article className="panel-card">
          <div className="panel-card-header">
            <h2>Próximas actividades</h2>
            <AppLink to="/calendario">Ver calendario</AppLink>
          </div>

          {upcomingEvents.length === 0 ? (
            <EmptyState title="Sin actividades próximas" text="Cuando haya cursos agendados aparecerán aquí." />
          ) : (
            <div className="simple-list">
              {upcomingEvents.map((event) => (
                <div key={event.id_curso_agendado} className="list-row">
                  <div>
                    <strong>{event.course?.nombre ?? 'Actividad'}</strong>
                    <span>{event.course?.tema ?? event.course?.descripcion ?? 'Clase programada'}</span>
                  </div>
                  <div className="list-meta">
                    <span>{formatDateTime(event.fecha_hora)}</span>
                    <small>{event.instructor?.nombre ?? 'Sin instructor'}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel-card">
          <div className="panel-card-header">
            <h2>Atención del maestro</h2>
            <AppLink to="/alumnos">Ver alumnos</AppLink>
          </div>

          {studentsWithoutGrade.length > 0 ? (
            <p className="notice">
              Hay {studentsWithoutGrade.length} alumno(s) sin grado claro. Conviene revisarlo para que los filtros
              funcionen bien.
            </p>
          ) : null}

          {incompleteProgress.length === 0 ? (
            <EmptyState
              title="Sin avisos urgentes"
              text="Los alumnos tienen su grado y progreso básico correctamente relacionado."
            />
          ) : (
            <div className="simple-list">
              {incompleteProgress.map(({ student, missing }) => (
                <AppLink key={student.id_alumno} to={`/alumnos/${student.id_alumno}`} className="list-row list-row-link">
                  <div>
                    <strong>{student.nombre}</strong>
                    <span>{student.grade?.nombre ?? 'Sin grado'}</span>
                  </div>
                  <div className="list-meta">
                    <span>{missing} forma(s) pendiente(s)</span>
                  </div>
                </AppLink>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
