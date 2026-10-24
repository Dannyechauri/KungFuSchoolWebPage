import { Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { CalendarManagementPage } from './features/calendar/CalendarManagementPage'
import { CalendarPage } from './features/calendar/CalendarPage'
import { useAuth } from './features/auth/useAuth'
import { AppLayout } from './layouts/AppLayout'
import { DataManagementPage } from './pages/DataManagementPage'
import { HomePage } from './pages/HomePage'
import { ProfilePage } from './pages/ProfilePage'

function AuthenticatedApp() {
  const { user, isCheckingSession } = useAuth()

  if (isCheckingSession) {
    return <main className="grid min-h-screen place-items-center text-muted">Comprobando sesión…</main>
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
      <Route index element={user.role === 'ADMIN' ? <HomePage /> : <Navigate to="/calendario" replace />} />
        <Route path="calendario" element={<CalendarPage />} />
        <Route
          path="calendario/gestionar"
          element={
            <ProtectedRoute required="calendar">
              <CalendarManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="mi-ficha"
          element={
            <ProtectedRoute required="profile">
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="datos"
          element={
            <ProtectedRoute required="ADMIN">
              <DataManagementPage />
            </ProtectedRoute>
          }
        />

        {/*
          Rutas previstas para fases posteriores. No se muestran aún en el menú
          porque la primera demostración solo trabajará Inicio y Calendario.

          <Route path="alumnos" element={<StudentsPage />} />
          <Route path="alumnos/:studentId" element={<StudentProfilePage />} />
          <Route path="equipo" element={<TeamPage />} />
          <Route path="equipo/:instructorId" element={<InstructorProfilePage />} />
          <Route path="cursos" element={<CoursesPage />} />
          <Route path="estilos" element={<StylesPage />} />
          <Route path="formas" element={<FormsPage />} />
          <Route path="grados" element={<GradesPage />} />
          <Route path="administracion" element={<AdministrationPage />} />
          <Route path="acceso" element={<LoginPage />} />
        */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  )
}

export default App
