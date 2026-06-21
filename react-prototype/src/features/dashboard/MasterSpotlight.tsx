import { useState } from 'react'
import { masterSpotlights } from './masterSpotlights'

const updatedAtFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

type MasterSpotlightProps = {
  checkedAt: string
}

export function MasterSpotlight({ checkedAt }: MasterSpotlightProps) {
  const [currentIndex, setCurrentIndex] = useState(
    () => (new Date().getDate() - 1) % masterSpotlights.length,
  )
  const currentMaster = masterSpotlights[currentIndex]

  function showPrevious() {
    setCurrentIndex(
      (index) =>
        (index - 1 + masterSpotlights.length) % masterSpotlights.length,
    )
  }

  function showNext() {
    setCurrentIndex((index) => (index + 1) % masterSpotlights.length)
  }

  return (
    <section
      className="master-spotlight"
      aria-label="Archivo de maestros y linajes"
      aria-live="polite"
    >
      <h1 className="sr-only">Panel interno de gestión</h1>
      <div className="master-portrait">
        <img src={currentMaster.image} alt={`Retrato de ${currentMaster.name}`} />
        <span>Archivo del Instituto</span>
      </div>

      <div className="master-content">
        <div className="master-toolbar">
          <p className="page-kicker">Archivo vivo · Linajes de la escuela</p>
          <div className="system-status">
            <span className="status-dot" aria-hidden="true" />
            <div>
              <strong>Servicios operativos</strong>
              <small>
                {updatedAtFormatter.format(new Date(checkedAt))}
              </small>
            </div>
          </div>
        </div>

        <p className="master-principle">{currentMaster.principle}</p>

        <div className="master-footer">
          <div>
            <strong>{currentMaster.name}</strong>
            <span>
              {currentMaster.lifespan
                ? `${currentMaster.lifespan} · `
                : ''}
              {currentMaster.disciplines}
            </span>
          </div>
          <div className="spotlight-controls">
            <span>
              {String(currentIndex + 1).padStart(2, '0')} /{' '}
              {String(masterSpotlights.length).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={showPrevious}
              aria-label="Mostrar maestro anterior"
            >
              ←
            </button>
            <button
              type="button"
              onClick={showNext}
              aria-label="Mostrar maestro siguiente"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
