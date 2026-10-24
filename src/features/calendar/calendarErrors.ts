import { ApiRequestError } from '../../api/client'

export function calendarErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError && error.status === 409) {
    if (error.message.toLowerCase().includes('solapa')) return `La sala ya está ocupada en ese horario. ${error.message}`
    return error.message
  }
  return error instanceof Error ? error.message : 'No se pudo completar la operación.'
}