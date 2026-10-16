import type { CalendarEvent } from './calendarApi'

export type CalendarView = 'month' | 'week' | 'upcoming'

export type CalendarPageState = {
  view: CalendarView
  monthDate: string
  weekDate: string
  roomId: string | null
}

export type CalendarNavigationState = {
  returnTo?: string
  calendarState?: CalendarPageState
  editEvent?: CalendarEvent
}
