import { Navigate, Route, Routes } from 'react-router-dom';
import { LoadingState } from './components/LoadingState';
import { useAuth } from './features/auth/AuthProvider';
import { LoginPage } from './features/auth/LoginPage';
import { MasterLayout } from './layout/MasterLayout';
import { CalendarPage } from './pages/CalendarPage';
import { DashboardPage } from './pages/DashboardPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { StudentProfilePage } from './pages/StudentProfilePage';
import { StudentsPage } from './pages/StudentsPage';
import { TeamPage } from './pages/TeamPage';

export function App() {
  const { user, isCheckingSession } = useAuth();

  if (isCheckingSession) {
    return <LoadingState label="Comprobando sesión..." />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    /*
      Routes contiene el mapa de páginas de la app. Cada Route asocia una URL
      con un componente React; las rutas hijas se renderizan dentro del <Outlet>
      que vive en MasterLayout.
    */
    <Routes>
      <Route element={<MasterLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/alumnos" element={<StudentsPage />} />
        <Route path="/alumnos/:studentId" element={<StudentProfilePage />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/conocimiento" element={<KnowledgePage />} />
        <Route path="/equipo" element={<TeamPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
