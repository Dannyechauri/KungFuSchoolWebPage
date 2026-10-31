import { useEffect, useState, type FormEvent } from 'react'
import { useOutletContext } from 'react-router'
import { apiRequest } from '../api/client'
import { PanelCard } from '../components/PanelCard'
import { useAuth } from '../features/auth/useAuth'

type FormOption = { id: number; name: string; style: string; known: boolean; inCurrentGrade: boolean; optional: boolean }
type ConfirmerOption = { id: number; name: string; role: 'ALUMNO' | 'INSTRUCTOR' }
type Confirmation = { studentId: number; name: string; status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'NOT_REQUIRED' }
type PerformanceRecord = {
  id: number
  studentId: number
  studentName: string
  date: string
  approvedAt: string | null
  rejectedAt: string | null
  resolvedByAdmin: boolean
  physicalWork: boolean
  cardioWork: boolean
  stretching: boolean
  attendedClass: boolean
  forms: FormOption[]
  confirmations: Confirmation[]
}
type ConfirmationRequest = {
  id: number
  studentName: string
  date: string
  physicalWork: boolean
  cardioWork: boolean
  stretching: boolean
  attendedClass: boolean
  forms: string[]
}
type RankingEntry = { rank: number; studentId: number; name: string; points: number }
type PerformanceRankings = {
  month: string
  attendance: RankingEntry[]
  stretching: RankingEntry[]
  strength: RankingEntry[]
  cardio: RankingEntry[]
  forms: RankingEntry[]
  overall: RankingEntry[]
}

type RankingCategoryKey = Exclude<keyof PerformanceRankings, 'month'>

const rankingCategories: { key: RankingCategoryKey; label: string }[] = [
  { key: 'overall', label: 'Absoluto' },
  { key: 'attendance', label: 'Asistencia' },
  { key: 'stretching', label: 'Estiramiento' },
  { key: 'strength', label: 'Entrenamiento de fuerza' },
  { key: 'cardio', label: 'Cardio' },
  { key: 'forms', label: 'Cantidad de formas' },
]

const dateFormatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

function localDateValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return dateFormatter.format(new Date(year!, month! - 1, day!))
}

function formatMonth(value: string) {
  const [year, month] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(year!, month! - 1, 1))
}

function recordStatus(approvedAt: string | null, rejectedAt: string | null, confirmations: Confirmation[], resolvedByAdmin: boolean) {
  if (resolvedByAdmin && rejectedAt) return 'Rechazado por el administrador'
  if (resolvedByAdmin && approvedAt) return 'Aprobado por el administrador'
  if (rejectedAt) return 'Rechazado'
  if (approvedAt) return 'Aprobado · 2 confirmaciones'
  const confirmed = confirmations.filter(({ status }) => status === 'CONFIRMED').length
  const pending = confirmations.some(({ status }) => status === 'PENDING')
  if (pending) return `Pendiente · ${confirmed}/2 confirmaciones`
  return `Sin aprobar · ${confirmed}/2 confirmaciones`
}

