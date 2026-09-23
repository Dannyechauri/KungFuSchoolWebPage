const apiUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8080'

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
    throw new Error(body?.message ?? 'No se pudo completar la solicitud.')
  }

  return response.json() as Promise<Response>
}
