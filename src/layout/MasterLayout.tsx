import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';

const navigation = [
  { to: '/', label: 'Inicio', icon: '院' },
  { to: '/alumnos', label: 'Alumnos', icon: '人' },
  { to: '/calendario', label: 'Calendario', icon: '日' },
  { to: '/conocimiento', label: 'Conocimiento', icon: '拳' },
  { to: '/equipo', label: 'Equipo', icon: '师' },
];

export function MasterLayout() {
  const { user, isAdmin, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <img src="/logo-instituto-wushu.png" alt="" />
          <div>
            <strong>Instituto de Wu-shu</strong>
            <span>Barcelona</span>
          </div>
        </div>

        <nav className="main-nav" aria-label="Navegación principal">
          {navigation.map((item) => (
            /*
              NavLink es como Link, pero sabe si su ruta está activa.
              Así evitamos estado manual para marcar el menú seleccionado.
            */
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-note">
          <p>Panel pensado para el trabajo diario del maestro: pocas secciones, acciones claras.</p>
          {isAdmin ? (
            <a href="/legacy-admin/" target="_blank" rel="noreferrer">
              Herramienta técnica antigua
            </a>
          ) : null}
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="session-label">Sesión activa</span>
            <strong>{user?.displayName ?? 'Usuario'}</strong>
          </div>
          <button className="secondary-action" type="button" onClick={logout}>
            Cerrar sesión
          </button>
        </header>

        <main className="content-panel">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
