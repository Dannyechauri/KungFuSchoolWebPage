import { NavLink, Outlet } from 'react-router-dom'

const navigation = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/alumnos', label: 'Alumnos' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/conocimiento', label: 'Conocimiento' },
]

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-eyebrow">Prototipo React</p>
          <strong>Instituto de Wushu</strong>
        </div>
        <nav aria-label="Navegación principal">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}
