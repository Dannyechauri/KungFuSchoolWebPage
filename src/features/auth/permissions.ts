import type { WebRole } from './authContext'

export function canUseWeb(role: WebRole | null | undefined): role is 'ADMIN' | 'INSTRUCTOR' {
  return role === 'ADMIN' || role === 'INSTRUCTOR'
}

export function canManageCalendar(role: WebRole | null | undefined) {
  return role === 'ADMIN' || role === 'INSTRUCTOR'
}

export function canManageSchoolData(role: WebRole | null | undefined) {
  return role === 'ADMIN'
}
