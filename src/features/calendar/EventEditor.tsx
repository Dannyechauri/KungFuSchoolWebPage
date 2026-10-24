import { useEffect, useState } from 'react'
import {
  cancelCalendarEvent,
  entityKey,
  getCalendarCourses,
  getCalendarInstructors,
  getCalendarRooms,
  getRecurringRules,
  updateCalendarEvent,
  updateRecurringRule,
  type CalendarCourse,
  type CalendarEvent,
  type CalendarInstructor,
  type CalendarRoom,
  type RecurringRule,
} from './calendarApi'
import { calendarErrorMessage } from './calendarErrors'
import { ScheduleForm, type ScheduleFormTarget } from './ScheduleForm'

export type EventEditScope = 'event' | 'rule'

type EventEditorProps = {
  event: CalendarEvent
  scope: EventEditScope
  canEditParticipation: boolean
  onDone: (message: string) => void
  onClose: () => void
}

type Options = { courses: CalendarCourse[]; instructors: CalendarInstructor[]; rooms: CalendarRoom[]; rule: RecurringRule | null }

export function EventEditor({ event, scope, canEditParticipation, onDone, onClose }: EventEditorProps) {
  const [options, setOptions] = useState<Options | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const ruleId = scope === 'rule' ? event.id_horario_recurrente : null

  useEffect(() => {
    let active = true
    Promise.all([
      getCalendarCourses(),
      getCalendarInstructors(),
      getCalendarRooms(),
      ruleId === null ? Promise.resolve([]) : getRecurringRules(),
    ])
      .then(([courses, instructors, rooms, rules]) => {
        if (!active) return
        const rule = ruleId === null ? null : rules.find((candidate) => entityKey(candidate.id_horario_recurrente) === entityKey(ruleId)) ?? null
        if (ruleId !== null && !rule) {
          setLoadError('El horario habitual de esta sesión ya no está activo.')
          return
        }
        setOptions({ courses, instructors, rooms, rule })
      })
      .catch((error: unknown) => { if (active) setLoadError(calendarErrorMessage(error)) })
    return () => { active = false }
  }, [ruleId])

  async function run(action: () => Promise<unknown>, message: string) {
    setSaving(true)
    setSaveError(null)
    try {
      await action()
      onDone(message)
    } catch (error) {
      setSaveError(calendarErrorMessage(error))
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <div className="grid gap-3">
        <p className="m-0 rounded-soft bg-red/10 p-3 text-sm font-bold text-red-dark" role="alert">{loadError}</p>
        <button className="min-h-10 w-fit rounded-full border border-line px-4 text-sm font-bold text-muted" type="button" onClick={onClose}>Volver al detalle</button>
      </div>
    )
  }
  if (!options) return <p className="m-0 text-sm text-muted">Cargando opciones de edición…</p>

  const target: ScheduleFormTarget = options.rule ? { kind: 'rule-edit', rule: options.rule } : { kind: 'event-edit', event }

  return (
    <ScheduleForm
      target={target}
      courses={options.courses}
      instructors={options.instructors}
      rooms={options.rooms}
      saving={saving}
      error={saveError}
      canEditParticipation={canEditParticipation}
      onCancel={onClose}
      onCancelEvent={(cancelled) => {
        if (!window.confirm(`¿Cancelar «${cancelled.curso_nombre}» en ${cancelled.sala_nombre ?? 'sala sin asignar'}? La actividad quedará visible como cancelada.`)) return
        void run(() => cancelCalendarEvent(cancelled.id_curso_agendado), 'Sesión cancelada.')
      }}
      onSubmitEvent={(id, payload) => { if (id !== null) void run(() => updateCalendarEvent(id, payload), 'Sesión actualizada.') }}
      onSubmitRule={(id, payload) => { if (id !== null) void run(() => updateRecurringRule(id, payload), 'Horario habitual actualizado.') }}
    />
  )
}
