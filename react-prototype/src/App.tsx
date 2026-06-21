import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/HomePage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { StudentsPage } from './pages/StudentsPage'
import { StudentProfilePage } from './pages/StudentProfilePage'
import { CalendarPage } from './pages/CalendarPage'
import './App.css'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="alumnos" element={<StudentsPage />} />
        <Route path="alumnos/:studentId" element={<StudentProfilePage />} />
        <Route path="agenda" element={<CalendarPage />} />
        <Route
          path="conocimiento"
          element={
            <PlaceholderPage
              title="Conocimiento"
              description="Estilos, formas y requisitos de cada grado."
            />
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
