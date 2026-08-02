import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '../../api/schoolApi';
import type { SessionUser } from '../../types/school';

interface AuthContextValue {
  user: SessionUser | null;
  isCheckingSession: boolean;
  loginError: string | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  /**
   * `useState` guarda datos que cambian con la interacción del usuario.
   * Si cambia `user`, React vuelve a pintar las partes de pantalla que dependen
   * de la sesión: menú, nombre del usuario, permisos, etc.
   */
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  /**
   * `useEffect` ejecuta un efecto después del primer render. Aquí preguntamos
   * al backend si ya existe una cookie de sesión válida.
   */
  useEffect(() => {
    let ignoreResult = false;

    authApi
      .me()
      .then((sessionUser) => {
        if (!ignoreResult) setUser(sessionUser);
      })
      .catch(() => {
        if (!ignoreResult) setUser(null);
      })
      .finally(() => {
        if (!ignoreResult) setIsCheckingSession(false);
      });

    return () => {
      ignoreResult = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoginError(null);

    try {
      const sessionUser = await authApi.login(email, password);
      setUser(sessionUser);
    } catch {
      setLoginError('No hemos podido iniciar sesión. Revisa el correo y la contraseña.');
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isCheckingSession,
      loginError,
      isAdmin: user?.role === 'ADMIN',
      login,
      logout,
    }),
    [isCheckingSession, login, loginError, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return context;
}
