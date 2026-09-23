export type DemoActivity = {
  id: string
  dayOffset: number
  time: string
  title: string
  topic: string
  instructor: string
  active: boolean
}

export type DatedDemoActivity = DemoActivity & {
  date: Date
}

const activities: DemoActivity[] = [
  { id: '1', dayOffset: -3, time: '18:30', title: 'Ving Tsun: base y estructura', topic: 'Técnica', instructor: 'Marta Serra', active: true },
  { id: '2', dayOffset: -1, time: '19:00', title: 'Jungar: acondicionamiento', topic: 'Preparación física', instructor: 'Daniel Rius', active: true },
  { id: '3', dayOffset: 1, time: '18:30', title: 'Shaolin: formas tradicionales', topic: 'Formas', instructor: 'Laia Font', active: true },
  { id: '4', dayOffset: 2, time: '19:00', title: 'Práctica abierta de Wu-shu', topic: 'Entrenamiento', instructor: 'Marta Serra', active: true },
  { id: '5', dayOffset: 3, time: '17:00', title: 'Shaolin: formas tradicionales', topic: 'Formas', instructor: 'Laia Font', active: false },
  { id: '6', dayOffset: 4, time: '18:30', title: 'Ving Tsun: base y estructura', topic: 'Técnica', instructor: 'Marta Serra', active: true },
  { id: '7', dayOffset: 6, time: '19:00', title: 'Jungar: acondicionamiento', topic: 'Preparación física', instructor: 'Daniel Rius', active: true },
  { id: '8', dayOffset: 8, time: '18:30', title: 'Shaolin: formas tradicionales', topic: 'Formas', instructor: 'Laia Font', active: true },
  { id: '9', dayOffset: 10, time: '19:00', title: 'Práctica abierta de Wu-shu', topic: 'Entrenamiento', instructor: 'Marta Serra', active: true },
  { id: '10', dayOffset: 12, time: '18:30', title: 'Ving Tsun: base y estructura', topic: 'Técnica', instructor: 'Marta Serra', active: true },
  { id: '11', dayOffset: 14, time: '19:00', title: 'Jungar: acondicionamiento', topic: 'Preparación física', instructor: 'Daniel Rius', active: true },
]

function dateAt(dayOffset: number, time: string) {
  const [hour, minute] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  date.setDate(date.getDate() + dayOffset)
  return date
}

export function getDemoActivities(): DatedDemoActivity[] {
  return activities.map((activity) => ({ ...activity, date: dateAt(activity.dayOffset, activity.time) }))
}

export function getUpcomingDemoActivities() {
  return getDemoActivities()
    .filter((activity) => activity.active && activity.date.getTime() >= Date.now())
    .sort((first, second) => first.date.getTime() - second.date.getTime())
}

export function formatActivityDate(date: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
