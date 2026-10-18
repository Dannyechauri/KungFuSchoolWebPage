import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { PanelCard } from '../../components/PanelCard'
import { SelectField } from '../../components/SelectField'
import { useAuth } from '../auth/useAuth'
import { canManageCalendar } from '../auth/permissions'
import {
  cancelCalendarEvent,
  cancelRecurringRule,
  createCalendarCourse,
  createCalendarEvent,
  createRecurringRules,
  entityKey,
  getCalendarCourses,
  getCalendarInstructors,
  getCalendarRooms,
  getRecurringRules,
  updateCalendarCourse,
  updateCalendarEvent,
  updateRecurringRule,
  type CalendarCourse,
  type CalendarEvent,
  type CalendarInstructor,
  type CalendarRoom,
  type CoursePayload,
  type EventPayload,
  type RecurringPayload,
  type RecurringRule,
} from './calendarApi'
import { calendarErrorMessage } from './calendarErrors'
import { dateFromKey, dateKey, formatCalendarDate, madridNowParts, startOfMonth, startOfWeek } from './calendarDate'
import type { CalendarNavigationState, CalendarPageState } from './calendarNavigation'
import { RoomManager } from './RoomManager'
import { ScheduleForm, type ScheduleFormTarget } from './ScheduleForm'

type ManagementSection = 'activities' | 'rules' | 'courses' | 'rooms'

const buttonClass = 'min-h-10 rounded-full px-4 text-sm font-bold'
const inputClass = 'min-h-11 w-full rounded-soft border border-line bg-white px-3 text-ink'
const labelClass = 'grid gap-2 text-sm font-bold text-muted'
const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function weekdayLabel(value: number) {
  return weekdays[value - 1] ?? 'Día'
}

function calendarStateForEvent(startAt: string, previous?: CalendarPageState): CalendarPageState {
  const date = dateFromKey(startAt.slice(0, 10))
  return {
    view: 'week',
    weekDate: dateKey(startOfWeek(date)),
    monthDate: dateKey(startOfMonth(date)),
    roomId: previous?.roomId ?? null,
  }
}

