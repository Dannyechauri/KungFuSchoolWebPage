import { LoadingState } from './components/LoadingState';
import { useAuth } from './features/auth/AuthProvider';
import { LoginPage } from './features/auth/LoginPage';
import { MasterLayout } from './layout/MasterLayout';
import { useNavigation } from './navigation/navigation';
import { CalendarPage } from './pages/CalendarPage';
import { DashboardPage } from './pages/DashboardPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { StudentProfilePage } from './pages/StudentProfilePage';
import { StudentsPage } from './pages/StudentsPage';
import { TeamPage } from './pages/TeamPage';

export function App() {
  const { user, isCheckingSession } = useAuth();
  const { route } = useNavigation();

  if (isCheckingSession) {
    return <LoadingState label="Comprobando sesión..." />;
  }

  if (!user) {
    return <LoginPage />;
  }

  const pageByRoute = {
    dashboard: <DashboardPage />,
    students: <StudentsPage />,
    'student-profile': <StudentProfilePage />,
    calendar: <CalendarPage />,
    knowledge: <KnowledgePage />,
    team: <TeamPage />,
  };

  return <MasterLayout>{pageByRoute[route.view]}</MasterLayout>;
}
