import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, databaseApi } from '../api/databaseApi'
import { getKnowledgeDirectory } from '../features/knowledge/knowledgeService'
import type { FormRow, GradeRow, StyleRow } from '../types/database'

type KnowledgeView = 'styles' | 'grades'

const beltColors: Record<string, string> = {
  Blanco: '#f7f4ec',
  Amarillo: '#e6bd24',
  Naranja: '#dd7423',
  Verde: '#3f8157',
  Azul: '#3c67a6',
  Violeta: '#765192',
  Marrón: '#754b35',
  Rojo: '#a90d1a',
  Negro: '#181512',
}

export function KnowledgePage() {
  const queryClient = useQueryClient()
  const [view, setView] = useState<KnowledgeView>('styles')
  const [message, setMessage] = useState<string | null>(null)
  const [newStyle, setNewStyle] = useState({ nombre: '', descripcion: '' })
  const [newForm, setNewForm] = useState({
    id_estilo: '',
    nombre: '',
    descripcion: '',
  })
  const [newGrade, setNewGrade] = useState({
    nombre: '',
    color_cinturon: '',
    formas_requeridas: '0',
  })
  const knowledgeQuery = useQuery({
    queryKey: ['knowledge-directory'],
    queryFn: getKnowledgeDirectory,
  })

  const refreshKnowledge = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['knowledge-directory'] }),
      queryClient.invalidateQueries({ queryKey: ['students-directory'] }),
      queryClient.invalidateQueries({ queryKey: ['student-profile'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  }

  const createStyleMutation = useMutation({
    mutationFn: () =>
      databaseApi.insert<StyleRow>('estilos', {
        nombre: newStyle.nombre.trim(),
        descripcion: newStyle.descripcion.trim() || null,
      }),
    onSuccess: async () => {
      setMessage('Estilo creado.')
      setNewStyle({ nombre: '', descripcion: '' })
      await refreshKnowledge()
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'No se ha podido crear.')
    },
  })

  const createFormMutation = useMutation({
    mutationFn: () =>
      databaseApi.insert<FormRow>('formas', {
        id_estilo: Number(newForm.id_estilo),
        nombre: newForm.nombre.trim(),
        descripcion: newForm.descripcion.trim() || null,
      }),
    onSuccess: async () => {
      setMessage('Forma creada.')
      setNewForm((current) => ({ ...current, nombre: '', descripcion: '' }))
      await refreshKnowledge()
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'No se ha podido crear.')
    },
  })

  const createGradeMutation = useMutation({
    mutationFn: () => {
      const nextOrder =
        (knowledgeQuery.data?.grades.reduce(
          (maxOrder, grade) => Math.max(maxOrder, grade.order),
          0,
        ) ?? 0) + 1

      return databaseApi.insert<GradeRow>('grados', {
        nombre: newGrade.nombre.trim(),
        orden_grado: nextOrder,
        color_cinturon: newGrade.color_cinturon.trim(),
        formas_requeridas: Number(newGrade.formas_requeridas) || 0,
      })
    },
    onSuccess: async () => {
      setMessage('Grado creado.')
      setNewGrade({ nombre: '', color_cinturon: '', formas_requeridas: '0' })
      await refreshKnowledge()
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'No se ha podido crear.')
    },
  })

  if (knowledgeQuery.isPending) {
    return <div className="skeleton knowledge-skeleton" aria-label="Cargando catálogo" />
  }

  if (knowledgeQuery.isError) {
    const message =
      knowledgeQuery.error instanceof ApiError
        ? knowledgeQuery.error.message
        : 'No se ha podido cargar el catálogo de conocimiento.'

    return (
      <section className="error-state">
        <p className="page-kicker">Conocimiento</p>
        <h1>No se ha podido cargar el catálogo.</h1>
        <p className="page-description">{message}</p>
      </section>
    )
  }

  const knowledge = knowledgeQuery.data

  function handleCreateStyle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    createStyleMutation.mutate()
  }

  function handleCreateForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    if (!newForm.id_estilo) {
      setMessage('Selecciona un estilo.')
      return
    }
    createFormMutation.mutate()
  }

  function handleCreateGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    createGradeMutation.mutate()
  }

  return (
    <div className="knowledge-page">
      <header className="page-header">
        <div>
          <p className="page-kicker">Programa técnico</p>
          <h1>Conocimiento</h1>
          <p>
            {knowledge.styles.length} estilos · {knowledge.totalForms} formas ·{' '}
            {knowledge.grades.length} grados
          </p>
        </div>
        <div className="view-switcher" role="group" aria-label="Vista del catálogo">
          <button
            type="button"
            className={view === 'styles' ? 'active' : undefined}
            onClick={() => setView('styles')}
          >
            Estilos y formas
          </button>
          <button
            type="button"
            className={view === 'grades' ? 'active' : undefined}
            onClick={() => setView('grades')}
          >
            Grados y requisitos
          </button>
        </div>
      </header>

      {view === 'styles' ? (
        <>
          <section className="knowledge-style-grid" aria-label="Estilos y formas">
            {knowledge.styles.map((style, index) => (
              <article className="knowledge-style-card" key={style.id}>
                <div className="knowledge-card-heading">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h2>{style.name}</h2>
                    <p>{style.description ?? 'Sin descripción registrada.'}</p>
                  </div>
                </div>
                <ul>
                  {style.forms.map((form) => (
                    <li key={form.id}>
                      <span>{form.name}</span>
                      <small>{form.students} alumnos</small>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          <section className="content-panel management-panel">
            <div className="section-heading">
              <div>
                <p className="page-kicker">Gestión técnica</p>
                <h2>Añadir conocimiento</h2>
              </div>
              {message ? <span>{message}</span> : null}
            </div>
            <div className="management-columns">
              <form className="inline-management-form" onSubmit={handleCreateStyle}>
                <h3>Nuevo estilo</h3>
                <label>
                  <span>Nombre</span>
                  <input
                    value={newStyle.nombre}
                    onChange={(event) =>
                      setNewStyle((current) => ({
                        ...current,
                        nombre: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Descripción</span>
                  <textarea
                    value={newStyle.descripcion}
                    onChange={(event) =>
                      setNewStyle((current) => ({
                        ...current,
                        descripcion: event.target.value,
                      }))
                    }
                    rows={3}
                  />
                </label>
                <button type="submit" disabled={createStyleMutation.isPending}>
                  Crear estilo
                </button>
              </form>
              <form className="inline-management-form" onSubmit={handleCreateForm}>
                <h3>Nueva forma</h3>
                <label>
                  <span>Estilo</span>
                  <select
                    value={newForm.id_estilo}
                    onChange={(event) =>
                      setNewForm((current) => ({
                        ...current,
                        id_estilo: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Selecciona estilo</option>
                    {knowledge.styles.map((style) => (
                      <option value={style.id} key={style.id}>
                        {style.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Nombre</span>
                  <input
                    value={newForm.nombre}
                    onChange={(event) =>
                      setNewForm((current) => ({
                        ...current,
                        nombre: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Descripción</span>
                  <textarea
                    value={newForm.descripcion}
                    onChange={(event) =>
                      setNewForm((current) => ({
                        ...current,
                        descripcion: event.target.value,
                      }))
                    }
                    rows={3}
                  />
                </label>
                <button type="submit" disabled={createFormMutation.isPending}>
                  Crear forma
                </button>
              </form>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="knowledge-grade-grid" aria-label="Grados y requisitos">
            {knowledge.grades.map((grade) => (
              <article className="knowledge-grade-card" key={grade.id}>
                <div className="grade-card-heading">
                  <span
                    className="grade-belt"
                    style={{ backgroundColor: beltColors[grade.beltColor] ?? '#aaa' }}
                  />
                  <div>
                    <span>Grado {String(grade.order).padStart(2, '0')}</span>
                    <h2>{grade.name}</h2>
                  </div>
                  <strong>{grade.studentsReady} preparados</strong>
                </div>
                <ul>
                  {grade.requirements.map((requirement) => (
                    <li key={requirement.id}>
                      <span>{requirement.name}</span>
                      <small>{requirement.optional ? 'Opcional' : 'Requerida'}</small>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          <section className="content-panel management-panel">
            <div className="section-heading">
              <div>
                <p className="page-kicker">Gestión de grados</p>
                <h2>Añadir grado</h2>
              </div>
              {message ? <span>{message}</span> : null}
            </div>
            <form className="management-form" onSubmit={handleCreateGrade}>
              <label>
                <span>Nombre</span>
                <input
                  value={newGrade.nombre}
                  onChange={(event) =>
                    setNewGrade((current) => ({
                      ...current,
                      nombre: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                <span>Color cinturón</span>
                <input
                  value={newGrade.color_cinturon}
                  onChange={(event) =>
                    setNewGrade((current) => ({
                      ...current,
                      color_cinturon: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                <span>Formas requeridas</span>
                <input
                  type="number"
                  min="0"
                  value={newGrade.formas_requeridas}
                  onChange={(event) =>
                    setNewGrade((current) => ({
                      ...current,
                      formas_requeridas: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="management-actions">
                <button type="submit" disabled={createGradeMutation.isPending}>
                  Crear grado
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  )
}
