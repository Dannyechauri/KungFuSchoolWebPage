import type { ReactNode } from 'react';
import { useAuth } from '../features/auth/AuthProvider';
import { AppLink, useNavigation, type AppView } from '../navigation/navigation';

const navigation = [
  { to: '/', view: 'dashboard', label: 'Inicio', icon: '院' },
  { to: '/alumnos', view: 'students', label: 'Alumnos', icon: '人' },
  { to: '/calendario', view: 'calendar', label: 'Calendario', icon: '日' },
  { to: '/conocimiento', view: 'knowledge', label: 'Conocimiento', icon: '拳' },
  { to: '/equipo', view: 'team', label: 'Equipo', icon: '师' },
];

export function MasterLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin, logout } = useAuth();
  const { route } = useNavigation();

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
            <AppLink
              key={item.to}
              to={item.to}
              className={route.view === (item.view as AppView) ? 'active' : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </AppLink>
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
          {children}
        </main>
      </div>
    </div>
  );
}
