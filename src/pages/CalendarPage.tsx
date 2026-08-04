import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { databaseApi } from '../api/schoolApi';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../features/auth/AuthProvider';
import { useSchoolData } from '../hooks/useSchoolData';
import type { ScheduledCourseRow } from '../types/school';
import { addMonths, dateKey, formatDateTime, formatTime, startOfMonth } from '../utils/date';

type CalendarMode = 'month' | 'agenda';

const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function monthCells(monthDate: Date) {
  const firstDay = startOfMonth(monthDate);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

export function CalendarPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const { isLoading, events, courses, instructors } = useSchoolData();
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month');
  const [monthDate, setMonthDate] = useState(startOfMonth(new Date()));
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const createEventMutation = useMutation({
    mutationFn: (payload: Partial<ScheduledCourseRow>) =>
      databaseApi.insert<ScheduledCourseRow>('cursos_agendados', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['school-data'] });
      setIsCreateOpen(false);
    },
  });

  const cancelEventMutation = useMutation({
    mutationFn: (eventId: number) => databaseApi.update<ScheduledCourseRow>('cursos_agendados', eventId, { activo: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['school-data'] }),
  });

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, typeof events>();

    events.forEach((event) => {
      const key = dateKey(new Date(event.fecha_hora));
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    });

    return grouped;
  }, [events]);

  const upcomingEvents = events.filter((event) => new Date(event.fecha_hora).getTime() >= Date.now()).slice(0, 40);
  const monthTitle = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(monthDate);

  function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    createEventMutation.mutate({
      id_curso: Number(formData.get('id_curso')),
      id_instructor: Number(formData.get('id_instructor')),
      fecha_hora: String(formData.get('fecha_hora')),
      activo: true,
    });
  }

  if (isLoading) return <LoadingState />;

  return (
    <section>
      <PageHeader
        eyebrow="Calendario"
        title="Agenda de clases y actividades"
        description="Actividades agendadas por fecha, curso e instructor."
        actions={
          isAdmin ? (
            <button className="primary-action" type="button" onClick={() => setIsCreateOpen(true)}>
              + Nueva actividad
            </button>
          ) : null
        }
      />

      <div className="calendar-toolbar">
        <div className="segmented-control" aria-label="Vista del calendario">
          <button
            className={calendarMode === 'month' ? 'active' : ''}
            type="button"
            onClick={() => setCalendarMode('month')}
          >
            Mes
          </button>
          <button
            className={calendarMode === 'agenda' ? 'active' : ''}
            type="button"
            onClick={() => setCalendarMode('agenda')}
          >
            Agenda
          </button>
        </div>

        <div className="month-controls">
          <button className="secondary-action" type="button" onClick={() => setMonthDate(addMonths(monthDate, -1))}>
            ←
          </button>
          <strong>{monthTitle}</strong>
          <button className="secondary-action" type="button" onClick={() => setMonthDate(addMonths(monthDate, 1))}>
            →
          </button>
        </div>
      </div>

      {calendarMode === 'month' ? (
        <div className="calendar-card">
          <div className="calendar-weekdays">
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {monthCells(monthDate).map((date) => {
              const key = dateKey(date);
              const dayEvents = eventsByDay.get(key) ?? [];
              const isOutsideMonth = date.getMonth() !== monthDate.getMonth();

              return (
                <article key={key} className={`calendar-cell ${isOutsideMonth ? 'outside-month' : ''}`}>
                  <strong>{date.getDate()}</strong>
                  <div className="calendar-events">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span key={event.id_curso_agendado} className={event.activo === false ? 'inactive' : ''}>
                        {formatTime(event.fecha_hora)} {event.course?.nombre ?? 'Clase'}
                      </span>
                    ))}
                    {dayEvents.length > 3 ? <small>+{dayEvents.length - 3} más</small> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <article className="panel-card">
          {upcomingEvents.length === 0 ? (
            <EmptyState title="Sin próximas actividades" text="Crea una actividad para verla en la agenda." />
          ) : (
            <div className="simple-list">
              {upcomingEvents.map((event) => (
                <div key={event.id_curso_agendado} className="list-row">
                  <div>
                    <strong>{event.course?.nombre ?? 'Actividad'}</strong>
                    <span>{event.course?.tema ?? 'Clase programada'}</span>
                    <small>{event.instructor?.nombre ?? 'Sin instructor asignado'}</small>
                  </div>
                  <div className="list-meta">
                    <span>{formatDateTime(event.fecha_hora)}</span>
                    {isAdmin && event.activo !== false ? (
                      <button
                        className="danger-action"
                        type="button"
                        onClick={() => cancelEventMutation.mutate(event.id_curso_agendado)}
                      >
                        Cancelar
                      </button>
                    ) : (
                      <small>{event.activo === false ? 'Cancelada' : 'Activa'}</small>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      <Modal title="Nueva actividad" isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)}>
        <form className="stacked-form" onSubmit={handleCreateEvent}>
          <label>
            Curso
            <select name="id_curso" required defaultValue={courses[0]?.id_curso ?? ''}>
              {courses.map((course) => (
                <option key={course.id_curso} value={course.id_curso}>
                  {course.nombre} {course.tema ? `— ${course.tema}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Instructor
            <select name="id_instructor" required defaultValue={instructors[0]?.id_instructor ?? ''}>
              {instructors.map((instructor) => (
                <option key={instructor.id_instructor} value={instructor.id_instructor}>
                  {instructor.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha y hora
            <input name="fecha_hora" type="datetime-local" required />
          </label>
          {courses.length === 0 || instructors.length === 0 ? (
            <p className="notice">Primero debe existir al menos un curso y un instructor.</p>
          ) : null}
          {createEventMutation.isError ? <p className="form-error">No se pudo crear la actividad.</p> : null}
          <button
            className="primary-action"
            type="submit"
            disabled={createEventMutation.isPending || courses.length === 0 || instructors.length === 0}
          >
            {createEventMutation.isPending ? 'Guardando...' : 'Guardar actividad'}
          </button>
        </form>
      </Modal>
    </section>
  );
}
