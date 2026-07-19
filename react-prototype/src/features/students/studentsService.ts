import { databaseApi } from '../../api/databaseApi'
import type {
  CourseRow,
  EnrollmentRow,
  FormRow,
  GradeFormRow,
  GradeRow,
  PersonRow,
  ScheduledCourseRow,
  StudentFormRow,
  StudentRow,
  StyleRow,
} from '../../types/database'

export type StudentKnownForm = {
  id: number
  name: string
  style: string
  learnedAt: string
}

export type StudentSummary = {
  id: number
  fullName: string
  email: string | null
  phone: string | null
  enrollmentNumber: string
  joinedAt: string
  active: boolean
  knownForms: StudentKnownForm[]
  activeEnrollments: number
  completedGradeIds: number[]
}

export type StudentFilterOption = {
  id: number
  name: string
}

export type StudentsDirectory = {
  students: StudentSummary[]
  formOptions: StudentFilterOption[]
  gradeOptions: StudentFilterOption[]
}

export type StudentGradeProgress = {
  id: number
  name: string
  beltColor: string
  learnedRequiredForms: number
  requiredForms: number
  completed: boolean
  missingForms: string[]
}

export type StudentCourse = {
  id: number
  name: string
  topic: string
  scheduledAt: string
  enrollmentStatus: EnrollmentRow['estado']
}

export type StudentProfile = {
  id: number
  fullName: string
  currentGradeId: number | null
  enrollmentNumber: string
  joinedAt: string
  active: boolean
  birthDate: string | null
  email: string | null
  phone: string | null
  address: string | null
  group: string | null
  tutorName: string | null
  tutorPhone: string | null
  observations: string | null
  knownForms: StudentKnownForm[]
  gradeProgress: StudentGradeProgress[]
  courses: StudentCourse[]
  formOptions: StudentFilterOption[]
  gradeOptions: StudentFilterOption[]
}

function personFullName(person?: PersonRow) {
  if (!person) return null

  return [person.nombre, person.apellido_paterno, person.apellido_materno]
    .filter(Boolean)
    .join(' ')
}

function studentFullName(student: StudentRow, person?: PersonRow) {
  return student.nombre ?? personFullName(person) ?? 'Alumno sin nombre registrado'
}

function studentEmail(student: StudentRow, person?: PersonRow) {
  return student.correo_electronico ?? person?.email ?? null
}

function buildKnownForms(
  studentForms: StudentFormRow[],
  formsById: Map<number, FormRow>,
  stylesById: Map<number, StyleRow>,
) {
  const formsByStudent = new Map<number, StudentKnownForm[]>()

  studentForms.forEach((relation) => {
    const form = formsById.get(relation.id_forma)
    if (!form) return

    const knownForms = formsByStudent.get(relation.id_alumno) ?? []
    knownForms.push({
      id: form.id_forma,
      name: form.nombre,
      style: stylesById.get(form.id_estilo)?.nombre ?? 'Estilo sin asignar',
      learnedAt: relation.fecha_aprendida,
    })
    formsByStudent.set(relation.id_alumno, knownForms)
  })

  return formsByStudent
}

function buildRequiredFormsByGrade(gradeForms: GradeFormRow[]) {
  const requiredFormsByGrade = new Map<number, number[]>()

  gradeForms
    .filter((relation) => !relation.es_opcional)
    .forEach((relation) => {
      const requiredForms = requiredFormsByGrade.get(relation.id_grado) ?? []
      requiredForms.push(relation.id_forma)
      requiredFormsByGrade.set(relation.id_grado, requiredForms)
    })

  return requiredFormsByGrade
}

function completedGradeIdsForKnownForms(
  knownForms: StudentKnownForm[],
  grades: GradeRow[],
  requiredFormsByGrade: Map<number, number[]>,
) {
  const knownFormIds = new Set(knownForms.map((form) => form.id))

  return grades
    .filter((grade) => {
      const requiredForms = requiredFormsByGrade.get(grade.id_grado) ?? []
      return (
        requiredForms.length > 0 &&
        requiredForms.every((formId) => knownFormIds.has(formId))
      )
    })
    .map((grade) => grade.id_grado)
}

