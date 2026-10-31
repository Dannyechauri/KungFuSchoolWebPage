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

export type CancellationNotification = {
  id_aviso: EntityId
  id_curso_agendado: EntityId
  curso_nombre: string
  fecha_hora: string
  fecha_hora_fin: string
  sala_nombre: string | null
}

export type EventRequest = {
  id_curso_agendado: EntityId
  curso_nombre: string
  fecha_hora: string
  fecha_hora_fin: string
  sala_nombre: string | null
  descripcion: string | null
  organizador_nombre: string | null
}

export type EventResponseNotice = {
  id_aviso: EntityId
  decision: 'ACEPTADO' | 'RECHAZADO'
  curso_nombre: string
  instructor_nombre: string
  fecha_hora: string
  fecha_hora_fin: string
  sala_nombre: string | null
}

export type EventNotifications = { requests: EventRequest[]; responses: EventResponseNotice[] }

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
  estado_instructor: 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO'
  puede_modificar: boolean
  curso_nombre: string
  curso_tema: string
  curso_descripcion: string | null
  descripcion?: string | null
  tipo_curso: 'HABITUAL' | 'CURSO_ESPECIAL'
  instructor_nombre: string
  sala_nombre: string | null
  limite_participantes: number | null
  mostrar_asistentes: boolean
  asistentes: { alumnos: number; instructores: number } | null
  completo: boolean
  mi_participacion: { rol: ParticipationRole; serie: boolean } | null
}

export type ParticipationRole = 'ALUMNO' | 'INSTRUCTOR'
export type ParticipationScope = 'occurrence' | 'series'

export type EventParticipant = {
  id_alumno: EntityId
  nombre: string
  rol: ParticipationRole
  serie: boolean
}

export type ParticipationSettings = {
  participantLimit?: number | null
  showAttendeeCount?: boolean
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
  limite_participantes: number | null
  mostrar_asistentes: boolean
  puede_modificar: boolean
}

export type EventPayload = ParticipationSettings & {
  courseId: number
  instructorId: number
  roomId: number
  startAt: string
  endAt: string
  description?: string | null
}

export type RecurringPayload = ParticipationSettings & {
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

export function getPendingCancellationNotifications() {
  return apiRequest<CancellationNotification[]>('/api/calendar/cancellation-notifications')
}

export function acknowledgeCancellationNotification(id: EntityId) {
  return apiRequest<{ acknowledged: boolean }>(`/api/calendar/cancellation-notifications/${entityKey(id)}/acknowledge`, { method: 'POST' })
}

export function getEventNotifications() {
  return apiRequest<EventNotifications>('/api/calendar/event-notifications')
}

export function respondToEventRequest(id: EntityId, decision: 'ACEPTADO' | 'RECHAZADO') {
  return apiRequest(`/api/calendar/event-requests/${entityKey(id)}/respond`, { method: 'POST', body: JSON.stringify({ decision }) })
}

export function acknowledgeEventResponse(id: EntityId) {
  return apiRequest<{ acknowledged: boolean }>(`/api/calendar/event-notifications/${entityKey(id)}/acknowledge`, { method: 'POST' })
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

export function joinCalendarEvent(id: EntityId, scope: ParticipationScope, role: ParticipationRole) {
  return apiRequest<{ joined: EntityId[]; skipped: string[] }>(`/api/calendar/events/${entityKey(id)}/participation`, {
    method: 'POST',
    body: JSON.stringify({ scope, role }),
  })
}

export function leaveCalendarEvent(id: EntityId, scope: ParticipationScope) {
  return apiRequest(`/api/calendar/events/${entityKey(id)}/participation?scope=${scope}`, { method: 'DELETE' })
}

export function getEventParticipants(id: EntityId) {
  return apiRequest<EventParticipant[]>(`/api/calendar/events/${entityKey(id)}/participants`)
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
