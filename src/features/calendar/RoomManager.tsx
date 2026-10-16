import { useState, type FormEvent } from 'react'
import { ApiRequestError } from '../../api/client'
import { createCalendarRoom, entityKey, updateCalendarRoom, type CalendarRoom } from './calendarApi'

type RoomManagerProps = {
  rooms: CalendarRoom[]
  onChanged: () => void
}

const inputClass = 'min-h-10 rounded-soft border border-line bg-white px-3 text-ink'

export function RoomManager({ rooms, onChanged }: RoomManagerProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [updatingRoomId, setUpdatingRoomId] = useState<string | null>(null)

  async function addRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createCalendarRoom(name.trim())
      setName('')
      onChanged()
    } catch (saveError) {
      setError(saveError instanceof ApiRequestError && saveError.status === 409
        ? 'Ya existe una sala con ese nombre.'
        : saveError instanceof Error ? saveError.message : 'No se pudo crear la sala.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleRoom(room: CalendarRoom) {
    setError(null)
    setUpdatingRoomId(entityKey(room.id_sala))
    try {
      await updateCalendarRoom(room.id_sala, { activo: !room.activo })
      onChanged()
    } catch (saveError) {
      setError(saveError instanceof ApiRequestError && saveError.status === 409
        ? 'Mueve o cancela las actividades futuras antes de desactivar esta sala.'
        : saveError instanceof Error ? saveError.message : 'No se pudo actualizar la sala.')
    } finally {
      setUpdatingRoomId(null)
    }
  }

  return (
    <div className="grid gap-4">
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={addRoom}>
        <label className="sr-only" htmlFor="new-room-name">Nombre de la sala</label>
        <input id="new-room-name" className={`${inputClass} min-w-0 flex-1`} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre de la sala" maxLength={100} required />
        <button className="min-h-10 rounded-full bg-red px-4 text-sm font-bold text-white disabled:opacity-50" type="submit" disabled={saving || !name.trim()}>
          {saving ? 'Guardando…' : 'Añadir sala'}
        </button>
      </form>
      {error ? <p className="m-0 rounded-soft bg-red/10 p-3 text-sm font-bold text-red-dark" role="alert">{error}</p> : null}
      <ul className="grid gap-2">
        {rooms.map((room) => (
          <li key={entityKey(room.id_sala)} className="flex flex-wrap items-center justify-between gap-3 rounded-soft border border-line bg-white/60 px-4 py-3">
            <span className="font-bold text-ink">{room.nombre} <span className="text-xs font-semibold text-muted">{room.activo ? 'Activa' : 'Inactiva'}</span></span>
            <button className="rounded-full border border-line px-3 py-1.5 text-sm font-bold text-red-dark disabled:opacity-50" type="button" onClick={() => void toggleRoom(room)} disabled={updatingRoomId !== null}>
              {updatingRoomId === entityKey(room.id_sala) ? 'Guardando…' : room.activo ? 'Desactivar' : 'Activar'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
