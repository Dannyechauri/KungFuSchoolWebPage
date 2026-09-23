import { NavLink, Route, Routes } from 'react-router'
import { PlaceholderPage, ProfilePlaceholderPage } from './pages/PlaceholderPage'

const navigationItems = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/calendario', label: 'Calendario' },
  { to: '/alumnos', label: 'Alumnos' },
  { to: '/equipo', label: 'Equipo docente' },
  { to: '/cursos', label: 'Cursos' },
  { to: '/estilos', label: 'Estilos' },
  { to: '/formas', label: 'Formas' },
  { to: '/grados', label: 'Grados' },
  { to: '/administracion', label: 'Administración' },
  { to: '/acceso', label: 'Acceso' },
]

function App() {
  return (
    <div>
      <aside>
        <h1>Instituto de Wu-shu de Barcelona</h1>
        <nav aria-label="Navegación principal">
          <ul>
            {navigationItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main>
        <Routes>
          <Route index element={<PlaceholderPage title="Inicio" description="Resumen de la escuela y próximas actividades." />} />
          <Route path="calendario" element={<PlaceholderPage title="Calendario" description="Actividades y cursos agendados." />} />
          <Route path="calendario/:courseSessionId" element={<ProfilePlaceholderPage title="Actividad" parameterName="courseSessionId" />} />
          <Route path="alumnos" element={<PlaceholderPage title="Alumnos" description="Listado de alumnado y su seguimiento." />} />
          <Route path="alumnos/:studentId" element={<ProfilePlaceholderPage title="Ficha de alumno" parameterName="studentId" />} />
          <Route path="equipo" element={<PlaceholderPage title="Equipo docente" description="Listado de instructores." />} />
          <Route path="equipo/:instructorId" element={<ProfilePlaceholderPage title="Ficha de instructor" parameterName="instructorId" />} />
          <Route path="cursos" element={<PlaceholderPage title="Cursos" description="Catálogo de cursos y sus actividades." />} />
          <Route path="estilos" element={<PlaceholderPage title="Estilos" description="Estilos de Wu-shu impartidos en la escuela." />} />
          <Route path="formas" element={<PlaceholderPage title="Formas" description="Formas asociadas a cada estilo." />} />
          <Route path="grados" element={<PlaceholderPage title="Grados" description="Progresión y requisitos de grado." />} />
          <Route path="administracion" element={<PlaceholderPage title="Administración" description="Herramientas reservadas para administración." />} />
          <Route path="acceso" element={<PlaceholderPage title="Acceso" description="Inicio de sesión para miembros de la escuela." />} />
          <Route path="*" element={<PlaceholderPage title="Página no encontrada" description="La ruta no existe en la aplicación." />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
