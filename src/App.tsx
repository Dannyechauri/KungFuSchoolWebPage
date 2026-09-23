import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './layouts/AppLayout'
import { CalendarPage } from './pages/CalendarPage'
import { HomePage } from './pages/HomePage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="calendario" element={<CalendarPage />} />

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

export default App
