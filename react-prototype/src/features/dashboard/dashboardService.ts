import { databaseApi } from '../../api/databaseApi'
import type {
  CourseRow,
  FormRow,
  InstructorRow,
  PersonRow,
  StudentRow,
  StyleRow,
} from '../../types/database'

export type UpcomingCourse = CourseRow & {
  instructorName: string
}

export type DashboardSnapshot = {
  status: string
  checkedAt: string
  activeStudents: number
  activeInstructors: number
  courses: number
  forms: number
  styles: StyleRow[]
  upcomingCourses: UpcomingCourse[]
}

function personName(person?: PersonRow) {
  if (!person) return 'Instructor por confirmar'

  return [person.nombre, person.apellido_paterno, person.apellido_materno]
    .filter(Boolean)
    .join(' ')
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [health, students, instructors, people, courses, styles, forms] =
    await Promise.all([
      databaseApi.health(),
      databaseApi.rows<StudentRow>('alumnos'),
      databaseApi.rows<InstructorRow>('instructores'),
      databaseApi.rows<PersonRow>('personas'),
      databaseApi.rows<CourseRow>('cursos'),
      databaseApi.rows<StyleRow>('estilos'),
      databaseApi.rows<FormRow>('formas'),
    ])

  const peopleById = new Map(people.map((person) => [person.id_persona, person]))
  const now = Date.now()
  const upcomingCourses = courses
    .filter((course) => new Date(course.fecha_hora).getTime() >= now)
    .sort(
      (left, right) =>
        new Date(left.fecha_hora).getTime() -
        new Date(right.fecha_hora).getTime(),
    )
    .slice(0, 4)
    .map((course) => ({
      ...course,
      instructorName: personName(peopleById.get(course.id_instructor)),
    }))

  return {
    status: health.status,
    checkedAt: health.checkedAt,
    activeStudents: students.filter((student) => student.activo).length,
    activeInstructors: instructors.filter((instructor) => instructor.activo)
      .length,
    courses: courses.length,
    forms: forms.length,
    styles,
    upcomingCourses,
  }
}
