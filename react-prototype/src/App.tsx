import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/HomePage'
import { StudentsPage } from './pages/StudentsPage'
import { StudentProfilePage } from './pages/StudentProfilePage'
import { CalendarPage } from './pages/CalendarPage'
import { KnowledgePage } from './pages/KnowledgePage'
import { TeamPage } from './pages/TeamPage'
import { AuthGate } from './features/auth/AuthGate'
import './App.css'

function App() {
  return (
    <AuthGate>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="alumnos" element={<StudentsPage />} />
          <Route path="alumnos/:studentId" element={<StudentProfilePage />} />
          <Route path="agenda" element={<CalendarPage />} />
          <Route path="conocimiento" element={<KnowledgePage />} />
          <Route path="equipo" element={<TeamPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthGate>
  )
}

export default App
