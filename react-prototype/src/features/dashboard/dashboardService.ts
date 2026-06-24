import { databaseApi } from '../../api/databaseApi'
import type {
  CourseRow,
  FormRow,
  InstructorRow,
  PersonRow,
  ScheduledCourseRow,
  StudentRow,
  StyleRow,
} from '../../types/database'

export type UpcomingCourse = {
  id_curso: number
  nombre: string
  tema: string
  descripcion: string | null
  fecha_hora: string
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

function instructorName(instructor?: InstructorRow, person?: PersonRow) {
  return instructor?.nombre ?? personName(person)
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const tables = await databaseApi.tables()
  const hasPeople = tables.includes('personas')
  const hasScheduledCourses = tables.includes('cursos_agendados')

  const [
    health,
    students,
    instructors,
    people,
    courses,
    scheduledCourses,
    styles,
    forms,
  ] = await Promise.all([
    databaseApi.health(),
    databaseApi.rows<StudentRow>('alumnos'),
    databaseApi.rows<InstructorRow>('instructores'),
    hasPeople ? databaseApi.rows<PersonRow>('personas') : Promise.resolve([]),
    databaseApi.rows<CourseRow>('cursos'),
    hasScheduledCourses
      ? databaseApi.rows<ScheduledCourseRow>('cursos_agendados')
      : Promise.resolve([]),
    databaseApi.rows<StyleRow>('estilos'),
    databaseApi.rows<FormRow>('formas'),
  ])

  const peopleById = new Map(people.map((person) => [person.id_persona, person]))
  const instructorsById = new Map(
    instructors.map((instructor) => [instructor.id_instructor, instructor]),
  )
  const coursesById = new Map(courses.map((course) => [course.id_curso, course]))
  const now = Date.now()
  const courseEvents = hasScheduledCourses
    ? scheduledCourses.flatMap((scheduledCourse): UpcomingCourse[] => {
        const course = coursesById.get(scheduledCourse.id_curso)
        if (!course || !scheduledCourse.activo) return []

        return [
          {
            id_curso: scheduledCourse.id_curso_agendado,
            nombre: course.nombre,
            tema: course.tema,
            descripcion: course.descripcion,
            fecha_hora: scheduledCourse.fecha_hora,
            instructorName: instructorName(
              instructorsById.get(scheduledCourse.id_instructor),
              peopleById.get(scheduledCourse.id_instructor),
            ),
          },
        ]
      })
    : courses.flatMap((course): UpcomingCourse[] => {
        if (!course.fecha_hora || course.id_instructor === undefined) return []

        return [
          {
            id_curso: course.id_curso,
            nombre: course.nombre,
            tema: course.tema,
            descripcion: course.descripcion,
            fecha_hora: course.fecha_hora,
            instructorName: instructorName(
              instructorsById.get(course.id_instructor),
              peopleById.get(course.id_instructor),
            ),
          },
        ]
      })

  const upcomingCourses = courseEvents
    .filter((course) => new Date(course.fecha_hora).getTime() >= now)
    .sort(
      (left, right) =>
        new Date(left.fecha_hora).getTime() -
        new Date(right.fecha_hora).getTime(),
    )
    .slice(0, 4)

  return {
    status: health.status,
    checkedAt: health.checkedAt,
    activeStudents: students.filter((student) => student.activo).length,
    activeInstructors: instructors.filter((instructor) => instructor.activo)
      .length,
    courses: hasScheduledCourses ? scheduledCourses.length : courses.length,
    forms: forms.length,
    styles,
    upcomingCourses,
  }
}
