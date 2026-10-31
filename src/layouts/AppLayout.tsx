import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { apiRequest } from '../api/client'
import { useAuth } from '../features/auth/useAuth'
import { PasswordChangeForm } from '../features/auth/PasswordChangeForm'
import { canViewSchoolData, hasOwnProfile } from '../features/auth/permissions'

const navigationItems = {
  home: { to: '/', label: 'Inicio', icon: '館' },
  calendar: { to: '/calendario', label: 'Calendario', icon: '日' },
  performance: { to: '/mi-desempeno', label: 'Mi desempeño', icon: '功' },
  profile: { to: '/mi-ficha', label: 'Mi ficha', icon: '形' },
  data: { to: '/datos', label: 'Datos', icon: '録' },
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [pendingConfirmations, setPendingConfirmations] = useState(0)
  const [pendingCancellationNotices, setPendingCancellationNotices] = useState(0)
  const [pendingEventNotices, setPendingEventNotices] = useState(0)
  const [pendingPromotionNotices, setPendingPromotionNotices] = useState(0)
  const canConfirm = user?.role === 'USER' || user?.role === 'INSTRUCTOR'
  const userId = user?.userId

  useEffect(() => {
    if (userId === undefined) return
    const controller = new AbortController()
    let latestRequest = 0
    async function refreshPendingConfirmations() {
      const requestId = ++latestRequest
      try {
        const [pending, cancellationNotices, promotionNotices, eventNotices] = await Promise.all([
          canConfirm ? apiRequest<{ id: number }[]>('/api/performance/confirmations/pending', { signal: controller.signal }) : [],
          canConfirm ? apiRequest<{ id_aviso: number }[]>('/api/calendar/cancellation-notifications', { signal: controller.signal }) : [],
          canConfirm ? apiRequest<{ id_aviso: string }[]>('/api/me/promotions', { signal: controller.signal }) : [],
          apiRequest<{ requests: unknown[]; responses: unknown[] }>('/api/calendar/event-notifications', { signal: controller.signal }),
        ])
        if (!controller.signal.aborted && requestId === latestRequest) {
          setPendingConfirmations(pending.length)
          setPendingCancellationNotices(cancellationNotices.length)
          setPendingPromotionNotices(promotionNotices.length)
          setPendingEventNotices(eventNotices.requests.length + eventNotices.responses.length)
        }
      } catch {
        return
      }
    }
    void refreshPendingConfirmations()
    const interval = window.setInterval(() => void refreshPendingConfirmations(), 30_000)
    const onFocus = () => { void refreshPendingConfirmations() }
    window.addEventListener('focus', onFocus)
    return () => {
      controller.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [canConfirm, userId, location.key])

  const hasPendingConfirmations = canConfirm && pendingConfirmations > 0
  const pendingCalendarNotices = (canConfirm ? pendingCancellationNotices : 0) + pendingEventNotices
  const hasPendingCancellationNotices = pendingCalendarNotices > 0
  const hasPendingPromotionNotices = canConfirm && pendingPromotionNotices > 0
  const items = [
    ...(user?.role === 'ADMIN' ? [navigationItems.home] : []),
    ...(hasOwnProfile(user?.role) ? [navigationItems.profile] : []),
    navigationItems.calendar,
    navigationItems.performance,
    ...(canViewSchoolData(user?.role) ? [navigationItems.data] : []),
  ]

  return (
    <div className="grid min-h-screen md:grid-cols-[18.25rem_minmax(0,1fr)]">
      <aside className="flex min-h-full flex-col bg-sidebar px-6 py-7 text-cream md:sticky md:top-0 md:h-screen md:min-h-0 md:self-start">
        <div className="flex items-center gap-3 pb-8">
          <img className="size-14 object-contain" src="/logo-instituto-wushu.png" alt="Instituto de Wu-shu de Barcelona" />
          <div>
            <strong className="block text-base">Instituto de Wu-shu</strong>
            <span className="block text-sm text-cream-muted">Barcelona</span>
          </div>
        </div>

        <nav className="grid content-start gap-2" aria-label="Navegación principal">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 items-center gap-3 rounded-panel px-3.5 text-base font-bold transition-colors ${
                  item === navigationItems.performance && hasPendingConfirmations
                    || item === navigationItems.calendar && hasPendingCancellationNotices
                    || item === navigationItems.profile && hasPendingPromotionNotices
                    ? 'bg-gold text-ink hover:bg-gold/90'
                    : isActive ? 'bg-white/12 text-white' : 'text-cream-muted hover:bg-white/8 hover:text-white'
                }`
              }
            >
              <span className="grid size-9 place-items-center rounded-soft bg-gold font-black text-ink" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
              {item === navigationItems.performance && hasPendingConfirmations ? (
                <span className="ml-auto grid size-7 shrink-0 place-items-center rounded-full bg-red-dark text-xs font-bold text-white" aria-label={`${pendingConfirmations} ${pendingConfirmations === 1 ? 'actividad pendiente' : 'actividades pendientes'} de confirmar o rechazar`}>
                  {pendingConfirmations > 99 ? '99+' : pendingConfirmations}
                </span>
              ) : null}
              {item === navigationItems.calendar && hasPendingCancellationNotices ? (
                <span className="ml-auto grid size-7 shrink-0 place-items-center rounded-full bg-red-dark text-xs font-bold text-white" aria-label={`${pendingCalendarNotices} ${pendingCalendarNotices === 1 ? 'aviso de calendario pendiente' : 'avisos de calendario pendientes'}`}>
                  {pendingCalendarNotices > 99 ? '99+' : pendingCalendarNotices}
                </span>
              ) : null}
              {item === navigationItems.profile && hasPendingPromotionNotices ? (
                <span className="ml-auto grid size-7 shrink-0 place-items-center rounded-full bg-red-dark text-xs font-bold text-white" aria-label={`${pendingPromotionNotices} ${pendingPromotionNotices === 1 ? 'aviso de ascenso pendiente' : 'avisos de ascenso pendientes'}`}>
                  {pendingPromotionNotices > 99 ? '99+' : pendingPromotionNotices}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 rounded-panel border border-white/15 bg-white/6 p-4 text-sm text-cream-muted">
          <strong className="block text-cream">{user?.displayName}</strong>
          <PasswordChangeForm onPasswordChanged={logout} />
          <button className="mt-2 text-sm font-bold text-cream-muted hover:text-white" type="button" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </div>

        <div className="mt-auto pt-4">
          <p className="m-0 rounded-panel border border-white/15 bg-white/6 p-4 text-sm text-cream-muted">
            v0 · Herramienta de administración
          </p>
        </div>
      </aside>

      <main className="min-w-0 p-6 md:p-9">
        <Outlet context={{
          onPendingConfirmationsChange: setPendingConfirmations,
          onPendingCancellationNoticesChange: setPendingCancellationNotices,
          onPendingEventNoticesChange: setPendingEventNotices,
          onPendingPromotionNoticesChange: setPendingPromotionNotices,
        }} />
      </main>
    </div>
  )
}
