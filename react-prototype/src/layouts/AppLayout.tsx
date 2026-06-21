import { NavLink, Outlet } from 'react-router-dom'
import { API_URL } from '../config'

const navigation = [
  { to: '/', label: 'Panel', marker: '01', end: true },
  { to: '/alumnos', label: 'Alumnos', marker: '02' },
  { to: '/agenda', label: 'Agenda', marker: '03' },
  { to: '/conocimiento', label: 'Conocimiento', marker: '04' },
]

export function AppLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img
            className="brand-logo"
            src="/logo-instituto-wushu.png"
            alt="Escudo del Instituto de Wu-shu"
          />
          <div>
            <p>Instituto de</p>
            <strong>Wu-shu</strong>
          </div>
        </div>

        <nav aria-label="Navegación principal">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              <span>{item.marker}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-line" />
          <p>Gestión académica</p>
          <small>{API_URL.replace(/^https?:\/\//, '')}</small>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="topbar-mark" aria-hidden="true">
              武
            </span>
            <strong>Instituto de Wu-shu</strong>
          </div>
          <p>Barcelona · Gestión interna</p>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
        <nav className="mobile-nav" aria-label="Navegación móvil">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              <span>{item.marker}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
