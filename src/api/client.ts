const apiUrl = ''

export class ApiRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

export async function apiRequest<Response>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiRequestError(body?.message ?? 'No se pudo completar la solicitud.', response.status)
  }

  return response.json() as Promise<Response>
}
