const madridTimeZone = 'Europe/Madrid'

export function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function madridNowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: madridTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
    dateTime: `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`,
  }
}

export function startOfWeek(date: Date) {
  const result = new Date(date)
  const offset = (result.getUTCDay() + 6) % 7
  result.setUTCDate(result.getUTCDate() - offset)
  return result
}

export function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export function addDays(date: Date, amount: number) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + amount)
  return result
}

export function addMonths(date: Date, amount: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1))
}

export function addDaysToKey(key: string, amount: number) {
  return dateKey(addDays(dateFromKey(key), amount))
}

export function weekDateKeys(weekStart: Date) {
  return Array.from({ length: 7 }, (_, index) => dateKey(addDays(weekStart, index)))
}

export function monthDateKeys(month: Date) {
  const first = startOfMonth(month)
  const firstCell = addDays(first, -((first.getUTCDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, index) => dateKey(addDays(firstCell, index)))
}

export function formatCalendarDate(key: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', ...options }).format(dateFromKey(key))
}

export function formatTime(value: string) {
  return value.slice(11, 16)
}

export function minutesOfDateTime(value: string) {
  return Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16))
}

export function eventOverlapsDay(event: { fecha_hora: string; fecha_hora_fin: string }, day: string) {
  const dayStart = `${day}T00:00:00`
  const dayEnd = `${addDaysToKey(day, 1)}T00:00:00`
  return event.fecha_hora < dayEnd && event.fecha_hora_fin > dayStart
}
