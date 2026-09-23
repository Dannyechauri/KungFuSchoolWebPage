import { Link } from 'react-router'
import { PanelCard } from '../components/PanelCard'
import { formatActivityDate, getUpcomingDemoActivities } from '../data/demoActivities'

const summaryItems = [
  { label: 'Alumnos activos', value: '0', detail: 'pendientes de cargar' },
  { label: 'Instructores', value: '3', detail: 'equipo docente activo' },
  { label: 'Cursos', value: '4', detail: 'en el catálogo' },
  { label: 'Próximas actividades', value: '8', detail: 'durante las próximas semanas' },
]

export function HomePage() {
  const upcomingActivities = getUpcomingDemoActivities().slice(0, 5)
  const nextActivity = upcomingActivities[0]

  return (
    <section className="max-w-6xl">
      <p className="mb-2 text-xs font-black tracking-[0.12em] text-red uppercase">Inicio</p>
      <h1 className="m-0 text-4xl font-bold tracking-tight text-ink md:text-5xl">Resumen de la escuela</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
        Aquí construiremos la vista principal para mostrar la información útil de la escuela y las próximas actividades.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryItems.map((item) => (
          <PanelCard key={item.label} className="p-5">
            <span className="block text-sm font-bold text-muted">{item.label}</span>
            <strong className="mt-3 block text-4xl leading-none text-ink">{item.value}</strong>
            <small className="mt-3 block text-sm text-muted">{item.detail}</small>
          </PanelCard>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <PanelCard className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="m-0 text-xl font-bold text-ink">Próximas actividades</h2>
              <p className="mt-1 text-sm text-muted">Agenda programada para las próximas semanas.</p>
            </div>
            <Link className="font-bold text-red hover:text-red-dark" to="/calendario">
              Ver calendario
            </Link>
          </div>

          <ul className="mt-5 grid divide-y divide-line">
            {upcomingActivities.map((activity) => (
              <li key={`${activity.dayOffset}-${activity.time}`} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <strong className="block text-base text-ink">{activity.title}</strong>
                  <span className="mt-1 block text-sm text-muted">{activity.topic} · {activity.instructor}</span>
                </div>
                <time className="shrink-0 text-sm font-bold text-red-dark">{formatActivityDate(activity.date)}</time>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard className="flex flex-col justify-between p-6">
          <div>
            <p className="m-0 text-xs font-black tracking-[0.12em] text-red uppercase">Siguiente clase</p>
            <h2 className="mt-3 text-2xl font-bold leading-tight text-ink">{nextActivity?.title}</h2>
            <p className="mt-3 text-base leading-7 text-muted">{nextActivity?.instructor} dirige la próxima sesión del calendario.</p>
          </div>
          <div className="mt-8 border-t border-line pt-4">
            <time className="block text-lg font-bold text-red-dark">{nextActivity ? formatActivityDate(nextActivity.date) : 'Sin actividades'}</time>
            <span className="mt-1 block text-sm text-muted">{nextActivity?.topic}</span>
          </div>
        </PanelCard>
      </div>
    </section>
  )
}
