import { databaseApi } from '../../api/databaseApi'
import type {
  CourseRow,
  EnrollmentRow,
  InstructorRow,
  PersonRow,
  ScheduledCourseRow,
} from '../../types/database'

export type CalendarCourse = {
  id: number
  name: string
  topic: string
  description: string | null
  scheduledAt: string
  instructorId: number
  instructorName: string
  enrollmentCount: number
}

export type CalendarInstructor = {
  id: number
  name: string
}

export type CalendarDirectory = {
  courses: CalendarCourse[]
  instructors: CalendarInstructor[]
}

function personName(person?: PersonRow) {
  if (!person) return 'Instructor sin ficha'

  return [person.nombre, person.apellido_paterno, person.apellido_materno]
    .filter(Boolean)
    .join(' ')
}

function instructorName(instructor?: InstructorRow, person?: PersonRow) {
  return instructor?.nombre ?? personName(person)
}

export async function getCalendarDirectory(): Promise<CalendarDirectory> {
  const tables = await databaseApi.tables()
  const hasPeople = tables.includes('personas')
  const hasScheduledCourses = tables.includes('cursos_agendados')

  const [courses, scheduledCourses, instructors, people, enrollments] = await Promise.all([
    databaseApi.rows<CourseRow>('cursos'),
    hasScheduledCourses
      ? databaseApi.rows<ScheduledCourseRow>('cursos_agendados')
      : Promise.resolve([]),
    databaseApi.rows<InstructorRow>('instructores'),
    hasPeople ? databaseApi.rows<PersonRow>('personas') : Promise.resolve([]),
    databaseApi.rows<EnrollmentRow>('inscripciones'),
  ])

  const peopleById = new Map(people.map((person) => [person.id_persona, person]))
  const instructorsById = new Map(
    instructors.map((instructor) => [instructor.id_instructor, instructor]),
  )
  const coursesById = new Map(courses.map((course) => [course.id_curso, course]))
  const enrollmentCountBySchedule = new Map<number, number>()
  const enrollmentCountByCourse = new Map<number, number>()
  enrollments
    .filter((enrollment) => enrollment.estado === 'activa')
    .forEach((enrollment) => {
      if (enrollment.id_curso_agendado !== undefined) {
        enrollmentCountBySchedule.set(
          enrollment.id_curso_agendado,
          (enrollmentCountBySchedule.get(enrollment.id_curso_agendado) ?? 0) + 1,
        )
      }

      if (enrollment.id_curso !== undefined) {
        enrollmentCountByCourse.set(
          enrollment.id_curso,
          (enrollmentCountByCourse.get(enrollment.id_curso) ?? 0) + 1,
        )
      }
    })

  const calendarCourses = hasScheduledCourses
    ? scheduledCourses.flatMap((scheduledCourse): CalendarCourse[] => {
        const course = coursesById.get(scheduledCourse.id_curso)
        if (!course || !scheduledCourse.activo) return []

        return [
          {
            id: scheduledCourse.id_curso_agendado,
            name: course.nombre,
            topic: course.tema,
            description: course.descripcion,
            scheduledAt: scheduledCourse.fecha_hora,
            instructorId: scheduledCourse.id_instructor,
            instructorName: instructorName(
              instructorsById.get(scheduledCourse.id_instructor),
              peopleById.get(scheduledCourse.id_instructor),
            ),
            enrollmentCount:
              enrollmentCountBySchedule.get(scheduledCourse.id_curso_agendado) ?? 0,
          },
        ]
      })
    : courses.flatMap((course): CalendarCourse[] => {
        if (!course.fecha_hora || course.id_instructor === undefined) return []

        return [
          {
            id: course.id_curso,
            name: course.nombre,
            topic: course.tema,
            description: course.descripcion,
            scheduledAt: course.fecha_hora,
            instructorId: course.id_instructor,
            instructorName: instructorName(
              instructorsById.get(course.id_instructor),
              peopleById.get(course.id_instructor),
            ),
            enrollmentCount: enrollmentCountByCourse.get(course.id_curso) ?? 0,
          },
        ]
      })

  return {
    courses: calendarCourses.sort(
      (left, right) =>
        new Date(left.scheduledAt).getTime() -
        new Date(right.scheduledAt).getTime(),
    ),
    instructors: instructors
      .map((instructor) => ({
        id: instructor.id_instructor,
        name: instructorName(instructor, peopleById.get(instructor.id_instructor)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
  }
}
