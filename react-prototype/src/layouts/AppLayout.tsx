import { NavLink, Outlet } from 'react-router-dom'
import { API_URL } from '../config'
import { ZodiacCarousel } from '../components/ZodiacCarousel'
import { useAuth } from '../features/auth/authContext'

const navigation = [
  { to: '/', label: 'Panel', marker: '01', end: true },
  { to: '/alumnos', label: 'Alumnos', marker: '02' },
  { to: '/agenda', label: 'Agenda', marker: '03' },
  { to: '/conocimiento', label: 'Conocimiento', marker: '04' },
  { to: '/equipo', label: 'Equipo', marker: '05' },
]

export function AppLayout() {
  const { session, logout } = useAuth()

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
            <strong>Instituto de Wu-shu</strong>
            <p>de Barcelona</p>
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
          <div className="session-chip">
            <strong>{session.displayName}</strong>
            <span>{session.role === 'ADMIN' ? 'Administrador' : 'Usuario'}</span>
            <button type="button" onClick={() => void logout()}>
              Salir
            </button>
          </div>
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
        <ZodiacCarousel />
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
