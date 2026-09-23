import { useParams } from 'react-router'

type PlaceholderPageProps = {
  title: string
  description?: string
}

type ProfilePlaceholderPageProps = {
  title: string
  parameterName: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </section>
  )
}

export function ProfilePlaceholderPage({ title, parameterName }: ProfilePlaceholderPageProps) {
  const parameters = useParams()

  return (
    <section>
      <h2>{title}</h2>
      <p>Ruta preparada para el registro con identificador: {parameters[parameterName] ?? 'pendiente'}.</p>
    </section>
  )
}
