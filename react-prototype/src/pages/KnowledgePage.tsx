import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../api/databaseApi'
import { getKnowledgeDirectory } from '../features/knowledge/knowledgeService'

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
  const [view, setView] = useState<KnowledgeView>('styles')
  const knowledgeQuery = useQuery({
    queryKey: ['knowledge-directory'],
    queryFn: getKnowledgeDirectory,
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
      ) : (
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
      )}
    </div>
  )
}
