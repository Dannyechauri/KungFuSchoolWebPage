type PlaceholderPageProps = {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section>
      <p className="page-kicker">Próximamente</p>
      <h1>{title}</h1>
      <p className="page-description">{description}</p>
    </section>
  )
}
