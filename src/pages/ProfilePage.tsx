import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router'
import { apiRequest } from '../api/client'
import { BirthdayPanel } from '../components/BirthdayPanel'
import { PanelCard } from '../components/PanelCard'

type Profile = {
  student: {
    id: number
    name: string
    enrollmentNumber: string
    email: string | null
    birthDate: string | null
    joinedOn: string
    active: boolean
    isInstructor: boolean
  }
  grade: { id: number; name: string; beltColor: string; order: number; requiredForms: number }
  knownForms: { id: number; name: string; description: string | null; style: string; learnedOn: string }[]
  gradeForms: GradeForm[]
  instructor: { id: number; specialty: string | null; hiredOn: string | null; active: boolean; styles: string[] } | null
}

type GradeForm = {
  id: number
  name: string
  description: string | null
  style: string
  optional: boolean
  known: boolean
  learning: { percent: number; updatedOn: string } | null
}

type ProfileForm = Omit<GradeForm, 'optional'> & {
  optional: boolean | null
  learnedOn: string | null
}

type PromotionNotification = {
  id_aviso: string
  grado_anterior: string
  grado_nuevo: string
}

const dateFormatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

function formatDate(value: string | null) {
  if (!value) return 'Sin indicar'
  const [year, month, day] = value.split('-').map(Number)
  return dateFormatter.format(new Date(year!, month! - 1, day!))
}

function DataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-black tracking-[0.08em] text-muted uppercase">{label}</dt>
      <dd className="m-0 mt-1 text-base font-bold text-ink">{value}</dd>
    </div>
  )
}

function GradeFormItem({ form, onChanged }: { form: ProfileForm; onChanged: (message: string) => void }) {
  const [percent, setPercent] = useState(form.learning?.percent ?? 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(request: () => Promise<unknown>, message: string) {
    setSaving(true)
    setError(null)
    try {
      await request()
      onChanged(message)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo guardar el avance.')
    } finally {
      setSaving(false)
    }
  }

  const saveProgress = (value: number) => run(
    () => apiRequest(`/api/me/forms/${form.id}/progress`, { method: 'PUT', body: JSON.stringify({ percent: value }) }),
    `Avance de ${form.name} guardado: ${value}%.`,
  )
  const stopLearning = () => run(
    () => apiRequest(`/api/me/forms/${form.id}/progress`, { method: 'DELETE' }),
    `Has dejado de marcar ${form.name} como en aprendizaje.`,
  )

  const status = form.known ? 'Sabida' : form.learning ? `Aprendiendo · ${form.learning.percent}%` : 'Pendiente'
  const statusClass = form.known ? 'bg-gold text-ink' : form.learning ? 'bg-red/10 text-red-dark' : 'border border-line text-muted'

  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <strong className="block text-base text-ink">{form.name}</strong>
          {form.optional ? <span className="mt-1 inline-block rounded-full border border-line px-2 py-0.5 text-xs font-bold text-muted">Opcional</span> : null}
          {form.description ? <span className="mt-1 block text-sm text-muted">{form.description}</span> : null}
        </div>
        <div className="grid justify-items-end gap-1">
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}>{status}</span>
          {form.known && form.learnedOn ? <time className="text-right text-xs font-bold text-muted" dateTime={form.learnedOn}>Aprendida el {formatDate(form.learnedOn)}</time> : null}
        </div>
      </div>

      {form.known ? null : form.learning ? (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={`Avance en ${form.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={form.learning.percent}>
            <div className="h-full bg-red" style={{ width: `${form.learning.percent}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-bold text-ink">
              Avance
              <input
                aria-label={`Porcentaje de avance en ${form.name}`}
                className="w-40 accent-red"
                type="range"
                min={0}
                max={100}
                step={5}
                value={percent}
                disabled={saving}
                onChange={(event) => setPercent(Number(event.target.value))}
              />
              <span className="w-10 text-right tabular-nums">{percent}%</span>
            </label>
            <button className="rounded-soft bg-ink px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50" type="button" disabled={saving || percent === form.learning.percent} onClick={() => void saveProgress(percent)}>
              Guardar avance
            </button>
            <button className="text-sm font-bold text-muted underline disabled:opacity-50" type="button" disabled={saving} onClick={() => void stopLearning()}>
              Dejar de aprender
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">Actualizado el {formatDate(form.learning.updatedOn)}. Cuando la domines, la administración la registrará como sabida.</p>
        </div>
      ) : (
        <button className="mt-3 rounded-soft border border-line px-3 py-1.5 text-sm font-bold text-ink disabled:opacity-50" type="button" disabled={saving} onClick={() => void saveProgress(0)}>
          Marcar como aprendiendo
        </button>
      )}
      {error ? <p className="mt-2 text-sm font-bold text-red-dark" role="alert">{error}</p> : null}
    </li>
  )
}

