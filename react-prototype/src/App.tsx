import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/HomePage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import './App.css'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route
          path="alumnos"
          element={
            <PlaceholderPage
              title="Alumnos"
              description="Listado y progreso de los alumnos de la escuela."
            />
          }
        />
        <Route
          path="agenda"
          element={
            <PlaceholderPage
              title="Agenda"
              description="Cursos y próximas actividades de la escuela."
            />
          }
        />
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
