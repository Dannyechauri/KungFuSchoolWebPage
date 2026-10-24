import type { WebRole } from './authContext'

/** Administrador, instructores y alumnos pueden entrar; los alumnos solo consultan el calendario. */
export function canUseWeb(role: WebRole | null | undefined): role is WebRole {
  return role === 'ADMIN' || role === 'INSTRUCTOR' || role === 'USER'
}

/** Programar, editar y cancelar sesiones y horarios habituales. */
export function canManageCalendar(role: WebRole | null | undefined) {
  return role === 'ADMIN' || role === 'INSTRUCTOR'
}

/** Altas y cambios de catálogo (cursos, salas, alumnos, grados, formas…): solo el administrador. */
export function canManageSchoolData(role: WebRole | null | undefined) {
  return role === 'ADMIN'
}

/** Ficha propia (datos y formas): alumnos e instructores, que siempre tienen cuenta de alumno. */
export function hasOwnProfile(role: WebRole | null | undefined) {
  return role === 'USER' || role === 'INSTRUCTOR'
}
