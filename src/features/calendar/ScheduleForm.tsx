import { useState, type FormEvent } from 'react'
import { SelectField } from '../../components/SelectField'
import type { CalendarCourse, CalendarEvent, CalendarInstructor, CalendarRoom, RecurringPayload, RecurringRule, EventPayload } from './calendarApi'
import { entityKey } from './calendarApi'

export type ScheduleFormTarget =
  | { kind: 'event-create'; date: string }
  | { kind: 'rule-create'; date: string }
  | { kind: 'event-edit'; event: CalendarEvent }
  | { kind: 'rule-edit'; rule: RecurringRule }

type ScheduleFormProps = {
  target: ScheduleFormTarget
  courses: CalendarCourse[]
  instructors: CalendarInstructor[]
  rooms: CalendarRoom[]
  saving: boolean
  error: string | null
  onCancel: () => void
  onCancelEvent?: (event: CalendarEvent) => void
  onSubmitEvent: (id: CalendarEvent['id_curso_agendado'] | null, payload: EventPayload) => void
  onSubmitRule: (id: RecurringRule['id_horario_recurrente'] | null, payload: RecurringPayload) => void
}

const weekdays = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
]

const inputClass = 'min-h-11 w-full rounded-soft border border-line bg-white px-3 text-ink'
const labelClass = 'grid gap-2 text-sm font-bold text-muted'

function parseId(value: FormDataEntryValue | null) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : 0
}

