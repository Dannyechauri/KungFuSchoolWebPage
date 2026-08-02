import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';

export type AppView = 'dashboard' | 'students' | 'student-profile' | 'calendar' | 'knowledge' | 'team';

interface AppRoute {
  view: AppView;
  studentId?: string;
  path: string;
}

interface NavigationContextValue {
  route: AppRoute;
  navigate: (path: string) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

function parsePath(pathname: string): AppRoute {
  const studentMatch = pathname.match(/^\/alumnos\/([^/]+)$/);

  if (studentMatch) {
    return {
      view: 'student-profile',
      studentId: studentMatch[1],
      path: pathname,
    };
  }

  if (pathname === '/alumnos') return { view: 'students', path: pathname };
  if (pathname === '/calendario') return { view: 'calendar', path: pathname };
  if (pathname === '/conocimiento') return { view: 'knowledge', path: pathname };
  if (pathname === '/equipo') return { view: 'team', path: pathname };

  return { view: 'dashboard', path: '/' };
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState(() => parsePath(window.location.pathname));

  /**
   * Este mini-router usa la History API del navegador. No sustituye a React
   * Router en apps grandes, pero aquí reduce dependencias y enseña la idea:
   * el estado de navegación decide qué componente se muestra.
   */
  const navigate = useCallback((path: string) => {
    const nextRoute = parsePath(path);
    window.history.pushState({}, '', nextRoute.path);
    setRoute(nextRoute);
  }, []);

  useEffect(() => {
    function handlePopState() {
      setRoute(parsePath(window.location.pathname));
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const value = useMemo(() => ({ route, navigate }), [navigate, route]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const context = useContext(NavigationContext);

  if (!context) {
    throw new Error('useNavigation debe usarse dentro de NavigationProvider');
  }

  return context;
}

interface AppLinkProps {
  to: string;
  className?: string;
  children: ReactNode;
}

export function AppLink({ to, className, children }: AppLinkProps) {
  const { navigate } = useNavigation();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  }

  return (
    <a href={to} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
