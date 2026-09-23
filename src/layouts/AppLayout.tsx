import { NavLink, Outlet } from 'react-router'

const navigationItems = [
  { to: '/', label: 'Inicio', icon: '館' },
  { to: '/calendario', label: 'Calendario', icon: '日' },
]

export function AppLayout() {
  return (
    <div className="grid min-h-screen md:grid-cols-[18.25rem_minmax(0,1fr)]">
      <aside className="flex min-h-full flex-col bg-sidebar px-6 py-7 text-cream md:min-h-screen">
        <div className="flex items-center gap-3 pb-8">
          <img className="size-14 object-contain" src="/logo-instituto-wushu.png" alt="Instituto de Wu-shu de Barcelona" />
          <div>
            <strong className="block text-base">Instituto de Wu-shu</strong>
            <span className="block text-sm text-cream-muted">Barcelona</span>
          </div>
        </div>

        <nav className="grid content-start gap-2" aria-label="Navegación principal">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 items-center gap-3 rounded-panel px-3.5 text-base font-bold transition-colors ${
                  isActive ? 'bg-white/12 text-white' : 'text-cream-muted hover:bg-white/8 hover:text-white'
                }`
              }
            >
              <span className="grid size-9 place-items-center rounded-soft bg-gold font-black text-ink" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <p className="mt-8 rounded-panel border border-white/15 bg-white/6 p-4 text-sm leading-6 text-cream-muted">
          Primera demostración: resumen de la escuela y agenda de actividades.
        </p>
      </aside>

      <main className="min-w-0 p-6 md:p-9">
        <Outlet />
      </main>
    </div>
  )
}