export function CalendarManagementPage() {
  const { user } = useAuth()
  const canManage = canManageCalendar(user?.role)
  const navigate = useNavigate()
  const location = useLocation()
  const navigationState = location.state as CalendarNavigationState | null
  const returnTo = navigationState?.returnTo ?? '/calendario'
  const previousCalendarState = navigationState?.calendarState

  const [section, setSection] = useState<ManagementSection>('activities')
  const [formTarget, setFormTarget] = useState<ScheduleFormTarget | null>(() => navigationState?.editEvent
    ? { kind: 'event-edit', event: navigationState.editEvent }
    : null)
  const [courses, setCourses] = useState<CalendarCourse[]>([])
  const [instructors, setInstructors] = useState<CalendarInstructor[]>([])
  const [rooms, setRooms] = useState<CalendarRoom[]>([])
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [loadedMetadataVersion, setLoadedMetadataVersion] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [metadataVersion, setMetadataVersion] = useState(0)
  const [editingCourse, setEditingCourse] = useState<CalendarCourse | null>(null)
  const [courseError, setCourseError] = useState<string | null>(null)
  const [courseSaving, setCourseSaving] = useState(false)
  const loading = loadedMetadataVersion !== metadataVersion

  useEffect(() => {
    let active = true
    if (!canManage) return () => { active = false }
    Promise.all([getCalendarCourses(), getCalendarInstructors(), getCalendarRooms(), getRecurringRules()])
      .then(([loadedCourses, loadedInstructors, loadedRooms, loadedRules]) => {
        if (!active) return
        setCourses(loadedCourses)
        setInstructors(loadedInstructors)
        setRooms(loadedRooms)
        setRules(loadedRules)
        setLoadError(null)
      })
      .catch((error: unknown) => { if (active) setLoadError(calendarErrorMessage(error)) })
      .finally(() => { if (active) setLoadedMetadataVersion(metadataVersion) })
    return () => { active = false }
  }, [canManage, metadataVersion])

  function returnToCalendar(calendarState = previousCalendarState) {
    navigate(returnTo, {
      replace: true,
      state: calendarState ? { calendarState } satisfies CalendarNavigationState : null,
    })
  }

  const [creationCounter, setCreationCounter] = useState(0)

  function createTarget(kind: 'event-create' | 'rule-create', targetSection: ManagementSection = 'activities') {
    setSaveError(null)
    setNotice(null)
    setSection(targetSection)
    setCreationCounter((count) => count + 1)
    setFormTarget({ kind, date: madridNowParts().date })
  }

  async function saveEvent(id: CalendarEvent['id_curso_agendado'] | null, payload: EventPayload) {
    setSaving(true)
    setSaveError(null)
    setNotice(null)
    try {
      if (id === null) {
        await createCalendarEvent(payload)
        returnToCalendar(calendarStateForEvent(payload.startAt, previousCalendarState))
      } else {
        await updateCalendarEvent(id, payload)
        returnToCalendar(previousCalendarState)
      }
    } catch (error) {
      setSaveError(calendarErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function cancelEvent(event: CalendarEvent) {
    if (!window.confirm(`¿Cancelar «${event.curso_nombre}» en ${event.sala_nombre ?? 'sala sin asignar'}? La actividad quedará visible como cancelada.`)) return
    setSaving(true)
    setSaveError(null)
    try {
      await cancelCalendarEvent(event.id_curso_agendado)
      returnToCalendar(previousCalendarState)
    } catch (error) {
      setSaveError(calendarErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function saveRule(id: RecurringRule['id_horario_recurrente'] | null, payload: RecurringPayload) {
    setSaving(true)
    setSaveError(null)
    setNotice(null)
    try {
      if (id === null) {
        await createRecurringRules(payload)
        setNotice('Horario habitual creado.')
      } else {
        await updateRecurringRule(id, payload)
        setNotice('Horario habitual actualizado.')
      }
      setFormTarget(null)
      setSection('rules')
      setMetadataVersion((version) => version + 1)
    } catch (error) {
      setSaveError(calendarErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function cancelRule(rule: RecurringRule) {
    if (!window.confirm(`¿Cancelar el horario semanal de «${rule.curso_nombre}» en ${rule.sala_nombre ?? 'sala sin asignar'}? También se cancelarán sus sesiones futuras.`)) return
    setSaving(true)
    setSaveError(null)
    setNotice(null)
    try {
      await cancelRecurringRule(rule.id_horario_recurrente)
      setNotice('Horario habitual cancelado y sesiones futuras actualizadas.')
      setMetadataVersion((version) => version + 1)
    } catch (error) {
      setSaveError(calendarErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function saveCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const payload: CoursePayload = {
      nombre: String(data.get('nombre')).trim(),
      tema: String(data.get('tema')).trim(),
      descripcion: String(data.get('descripcion') || '').trim() || null,
      tipo_curso: String(data.get('tipo_curso')) as CoursePayload['tipo_curso'],
    }
    setCourseSaving(true)
    setCourseError(null)
    setNotice(null)
    try {
      if (editingCourse) {
        await updateCalendarCourse(editingCourse.id_curso, payload)
        setNotice('Curso actualizado.')
      } else {
        await createCalendarCourse(payload)
        setNotice('Curso creado.')
      }
      form.reset()
      setEditingCourse(null)
      setMetadataVersion((version) => version + 1)
    } catch (error) {
      setCourseError(calendarErrorMessage(error))
    } finally {
      setCourseSaving(false)
    }
  }

  if (!canManage) return <Navigate to="/calendario" replace />

  const activeRules = rules.filter((rule) => rule.activo)
  const ruleFormTarget = formTarget?.kind === 'rule-create' || formTarget?.kind === 'rule-edit' ? formTarget : null
  const sections: Array<{ id: ManagementSection; label: string }> = [
    { id: 'activities', label: 'Actividades' },
    { id: 'rules', label: 'Horarios habituales' },
    { id: 'courses', label: 'Cursos' },
    { id: 'rooms' as const, label: 'Salas' },
  ]

  return (
    <section className="w-full">
      <button className="mb-5 text-sm font-bold text-red-dark underline" type="button" onClick={() => returnToCalendar()}>
        ← Volver al calendario
      </button>
      <p className="mb-2 text-xs font-black tracking-[0.12em] text-red uppercase">Calendario · Gestión</p>
      <h1 className="m-0 text-4xl font-bold tracking-tight text-ink md:text-5xl">Gestionar agenda</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-muted">Administra sesiones, horarios habituales, cursos y salas desde este espacio, separado de la consulta del calendario.</p>

      <nav className="mt-7 flex flex-wrap gap-2" aria-label="Secciones de gestión de agenda">
        {sections.map(({ id, label }) => (
          <button key={id} className={`${buttonClass} ${section === id ? 'bg-red text-white' : 'border border-line bg-paper text-muted'}`} type="button" onClick={() => { setSection(id); setSaveError(null); setNotice(null) }} aria-pressed={section === id}>{label}</button>
        ))}
      </nav>

      {loadError ? (
        <PanelCard className="mt-5 p-5">
          <p className="m-0 text-sm font-bold text-red-dark" role="alert">{loadError}</p>
          <button className={`${buttonClass} mt-3 border border-line text-red-dark`} type="button" onClick={() => setMetadataVersion((version) => version + 1)}>Reintentar</button>
        </PanelCard>
      ) : null}
      {loading ? <p className="mt-5 text-sm text-muted">Cargando opciones de gestión…</p> : null}
      {notice ? <p className="mt-5 rounded-soft bg-green-100 p-3 text-sm font-bold text-green-800" role="status">{notice}</p> : null}
      {saveError ? <p className="mt-5 rounded-soft bg-red/10 p-3 text-sm font-bold text-red-dark" role="alert">{saveError}</p> : null}

      {section === 'activities' ? (
        <div className="mt-5 grid gap-4">
          {!formTarget ? (
            <PanelCard className="p-5 md:p-6">
              <h2 className="m-0 text-xl font-bold text-ink">Programar actividad</h2>
              <p className="mt-1 text-sm text-muted">Crea una sesión puntual o define una clase habitual que se repita por días de la semana.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button className={`${buttonClass} bg-red text-white`} type="button" onClick={() => createTarget('event-create')}>+ Sesión puntual</button>
                <button className={`${buttonClass} border border-red text-red-dark`} type="button" onClick={() => createTarget('rule-create')}>+ Horario habitual</button>
              </div>
            </PanelCard>
          ) : (
            <PanelCard className="p-5 md:p-6">
              <ScheduleForm
                key={`${formTarget.kind}-${formTarget.kind === 'event-edit' ? entityKey(formTarget.event.id_curso_agendado) : formTarget.kind === 'rule-edit' ? entityKey(formTarget.rule.id_horario_recurrente) : `${formTarget.date}-${creationCounter}`}`}
                target={formTarget}
                courses={courses}
                instructors={instructors}
                rooms={rooms}
                saving={saving}
                error={saveError}
                onCancel={() => { setFormTarget(null); setSaveError(null) }}
                onCancelEvent={(event) => void cancelEvent(event)}
                onSubmitEvent={(id, payload) => void saveEvent(id, payload)}
                onSubmitRule={(id, payload) => void saveRule(id, payload)}
              />
            </PanelCard>
          )}
        </div>
      ) : null}

      {section === 'rules' ? (
        <PanelCard className="mt-5 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="m-0 text-xl font-bold text-ink">Horarios habituales</h2>
              <p className="mt-1 text-sm text-muted">Editar una regla actualiza sus sesiones futuras no modificadas. Cancelarla cancela sus sesiones futuras.</p>
            </div>
            <button className={`${buttonClass} bg-red text-white`} type="button" onClick={() => createTarget('rule-create', 'rules')}>+ Nuevo horario</button>
          </div>
          {ruleFormTarget ? (
            <div className="mt-5 border-t border-line pt-5">
              <ScheduleForm
                key={`${ruleFormTarget.kind}-${ruleFormTarget.kind === 'rule-edit' ? entityKey(ruleFormTarget.rule.id_horario_recurrente) : `${ruleFormTarget.date}-${creationCounter}`}`}
                target={ruleFormTarget}
                courses={courses}
                instructors={instructors}
                rooms={rooms}
                saving={saving}
                error={saveError}
                onCancel={() => { setFormTarget(null); setSaveError(null) }}
                onSubmitEvent={(id, payload) => void saveEvent(id, payload)}
                onSubmitRule={(id, payload) => void saveRule(id, payload)}
              />
            </div>
          ) : null}
          {!activeRules.length ? <p className="mt-5 text-sm text-muted">No hay horarios habituales activos.</p> : (
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {activeRules.map((rule) => (
                <li key={entityKey(rule.id_horario_recurrente)} className="rounded-soft border border-line bg-white/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong className="block text-sm text-ink">{rule.curso_nombre}</strong>
                      <span className="mt-1 block text-xs text-muted">{weekdayLabel(rule.dia_semana)} · {rule.hora_inicio.slice(0, 5)}–{rule.hora_fin.slice(0, 5)}</span>
                      <span className="mt-1 block text-xs text-muted">{rule.sala_nombre ?? 'Sala sin asignar'} · {rule.instructor_nombre}</span>
                      <span className="mt-1 block text-xs text-muted">Desde {formatCalendarDate(rule.fecha_inicio)}{rule.fecha_fin ? ` hasta ${formatCalendarDate(rule.fecha_fin)}` : ' · sin fecha final'}</span>
                    </div>
                    <div className="flex gap-3">
                      <button className="text-sm font-bold text-red-dark underline" type="button" onClick={() => { setSaveError(null); setNotice(null); setFormTarget({ kind: 'rule-edit', rule }) }}>Editar</button>
                      <button className="text-sm font-bold text-red-dark underline" type="button" onClick={() => void cancelRule(rule)}>Cancelar regla</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      ) : null}

      {section === 'courses' ? (
        <PanelCard className="mt-5 p-5 md:p-6">
          <h2 className="m-0 text-xl font-bold text-ink">Cursos</h2>
          <p className="mt-1 text-sm text-muted">Los horarios habituales requieren un curso de tipo habitual; los cursos especiales se programan como sesiones puntuales.</p>
          <ul className="mt-5 grid gap-2 md:grid-cols-2">
            {courses.map((course) => (
              <li key={entityKey(course.id_curso)} className="flex items-center justify-between gap-3 rounded-soft border border-line bg-white/60 px-3 py-2">
                <span className="min-w-0"><strong className="block truncate text-sm text-ink">{course.nombre}</strong><span className="text-xs text-muted">{course.tipo_curso === 'HABITUAL' ? 'Habitual' : 'Especial'} · {course.tema}</span></span>
                <button className="shrink-0 text-sm font-bold text-red-dark underline" type="button" onClick={() => { setEditingCourse(course); setCourseError(null); setNotice(null) }}>Editar</button>
              </li>
            ))}
          </ul>
          <form className="mt-5 grid gap-4 border-t border-line pt-5 md:grid-cols-2 xl:grid-cols-4" key={editingCourse ? entityKey(editingCourse.id_curso) : 'new-course'} onSubmit={saveCourse}>
            <h3 className="m-0 text-base font-bold text-ink md:col-span-2 xl:col-span-4">{editingCourse ? `Editar ${editingCourse.nombre}` : 'Añadir curso'}</h3>
            <label className={labelClass}>Nombre<input className={inputClass} name="nombre" defaultValue={editingCourse?.nombre ?? ''} maxLength={100} required /></label>
            <label className={labelClass}>Tema<input className={inputClass} name="tema" defaultValue={editingCourse?.tema ?? ''} maxLength={120} required /></label>
            <label className={labelClass}>Tipo<SelectField name="tipo_curso" defaultValue={editingCourse?.tipo_curso ?? 'HABITUAL'}><option value="HABITUAL">Habitual</option><option value="CURSO_ESPECIAL">Curso especial</option></SelectField></label>
            <label className={labelClass}>Descripción<input className={inputClass} name="descripcion" defaultValue={editingCourse?.descripcion ?? ''} maxLength={255} /></label>
            {courseError ? <p className="m-0 text-sm font-bold text-red-dark md:col-span-2 xl:col-span-4" role="alert">{courseError}</p> : null}
            <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-4">
              <button className={`${buttonClass} bg-red text-white disabled:opacity-50`} type="submit" disabled={courseSaving}>{courseSaving ? 'Guardando…' : editingCourse ? 'Guardar curso' : 'Crear curso'}</button>
              {editingCourse ? <button className={`${buttonClass} border border-line text-muted`} type="button" onClick={() => { setEditingCourse(null); setCourseError(null) }}>Dejar de editar</button> : null}
            </div>
          </form>
        </PanelCard>
      ) : null}

      {section === 'rooms' ? (
        <PanelCard className="mt-5 p-5 md:p-6">
          <h2 className="m-0 text-xl font-bold text-ink">Salas</h2>
          <p className="mt-1 text-sm text-muted">Las salas con actividades futuras deben vaciarse antes de desactivarlas.</p>
          <div className="mt-5"><RoomManager rooms={rooms} onChanged={() => setMetadataVersion((version) => version + 1)} /></div>
        </PanelCard>
      ) : null}
    </section>
  )
}
