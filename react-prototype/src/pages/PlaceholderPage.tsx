type PlaceholderPageProps = {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="error-state">
      <p className="page-kicker">Siguiente etapa</p>
      <h1>{title}</h1>
      <p className="page-description">{description}</p>
    </section>
  )
}