export function PerformancePage() {
  const { user } = useAuth()
  const onPendingConfirmationsChange = useOutletContext<{ onPendingConfirmationsChange: (count: number) => void } | undefined>()?.onPendingConfirmationsChange
  const isAdmin = user?.role === 'ADMIN'
  const canRegister = user?.role === 'USER' || user?.role === 'INSTRUCTOR'
  const [expandedRankings, setExpandedRankings] = useState<RankingCategoryKey[]>([])
  const [records, setRecords] = useState<PerformanceRecord[]>([])
  const [rankings, setRankings] = useState<PerformanceRankings | null>(null)
  const [forms, setForms] = useState<FormOption[]>([])
  const [confirmers, setConfirmers] = useState<ConfirmerOption[]>([])
  const [formSearch, setFormSearch] = useState('')
  const [formMenuOpen, setFormMenuOpen] = useState(false)
  const [selectedConfirmers, setSelectedConfirmers] = useState<ConfirmerOption[]>([])
  const [confirmerSearch, setConfirmerSearch] = useState('')
  const [confirmerMenuOpen, setConfirmerMenuOpen] = useState(false)
  const [inbox, setInbox] = useState<ConfirmationRequest[]>([])
  const [date, setDate] = useState(localDateValue)
  const [physicalWork, setPhysicalWork] = useState(false)
  const [cardioWork, setCardioWork] = useState(false)
  const [stretching, setStretching] = useState(false)
  const [attendedClass, setAttendedClass] = useState(false)
  const [selectedForms, setSelectedForms] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyConfirmation, setBusyConfirmation] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest<PerformanceRecord[]>('/api/performance/records'),
      apiRequest<PerformanceRankings>('/api/performance/rankings'),
      apiRequest<FormOption[]>('/api/performance/forms'),
      canRegister ? apiRequest<ConfirmerOption[]>('/api/performance/confirmers') : Promise.resolve([]),
      canRegister || isAdmin ? apiRequest<ConfirmationRequest[]>('/api/performance/confirmations/pending') : Promise.resolve([]),
    ])
      .then(([loadedRecords, loadedRankings, loadedForms, loadedConfirmers, loadedInbox]) => {
        if (!active) return
        setRecords(loadedRecords)
        setRankings(loadedRankings)
        setForms(loadedForms)
        setConfirmers(loadedConfirmers)
        setInbox(loadedInbox)
        if (canRegister) onPendingConfirmationsChange?.(loadedInbox.length)
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el desempeño.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [canRegister, isAdmin, reloadKey, onPendingConfirmationsChange])

  function addConfirmer(person: ConfirmerOption) {
    if (selectedConfirmers.length >= 100 || selectedConfirmers.some(({ id }) => id === person.id)) return
    setSelectedConfirmers([...selectedConfirmers, person])
    setConfirmerSearch('')
    setConfirmerMenuOpen(false)
  }

  function removeConfirmer(personId: number) {
    setSelectedConfirmers(selectedConfirmers.filter(({ id }) => id !== personId))
  }

  function populateRecordForDate(nextDate: string) {
    setDate(nextDate)
    const existing = records.find((record) => record.date === nextDate && record.studentId === user?.studentId)
    setPhysicalWork(existing?.physicalWork ?? false)
    setCardioWork(existing?.cardioWork ?? false)
    setStretching(existing?.stretching ?? false)
    setAttendedClass(existing?.attendedClass ?? false)
    setSelectedForms(existing?.forms.map(({ id }) => id) ?? [])
    setSelectedConfirmers(existing?.confirmations
      .map(({ studentId }) => confirmers.find(({ id }) => id === studentId))
      .filter((person): person is ConfirmerOption => person !== undefined) ?? [])
  }

  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await apiRequest('/api/performance/records', {
        method: 'POST',
        body: JSON.stringify({
          date,
          physicalWork,
          stretching,
          cardioWork,
          attendedClass,
          formIds: selectedForms,
          confirmerIds: selectedConfirmers.map(({ id }) => id),
        }),
      })
      setNotice('Desempeño de esta fecha reemplazado. Las personas seleccionadas recibirán una solicitud de confirmación.')
      setPhysicalWork(false)
      setCardioWork(false)
      setStretching(false)
      setAttendedClass(false)
      setSelectedForms([])
      setSelectedConfirmers([])
      setFormSearch('')
      setConfirmerSearch('')
      setReloadKey((key) => key + 1)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el desempeño.')
    } finally {
      setSaving(false)
    }
  }

  async function respondToConfirmation(id: number, decision: 'CONFIRMED' | 'REJECTED') {
    setBusyConfirmation(id)
    setError(null)
    setNotice(null)
    try {
      await apiRequest(`/api/performance/confirmations/${id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      })
      setNotice(isAdmin
        ? decision === 'CONFIRMED' ? 'Aprobado por el administrador.' : 'Rechazado por el administrador.'
        : decision === 'CONFIRMED' ? 'Confirmación registrada.' : 'Has indicado que no puedes confirmar esta actividad.')
      setReloadKey((key) => key + 1)
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : 'No se pudo responder a la solicitud.')
    } finally {
      setBusyConfirmation(null)
    }
  }

  function toggleSelection(id: number, selected: number[], setSelected: (next: number[]) => void, limit?: number) {
    if (selected.includes(id)) {
      setSelected(selected.filter((item) => item !== id))
    } else if (limit === undefined || selected.length < limit) {
      setSelected([...selected, id])
    }
  }

  const gradeForms = forms.filter((form) => form.inCurrentGrade)
  const knownFormsOutsideGrade = forms.filter((form) => form.known && !form.inCurrentGrade)
  const formQuery = formSearch.trim().toLocaleLowerCase('es')
  const visibleForms = forms.filter((form) =>
    !formQuery || `${form.name} ${form.style}`.toLocaleLowerCase('es').includes(formQuery),
  )
  const activeConfirmerQuery = confirmerSearch.trim()
  const confirmerQuery = activeConfirmerQuery.toLocaleLowerCase('es')
  const visibleConfirmers = confirmers.filter((person) =>
    !selectedConfirmers.some(({ id }) => id === person.id)
    && (!confirmerQuery || person.name.toLocaleLowerCase('es').includes(confirmerQuery)),
  )
  const selectedFormOptions = forms.filter((form) => selectedForms.includes(form.id))

  function renderSuggestedForm(form: FormOption) {
    const status = form.known ? 'Ya sabida' : form.optional ? 'Optativa' : 'De tu grado'
    return (
      <label key={form.id} className="flex min-h-11 items-center gap-3 rounded-soft border border-line bg-white px-3 py-2 text-sm text-ink">
        <input className="size-4 accent-red" type="checkbox" checked={selectedForms.includes(form.id)} onChange={() => toggleSelection(form.id, selectedForms, setSelectedForms)} />
        <span className="min-w-0 flex-1">{form.name} <span className="text-muted">· {form.style}</span></span>
        <span className="shrink-0 text-xs font-bold text-red-dark">{status}</span>
      </label>
    )
  }

  return (
    <section className="max-w-6xl">
      <p className="mb-2 text-xs font-black tracking-[0.12em] text-red uppercase">Entrenamiento</p>
      <h1 className="m-0 text-4xl font-bold text-ink md:text-5xl">Mi desempeño</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
        Registra tu práctica diaria y pide a dos o más personas que confirmen la sesión.
      </p>

      {notice ? <p className="mt-5 rounded-soft bg-gold/30 px-4 py-3 text-sm font-bold text-ink" role="status">{notice}</p> : null}
      {error ? <p className="mt-5 rounded-soft bg-red/10 px-4 py-3 text-sm font-bold text-red-dark" role="alert">{error}</p> : null}

      <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.85fr)]">
      <aside className="order-1 min-w-0 xl:sticky xl:top-6 xl:order-2 xl:max-h-[calc(100vh-3rem)]">
        <PanelCard className="max-h-[70vh] overflow-y-auto p-5 xl:max-h-[calc(100vh-3rem)]">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="m-0 text-xl font-bold text-ink">Ranking mensual</h2>
              {rankings ? <p className="m-0 mt-1 text-sm capitalize text-muted">{formatMonth(rankings.month)}</p> : null}
            </div>
            <span className="text-xs font-bold text-muted">{isAdmin ? 'Top 3' : 'Top 3 + tu puesto'}</span>
          </div>
          {loading && !rankings ? <p className="mt-4 text-sm text-muted">Calculando puntos…</p> : rankings ? (
            <div className="mt-3">
              {rankingCategories.map(({ key, label }) => (
                <section key={key} className="border-t border-line py-3 first:border-t-0">
                  <h3 className="m-0 text-sm font-bold text-ink">{label}</h3>
                  <ol id={`ranking-${key}`} className="mt-2 grid gap-1">
                    {(isAdmin && !expandedRankings.includes(key) ? rankings[key].slice(0, 3) : rankings[key]).map((entry) => {
                      const isCurrent = entry.studentId === user?.studentId
                      return (
                        <li key={entry.studentId} className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-soft px-2 py-1.5 text-sm ${isCurrent ? 'bg-gold/30 font-bold text-ink' : 'text-muted'}`}>
                          <span className="tabular-nums">{entry.rank}.</span>
                          <span className="truncate">{entry.name}{isCurrent ? ' · Tú' : ''}</span>
                          <span className="tabular-nums">{entry.points} pt</span>
                        </li>
                      )
                    })}
                  </ol>
                  {isAdmin && rankings[key].length > 3 ? (
                    <button className="mt-2 min-h-10 text-sm font-bold text-red-dark" type="button" aria-expanded={expandedRankings.includes(key)} aria-controls={`ranking-${key}`} onClick={() => setExpandedRankings((current) => current.includes(key) ? current.filter((category) => category !== key) : [...current, key])}>
                      {expandedRankings.includes(key) ? 'Ver menos' : `Ver todos (${rankings[key].length})`}
                    </button>
                  ) : null}
                </section>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-muted">No se pudo cargar el ranking.</p>}
        </PanelCard>
      </aside>

      <div className="order-2 min-w-0 xl:order-1">
      {canRegister ? (
        <PanelCard className="p-5 md:p-7">
          <h2 className="m-0 text-xl font-bold text-ink">Registrar sesión</h2>
          <form className="mt-5 grid gap-5" onSubmit={(event) => void submitRecord(event)}>
            <label className="grid max-w-xs gap-1.5 text-sm font-bold text-ink">
              Fecha
              <input className="min-h-11 rounded-soft border border-line bg-white px-3" type="date" required value={date} onChange={(event) => populateRecordForDate(event.target.value)} />
            </label>
            <p className="-mt-3 text-sm text-muted">Si ya registraste esa fecha, al guardar se reemplazarán sus casillas, formas y confirmantes.</p>

            <fieldset className="grid gap-2 border-0 p-0 sm:grid-cols-2 lg:grid-cols-4">
              <legend className="mb-2 text-sm font-bold text-ink">Actividad realizada</legend>
              {[
                ['Trabajo físico', physicalWork, setPhysicalWork],
                ['Trabajo cardiovascular', cardioWork, setCardioWork],
                ['Estiramiento', stretching, setStretching],
                ['Asistí a clase', attendedClass, setAttendedClass],
              ].map(([label, checked, setChecked]) => (
                <label key={label as string} className="flex min-h-12 items-center gap-3 rounded-soft border border-line bg-white px-3 py-2 text-sm font-bold text-ink">
                  <input className="size-4 accent-red" type="checkbox" checked={checked as boolean} onChange={(event) => (setChecked as (value: boolean) => void)(event.target.checked)} />
                  {label as string}
                </label>
              ))}
            </fieldset>

            <fieldset className="grid gap-3 border-0 p-0">
              <legend className="text-sm font-bold text-ink">Formas practicadas</legend>
              {gradeForms.length ? (
                <div>
                  <h3 className="mb-2 text-xs font-black uppercase text-muted">Formas de tu grado</h3>
                  <div className="grid gap-2 sm:grid-cols-2">{gradeForms.map(renderSuggestedForm)}</div>
                </div>
              ) : null}
              {knownFormsOutsideGrade.length ? (
                <div>
                  <h3 className="mb-2 text-xs font-black uppercase text-muted">Formas que ya sabes</h3>
                  <div className="grid gap-2 sm:grid-cols-2">{knownFormsOutsideGrade.map(renderSuggestedForm)}</div>
                </div>
              ) : null}
              {!forms.length ? <p className="m-0 text-sm text-muted">No hay formas asignadas ni sabidas para mostrar.</p> : null}

              <div className="border-t border-line pt-4">
                <label className="grid max-w-xl gap-1.5 text-sm font-bold text-ink">
                  Buscar forma
                  <input
                    className="min-h-11 rounded-soft border border-line bg-white px-3 font-normal"
                    type="search"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={formMenuOpen}
                    aria-controls="form-options"
                    autoComplete="off"
                    value={formSearch}
                    placeholder="Escribe para filtrar todas las formas"
                    onFocus={() => setFormMenuOpen(true)}
                    onBlur={() => window.setTimeout(() => setFormMenuOpen(false), 100)}
                    onKeyDown={(event) => { if (event.key === 'Escape') setFormMenuOpen(false) }}
                    onChange={(event) => setFormSearch(event.target.value)}
                  />
                </label>
                {formMenuOpen ? (
                  <ul id="form-options" className="mt-1 max-h-60 max-w-xl overflow-y-auto rounded-soft border border-line bg-white p-1" role="listbox" aria-label="Todas las formas">
                    {visibleForms.map((form) => (
                      <li key={form.id} role="option" aria-selected={selectedForms.includes(form.id)}>
                        <button
                          className="flex min-h-11 w-full items-center gap-3 rounded-soft px-3 py-2 text-left text-sm text-ink hover:bg-canvas"
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => toggleSelection(form.id, selectedForms, setSelectedForms)}
                        >
                          <input className="size-4 accent-red" type="checkbox" tabIndex={-1} checked={selectedForms.includes(form.id)} readOnly />
                          <span className="min-w-0 flex-1">{form.name} <span className="text-muted">· {form.style}</span></span>
                          <span className="shrink-0 text-xs font-bold text-red-dark">{form.known ? 'Ya sabida' : form.inCurrentGrade ? (form.optional ? 'Optativa' : 'De tu grado') : ''}</span>
                        </button>
                      </li>
                    ))}
                    {!visibleForms.length ? <li className="px-3 py-2 text-sm text-muted">No hay formas que coincidan.</li> : null}
                  </ul>
                ) : null}
                {selectedFormOptions.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label="Formas seleccionadas">
                    {selectedFormOptions.map((form) => (
                      <li key={form.id}>
                        <button className="rounded-soft bg-gold/30 px-3 py-2 text-sm font-bold text-ink" type="button" onClick={() => toggleSelection(form.id, selectedForms, setSelectedForms)} aria-label={`Quitar ${form.name}`}>{form.name} · Quitar</button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </fieldset>

            <fieldset className="grid gap-3 border-0 p-0">
              <legend className="text-sm font-bold text-ink">Testigos seleccionados · {selectedConfirmers.length} (mínimo 2)</legend>
              <p className="m-0 text-sm text-muted">Con dos confirmaciones se aprueba el registro. Los testigos restantes ya no necesitan responder.</p>
              <label className="grid max-w-xl gap-1.5 text-sm font-bold text-ink">
                Buscar compañero o instructor
                <input
                  className="min-h-11 rounded-soft border border-line bg-white px-3 font-normal"
                  type="search"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={confirmerMenuOpen}
                  aria-controls="confirmer-options"
                  autoComplete="off"
                  value={confirmerSearch}
                  placeholder="Escribe para filtrar personas"
                  onFocus={() => setConfirmerMenuOpen(true)}
                  onBlur={() => window.setTimeout(() => setConfirmerMenuOpen(false), 100)}
                  onKeyDown={(event) => { if (event.key === 'Escape') setConfirmerMenuOpen(false) }}
                  onChange={(event) => setConfirmerSearch(event.target.value)}
                />
              </label>
              {confirmerMenuOpen ? (
                <ul id="confirmer-options" className="max-h-60 max-w-xl overflow-y-auto rounded-soft border border-line bg-white p-1" role="listbox" aria-label="Todas las personas">
                  {visibleConfirmers.map((person) => (
                    <li key={person.id}>
                      <button className="flex min-h-11 w-full items-center justify-between gap-3 rounded-soft px-3 py-2 text-left text-sm text-ink hover:bg-canvas" type="button" role="option" aria-selected={false} onMouseDown={(event) => event.preventDefault()} onClick={() => addConfirmer(person)}>
                        <span>{person.name}</span>
                        <span className="text-xs font-bold text-muted">{person.role === 'INSTRUCTOR' ? 'Instructor' : 'Alumno'}</span>
                      </button>
                    </li>
                  ))}
                  {!visibleConfirmers.length ? <li className="px-3 py-2 text-sm text-muted">No hay coincidencias disponibles.</li> : null}
                </ul>
              ) : null}
              {selectedConfirmers.length ? (
                <ul className="flex flex-wrap gap-2" aria-label="Testigos seleccionados">
                  {selectedConfirmers.map((person) => (
                    <li key={person.id}>
                      <button className="rounded-soft bg-gold/30 px-3 py-2 text-sm font-bold text-ink" type="button" onClick={() => removeConfirmer(person.id)} aria-label={`Quitar a ${person.name}`}>{person.name} · Quitar</button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </fieldset>

            <div>
              <button className="min-h-11 rounded-soft bg-red px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={saving || selectedConfirmers.length < 2}>
                {saving ? 'Guardando…' : 'Guardar desempeño'}
              </button>
            </div>
          </form>
        </PanelCard>
      ) : null}

      {(canRegister || isAdmin) && inbox.length ? (
        <section className="mt-9" aria-labelledby="confirmations-heading">
          <h2 className="m-0 text-xl font-bold text-ink" id="confirmations-heading">Por confirmar <span className="text-muted">({inbox.length})</span></h2>
          <div className="mt-4 grid gap-3">
            {inbox.map((request) => (
              <PanelCard key={request.id} className="p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="m-0 text-base font-bold text-ink">{request.studentName} · {formatDate(request.date)}</h3>
                  {request.attendedClass ? <span className="text-xs font-bold text-red-dark">Asistió a clase</span> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink">
                  {request.physicalWork ? <span>Trabajo físico</span> : null}
                  {request.cardioWork ? <span>Trabajo cardiovascular</span> : null}
                  {request.stretching ? <span>Estiramiento</span> : null}
                </div>
                {request.forms.length ? <p className="mt-2 text-sm text-muted">Formas: {request.forms.join(', ')}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="min-h-10 rounded-soft bg-ink px-4 text-sm font-bold text-white disabled:opacity-50" type="button" disabled={busyConfirmation === request.id} onClick={() => void respondToConfirmation(request.id, 'CONFIRMED')}>{isAdmin ? 'Aprobar' : 'Confirmar'}</button>
                  <button className="min-h-10 rounded-soft border border-line px-4 text-sm font-bold text-ink disabled:opacity-50" type="button" disabled={busyConfirmation === request.id} onClick={() => void respondToConfirmation(request.id, 'REJECTED')}>Rechazar</button>
                </div>
              </PanelCard>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-9" aria-labelledby="history-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="m-0 text-xl font-bold text-ink" id="history-heading">{user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR' ? 'Desempeño registrado' : 'Mi historial'}</h2>
          <span className="text-sm text-muted">Últimos 100 registros</span>
        </div>
        {loading ? <p className="mt-4 text-sm text-muted">Cargando desempeño…</p> : records.length === 0 ? (
          <p className="mt-4 border-t border-line py-5 text-sm text-muted">Todavía no hay registros de desempeño.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {records.map((record) => (
              <PanelCard key={record.id} className="p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="m-0 text-base font-bold text-ink">
                    {user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR' ? `${record.studentName} · ` : ''}{formatDate(record.date)}
                  </h3>
                  <span className="text-xs font-bold text-red-dark">{recordStatus(record.approvedAt, record.rejectedAt, record.confirmations, record.resolvedByAdmin)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                  {record.physicalWork ? <span>Trabajo físico</span> : null}
                  {record.cardioWork ? <span>Trabajo cardiovascular</span> : null}
                  {record.stretching ? <span>Estiramiento</span> : null}
                  {record.attendedClass ? <span>Asistencia a clase</span> : null}
                  {record.forms.length ? <span>Formas: {record.forms.map((form) => form.name).join(', ')}</span> : null}
                </div>
                <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-xs text-muted">
                  {record.confirmations.map((confirmation) => (
                    <li key={confirmation.studentId}>
                      {confirmation.name}: {confirmation.status === 'CONFIRMED' ? 'confirmado' : confirmation.status === 'REJECTED' ? 'rechazado' : confirmation.status === 'NOT_REQUIRED' ? 'no requerido' : 'pendiente'}
                    </li>
                  ))}
                </ul>
              </PanelCard>
            ))}
          </div>
        )}
      </section>
      </div>
      </div>
    </section>
  )
}