export async function getStudentsDirectory(): Promise<StudentsDirectory> {
  const tables = await databaseApi.tables()
  const hasPeople = tables.includes('personas')

  const [
    studentRows,
    people,
    studentForms,
    forms,
    styles,
    enrollments,
    grades,
    gradeForms,
  ] = await Promise.all([
    databaseApi.rows<StudentRow>('alumnos'),
    hasPeople ? databaseApi.rows<PersonRow>('personas') : Promise.resolve([]),
    databaseApi.rows<StudentFormRow>('alumno_forma'),
    databaseApi.rows<FormRow>('formas'),
    databaseApi.rows<StyleRow>('estilos'),
    databaseApi.rows<EnrollmentRow>('inscripciones'),
    databaseApi.rows<GradeRow>('grados'),
    databaseApi.rows<GradeFormRow>('grado_forma'),
  ])

  const peopleById = new Map(people.map((person) => [person.id_persona, person]))
  const stylesById = new Map(styles.map((style) => [style.id_estilo, style]))
  const formsById = new Map(forms.map((form) => [form.id_forma, form]))
  const requiredFormsByGrade = buildRequiredFormsByGrade(gradeForms)
  const formsByStudent = buildKnownForms(studentForms, formsById, stylesById)

  const activeEnrollmentsByStudent = new Map<number, number>()
  enrollments
    .filter((enrollment) => enrollment.estado === 'activa')
    .forEach((enrollment) => {
      activeEnrollmentsByStudent.set(
        enrollment.id_alumno,
        (activeEnrollmentsByStudent.get(enrollment.id_alumno) ?? 0) + 1,
      )
    })

  const students = studentRows.map((student): StudentSummary => {
    const person = peopleById.get(student.id_alumno)
    const knownForms = (formsByStudent.get(student.id_alumno) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, 'es'),
    )
    const completedGradeIds = new Set(
      completedGradeIdsForKnownForms(knownForms, grades, requiredFormsByGrade),
    )

    if (student.id_grado !== undefined) {
      completedGradeIds.add(student.id_grado)
    }

    return {
      id: student.id_alumno,
      fullName: studentFullName(student, person),
      email: studentEmail(student, person),
      phone: person?.telefono ?? student.tutor_telefono ?? null,
      enrollmentNumber: student.numero_matricula,
      joinedAt: student.fecha_ingreso,
      active: student.activo,
      knownForms,
      activeEnrollments: activeEnrollmentsByStudent.get(student.id_alumno) ?? 0,
      completedGradeIds: [...completedGradeIds],
    }
  })

  return {
    students,
    formOptions: forms
      .map((form) => ({ id: form.id_forma, name: form.nombre }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    gradeOptions: grades
      .sort((a, b) => a.orden_grado - b.orden_grado)
      .map((grade) => ({ id: grade.id_grado, name: grade.nombre })),
  }
}

export async function getStudentProfile(
  studentId: number,
): Promise<StudentProfile | null> {
  const tables = await databaseApi.tables()
  const hasPeople = tables.includes('personas')
  const hasScheduledCourses = tables.includes('cursos_agendados')

  const [
    studentRows,
    people,
    studentForms,
    forms,
    styles,
    enrollments,
    courses,
    scheduledCourses,
    grades,
    gradeForms,
  ] = await Promise.all([
    databaseApi.rows<StudentRow>('alumnos'),
    hasPeople ? databaseApi.rows<PersonRow>('personas') : Promise.resolve([]),
    databaseApi.rows<StudentFormRow>('alumno_forma'),
    databaseApi.rows<FormRow>('formas'),
    databaseApi.rows<StyleRow>('estilos'),
    databaseApi.rows<EnrollmentRow>('inscripciones'),
    databaseApi.rows<CourseRow>('cursos'),
    hasScheduledCourses
      ? databaseApi.rows<ScheduledCourseRow>('cursos_agendados')
      : Promise.resolve([]),
    databaseApi.rows<GradeRow>('grados'),
    databaseApi.rows<GradeFormRow>('grado_forma'),
  ])

  const student = studentRows.find((row) => row.id_alumno === studentId)
  if (!student) return null

  const person = people.find((row) => row.id_persona === studentId)
  const stylesById = new Map(styles.map((style) => [style.id_estilo, style]))
  const formsById = new Map(forms.map((form) => [form.id_forma, form]))
  const knownForms = studentForms
    .filter((relation) => relation.id_alumno === studentId)
    .flatMap((relation): StudentKnownForm[] => {
      const form = formsById.get(relation.id_forma)
      if (!form) return []

      return [
        {
          id: form.id_forma,
          name: form.nombre,
          style: stylesById.get(form.id_estilo)?.nombre ?? 'Estilo sin asignar',
          learnedAt: relation.fecha_aprendida,
        },
      ]
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const knownFormIds = new Set(knownForms.map((form) => form.id))
  const gradeProgress = grades
    .sort((left, right) => left.orden_grado - right.orden_grado)
    .map((grade): StudentGradeProgress => {
      const requiredFormIds = gradeForms
        .filter(
          (relation) =>
            relation.id_grado === grade.id_grado && !relation.es_opcional,
        )
        .map((relation) => relation.id_forma)
      const missingForms = requiredFormIds
        .filter((formId) => !knownFormIds.has(formId))
        .map((formId) => formsById.get(formId)?.nombre ?? 'Forma sin identificar')

      return {
        id: grade.id_grado,
        name: grade.nombre,
        beltColor: grade.color_cinturon,
        learnedRequiredForms: requiredFormIds.length - missingForms.length,
        requiredForms: requiredFormIds.length,
        completed:
          grade.id_grado === student.id_grado ||
          (requiredFormIds.length > 0 && missingForms.length === 0),
        missingForms,
      }
    })

  const coursesById = new Map(courses.map((course) => [course.id_curso, course]))
  const scheduledCoursesById = new Map(
    scheduledCourses.map((course) => [course.id_curso_agendado, course]),
  )
  const studentCourses = enrollments
    .filter((enrollment) => enrollment.id_alumno === studentId)
    .flatMap((enrollment): StudentCourse[] => {
      if (hasScheduledCourses && enrollment.id_curso_agendado !== undefined) {
        const scheduledCourse = scheduledCoursesById.get(enrollment.id_curso_agendado)
        if (!scheduledCourse) return []

        const course = coursesById.get(scheduledCourse.id_curso)
        if (!course) return []

        return [
          {
            id: scheduledCourse.id_curso_agendado,
            name: course.nombre,
            topic: course.tema,
            scheduledAt: scheduledCourse.fecha_hora,
            enrollmentStatus: enrollment.estado,
          },
        ]
      }

      if (enrollment.id_curso === undefined) return []

      const course = coursesById.get(enrollment.id_curso)
      if (!course?.fecha_hora) return []

      return [
        {
          id: course.id_curso,
          name: course.nombre,
          topic: course.tema,
          scheduledAt: course.fecha_hora,
          enrollmentStatus: enrollment.estado,
        },
      ]
    })
    .sort(
      (left, right) =>
        new Date(right.scheduledAt).getTime() -
        new Date(left.scheduledAt).getTime(),
    )

  return {
    id: student.id_alumno,
    fullName: studentFullName(student, person),
    currentGradeId: student.id_grado ?? null,
    enrollmentNumber: student.numero_matricula,
    joinedAt: student.fecha_ingreso,
    active: student.activo,
    birthDate: student.fecha_nacimiento ?? person?.fecha_nacimiento ?? null,
    email: studentEmail(student, person),
    phone: person?.telefono ?? student.tutor_telefono ?? null,
    address: person?.direccion ?? null,
    group: student.grupo ?? null,
    tutorName: student.tutor_nombre ?? null,
    tutorPhone: student.tutor_telefono ?? null,
    observations: student.observaciones ?? null,
    knownForms,
    gradeProgress,
    courses: studentCourses,
    formOptions: forms
      .map((form) => ({ id: form.id_forma, name: form.nombre }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    gradeOptions: grades
      .sort((a, b) => a.orden_grado - b.orden_grado)
      .map((grade) => ({ id: grade.id_grado, name: grade.nombre })),
  }
}
