import { databaseApi } from '../../api/databaseApi'
import type {
  CourseRow,
  EnrollmentRow,
  InstructorRow,
  PersonRow,
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

export async function getCalendarDirectory(): Promise<CalendarDirectory> {
  const [courses, instructors, people, enrollments] = await Promise.all([
    databaseApi.rows<CourseRow>('cursos'),
    databaseApi.rows<InstructorRow>('instructores'),
    databaseApi.rows<PersonRow>('personas'),
    databaseApi.rows<EnrollmentRow>('inscripciones'),
  ])

  const peopleById = new Map(people.map((person) => [person.id_persona, person]))
  const enrollmentCountByCourse = new Map<number, number>()
  enrollments
    .filter((enrollment) => enrollment.estado === 'activa')
    .forEach((enrollment) => {
      enrollmentCountByCourse.set(
        enrollment.id_curso,
        (enrollmentCountByCourse.get(enrollment.id_curso) ?? 0) + 1,
      )
    })

  return {
    courses: courses
      .map((course) => ({
        id: course.id_curso,
        name: course.nombre,
        topic: course.tema,
        description: course.descripcion,
        scheduledAt: course.fecha_hora,
        instructorId: course.id_instructor,
        instructorName: personName(peopleById.get(course.id_instructor)),
        enrollmentCount: enrollmentCountByCourse.get(course.id_curso) ?? 0,
      }))
      .sort(
        (left, right) =>
          new Date(left.scheduledAt).getTime() -
          new Date(right.scheduledAt).getTime(),
      ),
    instructors: instructors
      .map((instructor) => ({
        id: instructor.id_instructor,
        name: personName(peopleById.get(instructor.id_instructor)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
  }
}
