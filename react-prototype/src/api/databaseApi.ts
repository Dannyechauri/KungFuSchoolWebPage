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

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
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

export type AuthSession = {
  authenticated: boolean
  role: 'ADMIN' | 'USER'
  userId: number
  displayName: string
}

export const authApi = {
  me: () => apiRequest<AuthSession>('/api/auth/me'),

  login: (email: string, password: string) =>
    apiRequest<AuthSession>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    apiRequest<{ authenticated: boolean }>('/api/auth/logout', {
      method: 'DELETE',
    }),
}

export const databaseApi = {
  health: () => apiRequest<DatabaseHealth>('/api/database/health'),

  tables: () => apiRequest<string[]>('/api/database/tables'),

  rows: <TRow>(tableName: string, limit = 500) =>
    apiRequest<TRow[]>(
      `/api/database/tables/${encodeURIComponent(tableName)}/rows?limit=${limit}`,
    ),

  insert: <TRow>(tableName: string, payload: Record<string, unknown>) =>
    apiRequest<TRow>(`/api/database/tables/${encodeURIComponent(tableName)}/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  update: <TRow>(
    tableName: string,
    id: string | number,
    payload: Record<string, unknown>,
  ) =>
    apiRequest<TRow>(
      `/api/database/tables/${encodeURIComponent(tableName)}/rows/${encodeURIComponent(String(id))}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    ),

  delete: (tableName: string, id: string | number) =>
    apiRequest<{ deleted: boolean }>(
      `/api/database/tables/${encodeURIComponent(tableName)}/rows/${encodeURIComponent(String(id))}`,
      { method: 'DELETE' },
    ),

  optionalRows: async <TRow>(tableName: string, limit = 500) => {
    try {
      return await databaseApi.rows<TRow>(tableName, limit)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return []
      }

      throw error
    }
  },
}