export function ScheduleForm({ target, courses, instructors, rooms, saving, error, onCancel, onCancelEvent, onSubmitEvent, onSubmitRule }: ScheduleFormProps) {
  const isRule = target.kind === 'rule-create' || target.kind === 'rule-edit'
  const isEditing = target.kind === 'event-edit' || target.kind === 'rule-edit'
  const [validationError, setValidationError] = useState<string | null>(null)
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>(target.kind === 'rule-edit' ? [target.rule.dia_semana] : [])
  const currentEvent = target.kind === 'event-edit' ? target.event : null
  const currentEventSpansDates = Boolean(currentEvent && currentEvent.fecha_hora.slice(0, 10) !== currentEvent.fecha_hora_fin.slice(0, 10))
  const currentRule = target.kind === 'rule-edit' ? target.rule : null
  const initialDate = 'date' in target ? target.date : ''
  const currentRoomId = currentEvent?.id_sala ?? currentRule?.id_sala
  const currentInstructorId = currentEvent?.id_instructor ?? currentRule?.id_instructor
  const availableRooms = rooms.filter((room) => room.activo || (currentRoomId !== null && currentRoomId !== undefined && entityKey(room.id_sala) === entityKey(currentRoomId)))
  const availableCourses = courses.filter((course) => !isRule || course.tipo_curso === 'HABITUAL')
  const availableInstructors = instructors.filter((instructor) =>
    instructor.activo !== false ||
    (currentInstructorId !== null && currentInstructorId !== undefined && entityKey(instructor.id_instructor) === entityKey(currentInstructorId)),
  )

  function toggleWeekday(weekday: number) {
    setSelectedWeekdays((selected) => selected.includes(weekday)
      ? selected.filter((day) => day !== weekday)
      : [...selected, weekday].sort((first, second) => first - second))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setValidationError(null)
    const data = new FormData(event.currentTarget)
    const courseId = parseId(data.get('courseId'))
    const instructorId = parseId(data.get('instructorId'))
    const roomId = parseId(data.get('roomId'))

    if (!courseId || !instructorId || !roomId) {
      setValidationError('Selecciona un curso, un instructor y una sala activa.')
      return
    }

    if (isRule) {
      const payload: RecurringPayload = {
        courseId,
        instructorId,
        roomId,
        weekdays: target.kind === 'rule-edit' ? [target.rule.dia_semana] : selectedWeekdays,
        startTime: String(data.get('startTime')),
        endTime: String(data.get('endTime')),
        startsOn: String(data.get('startsOn')),
        endsOn: String(data.get('endsOn') || '') || null,
      }
      if (!payload.weekdays.length) {
        setValidationError('Selecciona al menos un día de la semana.')
        return
      }
      if (payload.endTime <= payload.startTime) {
        setValidationError('La hora de fin debe ser posterior a la de inicio.')
        return
      }
      if (payload.endsOn && payload.endsOn < payload.startsOn) {
        setValidationError('La fecha final debe ser posterior a la inicial.')
        return
      }
      onSubmitRule(currentRule?.id_horario_recurrente ?? null, payload)
      return
    }

    const sessionDate = String(data.get('sessionDate'))
    const startAt = `${sessionDate}T${String(data.get('startTime'))}:00`
    const endAt = `${sessionDate}T${String(data.get('endTime'))}:00`
    if (endAt <= startAt) {
      setValidationError('El final debe ser posterior al inicio.')
      return
    }
    onSubmitEvent(currentEvent?.id_curso_agendado ?? null, { courseId, instructorId, roomId, startAt, endAt })
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <div>
        <h2 className="m-0 text-xl font-bold text-ink">
          {target.kind === 'event-edit' ? 'Editar sesión' : target.kind === 'rule-edit' ? 'Editar horario habitual' : 'Programar actividad'}
        </h2>
        {currentEvent?.id_horario_recurrente ? <p className="mt-1 text-sm text-muted">Este cambio afecta solo a esta sesión, no al resto de la regla semanal.</p> : null}
        {currentEventSpansDates ? <p className="mt-1 rounded-soft bg-gold/15 p-3 text-sm text-red-dark" role="status">Este registro antiguo abarca varias fechas. Al guardarlo quedará como una sesión en la fecha de inicio; crea otra sesión para cada día restante.</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className={labelClass}>
          Curso
          <SelectField name="courseId" defaultValue={entityKey(currentEvent?.id_curso ?? currentRule?.id_curso ?? availableCourses[0]?.id_curso ?? '')} required>
            {availableCourses.map((course) => <option key={entityKey(course.id_curso)} value={entityKey(course.id_curso)}>{course.nombre} · {course.tipo_curso === 'HABITUAL' ? 'Habitual' : 'Especial'}</option>)}
          </SelectField>
        </label>
        <label className={labelClass}>
          Instructor
          <SelectField name="instructorId" defaultValue={entityKey(currentEvent?.id_instructor ?? currentRule?.id_instructor ?? availableInstructors[0]?.id_instructor ?? '')} required>
            {availableInstructors.map((instructor) => <option key={entityKey(instructor.id_instructor)} value={entityKey(instructor.id_instructor)}>{instructor.nombre}{instructor.activo === false ? ' · Inactivo' : ''}</option>)}
          </SelectField>
        </label>
        <label className={labelClass}>
          Sala
          <SelectField name="roomId" defaultValue={entityKey(currentRoomId ?? availableRooms.find((room) => room.activo)?.id_sala ?? '')} required>
            {availableRooms.map((room) => <option key={entityKey(room.id_sala)} value={entityKey(room.id_sala)}>{room.nombre}{room.activo ? '' : ' · Inactiva'}</option>)}
          </SelectField>
        </label>

        {isRule ? (
          <>
            <fieldset className="grid gap-2 border-0 p-0 sm:col-span-2 xl:col-span-3">
              <legend className="mb-2 text-sm font-bold text-muted">Días de la semana</legend>
              <div className="flex flex-wrap gap-2">
                {weekdays.map((day) => {
                  const checked = selectedWeekdays.includes(day.value)
                  return (
                    <label key={day.value} className={`cursor-pointer rounded-full border px-3 py-2 text-sm font-bold ${checked ? 'border-red bg-red text-white' : 'border-line bg-white text-muted'}`}>
                      <input className="sr-only" type="checkbox" checked={checked} disabled={target.kind === 'rule-edit'} onChange={() => toggleWeekday(day.value)} />
                      {day.label}
                    </label>
                  )
                })}
              </div>
            </fieldset>
            <label className={labelClass}>
              Hora de inicio
              <input className={inputClass} name="startTime" type="time" defaultValue={currentRule?.hora_inicio.slice(0, 5) ?? '18:30'} required />
            </label>
            <label className={labelClass}>
              Hora de fin
              <input className={inputClass} name="endTime" type="time" defaultValue={currentRule?.hora_fin.slice(0, 5) ?? '20:00'} required />
            </label>
            <label className={labelClass}>
              Desde
              <input className={inputClass} name="startsOn" type="date" defaultValue={currentRule?.fecha_inicio ?? initialDate} required />
            </label>
            <label className={labelClass}>
              Hasta (opcional)
              <input className={inputClass} name="endsOn" type="date" defaultValue={currentRule?.fecha_fin ?? ''} />
            </label>
          </>
        ) : (
          <>
            <label className={labelClass}>
              Fecha de la sesión
              <input className={inputClass} name="sessionDate" type="date" defaultValue={currentEvent?.fecha_hora.slice(0, 10) ?? initialDate} required />
            </label>
            <label className={labelClass}>
              Hora de inicio
              <input className={inputClass} name="startTime" type="time" defaultValue={currentEvent?.fecha_hora.slice(11, 16) ?? '18:30'} required />
            </label>
            <label className={labelClass}>
              Hora de fin
              <input className={inputClass} name="endTime" type="time" defaultValue={currentEvent?.fecha_hora_fin.slice(11, 16) ?? '20:00'} required />
            </label>
          </>
        )}
      </div>

      {!availableCourses.length ? <p className="m-0 text-sm font-semibold text-red-dark">Crea primero un curso {isRule ? 'habitual' : ''} para poder programarlo.</p> : null}
      {!availableInstructors.length ? <p className="m-0 text-sm font-semibold text-red-dark">No hay instructores disponibles.</p> : null}
      {!availableRooms.some((room) => room.activo || entityKey(room.id_sala) === entityKey(currentRoomId ?? '')) ? <p className="m-0 text-sm font-semibold text-red-dark">Añade una sala activa antes de programar actividades.</p> : null}
      {validationError || error ? <p className="m-0 rounded-soft bg-red/10 p-3 text-sm font-bold text-red-dark" role="alert">{validationError ?? error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button className="min-h-11 rounded-full bg-red px-5 text-sm font-bold text-white hover:bg-red-dark disabled:opacity-50" type="submit" disabled={saving || !availableCourses.length || !availableInstructors.length || !availableRooms.length}>
          {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : isRule ? 'Crear horario habitual' : 'Añadir a la agenda'}
        </button>
        {target.kind === 'event-edit' && target.event.activo && onCancelEvent ? <button className="min-h-11 rounded-full border border-red px-5 text-sm font-bold text-red-dark disabled:opacity-50" type="button" onClick={() => onCancelEvent(target.event)} disabled={saving}>Cancelar sesión</button> : null}
        <button className="min-h-11 rounded-full border border-line px-5 text-sm font-bold text-muted" type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
      </div>
    </form>
  )
}
