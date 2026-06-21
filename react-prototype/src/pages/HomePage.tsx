import { API_URL } from '../config'

export function HomePage() {
  return (
    <section>
      <p className="page-kicker">Base preparada</p>
      <h1>Panel de gestión de la escuela</h1>
      <p className="page-description">
        React Router y TanStack Query están configurados. El siguiente paso será
        conectar el dashboard con los datos existentes.
      </p>
      <p className="api-label">
        API configurada: <code>{API_URL}</code>
      </p>
    </section>
  )
}
