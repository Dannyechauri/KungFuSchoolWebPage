import { apiRequest } from '../../api/client'

export type EntityId = string | number

export type CalendarCourse = {
  id_curso: EntityId
  nombre: string
  tema: string
  descripcion: string | null
  tipo_curso: 'HABITUAL' | 'CURSO_ESPECIAL'
}

export type CalendarInstructor = {
  id_instructor: EntityId
  nombre: string
  activo?: boolean | null
}

export type CalendarRoom = {
  id_sala: EntityId
  nombre: string
  activo: boolean
}

export type CalendarEvent = {
  id_curso_agendado: EntityId
  id_curso: EntityId
  id_instructor: EntityId
  id_sala: EntityId | null
  fecha_hora: string
  fecha_hora_fin: string
  activo: boolean
  id_horario_recurrente: EntityId | null
  modificado_manualmente: boolean
  curso_nombre: string
  curso_tema: string
  curso_descripcion: string | null
  tipo_curso: 'HABITUAL' | 'CURSO_ESPECIAL'
  instructor_nombre: string
  sala_nombre: string | null
}

export type RecurringRule = {
  id_horario_recurrente: EntityId
  id_curso: EntityId
  curso_nombre: string
  tipo_curso: 'HABITUAL' | 'CURSO_ESPECIAL'
  id_instructor: EntityId
  instructor_nombre: string
  id_sala: EntityId | null
  sala_nombre: string | null
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  fecha_inicio: string
  fecha_fin: string | null
  activo: boolean
}

export type EventPayload = {
  courseId: number
  instructorId: number
  roomId: number
  startAt: string
  endAt: string
}

export type RecurringPayload = {
  courseId: number
  instructorId: number
  roomId: number
  weekdays: number[]
  startTime: string
  endTime: string
  startsOn: string
  endsOn: string | null
}

export type CoursePayload = {
  nombre: string
  tema: string
  descripcion: string | null
  tipo_curso: 'HABITUAL' | 'CURSO_ESPECIAL'
}

export const entityKey = (id: EntityId) => String(id)

export function getCalendarCourses() {
  return apiRequest<CalendarCourse[]>('/api/calendar/courses')
}

export function getCalendarInstructors() {
  return apiRequest<CalendarInstructor[]>('/api/calendar/instructors')
}

export function getCalendarRooms() {
  return apiRequest<CalendarRoom[]>('/api/calendar/rooms')
}

export function getCalendarEvents(from: string, to: string, roomId: string | null) {
  const query = new URLSearchParams({ from, to })
  if (roomId) query.set('roomId', roomId)
  return apiRequest<CalendarEvent[]>(`/api/calendar/events?${query.toString()}`)
}

export function getRecurringRules() {
  return apiRequest<RecurringRule[]>('/api/calendar/recurring-rules')
}

export function createCalendarEvent(payload: EventPayload) {
  return apiRequest('/api/calendar/events', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateCalendarEvent(id: EntityId, payload: Partial<EventPayload>) {
  return apiRequest(`/api/calendar/events/${entityKey(id)}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function cancelCalendarEvent(id: EntityId) {
  return apiRequest(`/api/calendar/events/${entityKey(id)}/cancel`, { method: 'POST' })
}

export function createRecurringRules(payload: RecurringPayload) {
  return apiRequest('/api/calendar/recurring-rules', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateRecurringRule(id: EntityId, payload: Partial<RecurringPayload>) {
  return apiRequest(`/api/calendar/recurring-rules/${entityKey(id)}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function cancelRecurringRule(id: EntityId) {
  return apiRequest(`/api/calendar/recurring-rules/${entityKey(id)}/cancel`, { method: 'POST' })
}

export function createCalendarCourse(payload: CoursePayload) {
  return apiRequest<CalendarCourse>('/api/calendar/courses', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateCalendarCourse(id: EntityId, payload: Partial<CoursePayload>) {
  return apiRequest<CalendarCourse>(`/api/calendar/courses/${entityKey(id)}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function createCalendarRoom(nombre: string) {
  return apiRequest<CalendarRoom>('/api/calendar/rooms', { method: 'POST', body: JSON.stringify({ nombre }) })
}

export function updateCalendarRoom(id: EntityId, payload: { nombre?: string; activo?: boolean }) {
  return apiRequest<CalendarRoom>(`/api/calendar/rooms/${entityKey(id)}`, { method: 'PATCH', body: JSON.stringify(payload) })
}