function StyleFormGroup({ style, forms, onChanged }: { style: string; forms: ProfileForm[]; onChanged: (message: string) => void }) {
  return (
    <div className="mt-5">
      <h3 className="m-0 text-sm font-black tracking-[0.08em] text-red-dark uppercase">{style}</h3>
      <ul className="mt-1 grid divide-y divide-line">
        {forms.map((form) => <GradeFormItem key={`${form.id}-${form.learning?.percent ?? 'none'}`} form={form} onChanged={onChanged} />)}
      </ul>
    </div>
  )
}

export function ProfilePage() {
  const onPromotionNotificationsChange = useOutletContext<{ onPendingPromotionNoticesChange: (count: number) => void } | undefined>()?.onPendingPromotionNoticesChange
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [promotionNotifications, setPromotionNotifications] = useState<PromotionNotification[]>([])
  const [promotionError, setPromotionError] = useState<string | null>(null)
  const [acknowledgingPromotionId, setAcknowledgingPromotionId] = useState<string | null>(null)
  const handleFormChanged = (message: string) => { setNotice(message); setReloadKey((key) => key + 1) }

  useEffect(() => {
    let active = true
    apiRequest<PromotionNotification[]>('/api/me/promotions')
      .then((loaded) => {
        if (!active) return
        setPromotionNotifications(loaded)
        onPromotionNotificationsChange?.(loaded.length)
        setPromotionError(null)
      })
      .catch((error: unknown) => {
        if (active) setPromotionError(error instanceof Error ? error.message : 'No se pudieron cargar las felicitaciones pendientes.')
      })
    return () => { active = false }
  }, [onPromotionNotificationsChange])

  useEffect(() => {
    let active = true
    apiRequest<Profile>('/api/me/profile')
      .then((loaded) => { if (active) { setProfile(loaded); setLoadError(null) } })
      .catch((error: unknown) => { if (active) setLoadError(error instanceof Error ? error.message : 'No se pudo cargar tu ficha.') })
    return () => { active = false }
  }, [reloadKey])

  const formsByStyle = useMemo(() => {
    const learnedDates = new Map((profile?.knownForms ?? []).map((form) => [form.id, form.learnedOn]))
    const formsById = new Map<number, ProfileForm>()
    for (const form of profile?.knownForms ?? []) {
      formsById.set(form.id, { ...form, optional: null, known: true, learning: null })
    }
    for (const form of profile?.gradeForms ?? []) {
      formsById.set(form.id, { ...form, learnedOn: learnedDates.get(form.id) ?? null })
    }

    const groups = new Map<string, ProfileForm[]>()
    for (const form of formsById.values()) groups.set(form.style, [...(groups.get(form.style) ?? []), form])
    return [...groups.entries()]
  }, [profile])

  if (loadError) {
    return (
      <section className="max-w-6xl">
        <h1 className="m-0 text-4xl font-bold tracking-tight text-ink">Mi ficha</h1>
        <div className="mt-8 rounded-soft bg-red/10 p-4" role="alert">
          <p className="m-0 text-sm font-bold text-red-dark">{loadError}</p>
          <button className="mt-2 text-sm font-bold underline" type="button" onClick={() => { setLoadError(null); setReloadKey((key) => key + 1) }}>Reintentar</button>
        </div>
      </section>
    )
  }

  if (!profile) return <p className="text-muted">Cargando tu ficha…</p>

  const { student, grade, gradeForms, instructor } = profile
  const requiredGradeForms = gradeForms.filter((form) => !form.optional)
  const knownRequired = requiredGradeForms.filter((form) => form.known).length

  async function acknowledgePromotion(notification: PromotionNotification) {
    setAcknowledgingPromotionId(notification.id_aviso)
    try {
      await apiRequest(`/api/me/promotions/${notification.id_aviso}/acknowledge`, { method: 'POST' })
      const remaining = promotionNotifications.filter((item) => item.id_aviso !== notification.id_aviso)
      setPromotionNotifications(remaining)
      onPromotionNotificationsChange?.(remaining.length)
      setPromotionError(null)
    } catch (error: unknown) {
      setPromotionError(error instanceof Error ? error.message : 'No se pudo confirmar la recepción.')
    } finally {
      setAcknowledgingPromotionId(null)
    }
  }

  return (
    <section className="max-w-6xl">
      {promotionNotifications[0] ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-ink/75 p-4" role="presentation">
          <div className="w-full max-w-xl" role="dialog" aria-modal="true" aria-labelledby="promotion-title">
            <PanelCard className="border-t-4 border-gold p-6 shadow-2xl md:p-8">
              <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-red-dark">Nuevo grado</p>
              <h2 id="promotion-title" className="mt-3 text-3xl font-bold text-ink">¡Felicidades, {student.name}!</h2>
              <p className="mt-4 text-base leading-7 text-muted">
                Has ascendido de <strong className="text-ink">{promotionNotifications[0].grado_anterior}</strong> a <strong className="text-ink">{promotionNotifications[0].grado_nuevo}</strong>. ¡Enhorabuena por este logro!
              </p>
              {promotionError ? <p className="mt-4 text-sm font-bold text-red-dark" role="alert">{promotionError}</p> : null}
              <button
                className="mt-6 min-h-11 rounded-full bg-red px-5 text-sm font-bold text-white hover:bg-red-dark disabled:opacity-60"
                type="button"
                autoFocus
                disabled={acknowledgingPromotionId === promotionNotifications[0].id_aviso}
                onClick={() => void acknowledgePromotion(promotionNotifications[0]!)}
              >
                {acknowledgingPromotionId === promotionNotifications[0].id_aviso ? 'Confirmando…' : 'Confirmar recepción'}
              </button>
            </PanelCard>
          </div>
        </div>
      ) : null}
      <p className="mb-2 text-xs font-black tracking-[0.12em] text-red uppercase">Mi ficha</p>
      <h1 className="m-0 text-4xl font-bold tracking-tight text-ink md:text-5xl">{student.name}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
        {student.isInstructor ? 'Alumno e instructor de la escuela.' : 'Alumno de la escuela.'} Si algún dato no es correcto, avisa a la administración.
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <PanelCard className="p-6">
          <h2 className="m-0 text-xl font-bold text-ink">Datos personales</h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <DataItem label="Matrícula" value={student.enrollmentNumber} />
            <DataItem label="Correo electrónico" value={student.email ?? 'Sin indicar'} />
            <DataItem label="Fecha de nacimiento" value={formatDate(student.birthDate)} />
            <DataItem label="Alumno desde" value={formatDate(student.joinedOn)} />
          </dl>
        </PanelCard>

        <div className="grid content-start gap-5">
          <PanelCard className="p-6">
            <p className="m-0 text-xs font-black tracking-[0.12em] text-red uppercase">Grado actual</p>
            <h2 className="mt-3 text-2xl font-bold leading-tight text-ink">{grade.name}</h2>
            <p className="mt-2 text-base text-muted">Cinturón {grade.beltColor.toLowerCase()}</p>
            <div className="mt-6 border-t border-line pt-4">
              <strong className="block text-4xl leading-none text-ink">{profile.knownForms.length}</strong>
              <span className="mt-2 block text-sm text-muted">{profile.knownForms.length === 1 ? 'forma aprendida' : 'formas aprendidas'}</span>
            </div>
          </PanelCard>
          <BirthdayPanel />
        </div>
      </div>

      {instructor ? (
        <PanelCard className="mt-5 p-6">
          <h2 className="m-0 text-xl font-bold text-ink">Como instructor</h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-3">
            <DataItem label="Especialidad" value={instructor.specialty ?? 'Sin indicar'} />
            <DataItem label="Instructor desde" value={formatDate(instructor.hiredOn)} />
            <DataItem label="Estilos que enseña" value={instructor.styles.length ? instructor.styles.join(', ') : 'Sin asignar'} />
          </dl>
        </PanelCard>
      ) : null}

      <PanelCard className="mt-5 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="m-0 text-xl font-bold text-ink">Formas</h2>
          {requiredGradeForms.length > 0 ? <span className="text-sm font-bold text-muted">{knownRequired} de {requiredGradeForms.length} obligatorias</span> : null}
        </div>
        <p className="mt-2 text-sm text-muted">Formas aprendidas y asignadas al grado actual.</p>
        {notice ? <p className="mt-3 rounded-soft bg-gold/30 px-3 py-2 text-sm font-bold text-ink" role="status">{notice}</p> : null}
        {formsByStyle.length === 0 ? <p className="mt-3 text-sm text-muted">Todavía no hay formas registradas en tu ficha.</p> : formsByStyle.map(([style, forms]) => (
          <StyleFormGroup key={style} style={style} forms={forms} onChanged={handleFormChanged} />
        ))}
      </PanelCard>
    </section>
  )
}
