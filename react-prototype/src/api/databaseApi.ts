import { API_URL } from '../config'
import type { DatabaseHealth } from '../types/database'

export class ApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function apiRequest<T>(path: string): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new ApiError('No se ha podido conectar con el backend local.')
  }

  if (!response.ok) {
    throw new ApiError(
      `El backend ha respondido con el estado ${response.status}.`,
      response.status,
    )
  }

  return response.json() as Promise<T>
}

export const databaseApi = {
  health: () => apiRequest<DatabaseHealth>('/api/database/health'),

  rows: <TRow>(tableName: string, limit = 500) =>
    apiRequest<TRow[]>(
      `/api/database/tables/${encodeURIComponent(tableName)}/rows?limit=${limit}`,
    ),
}
