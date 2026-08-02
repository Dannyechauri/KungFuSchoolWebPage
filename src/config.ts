export const config = {
  /**
   * Vite expone las variables que empiezan por VITE_ en `import.meta.env`.
   * Dejamos 127.0.0.1 como valor por defecto para evitar problemas de cookies
   * entre localhost/127.0.0.1 cuando el backend usa sesión.
   */
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8080',
};
