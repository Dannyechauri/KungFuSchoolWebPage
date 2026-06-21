import { databaseApi } from '../../api/databaseApi'
import type {
  EnrollmentRow,
  FormRow,
  GradeFormRow,
  GradeRow,
  CourseRow,
  PersonRow,
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
  enrollmentNumber: string
  joinedAt: string
  active: boolean
  birthDate: string
  email: string | null
  phone: string | null
  address: string | null
  knownForms: StudentKnownForm[]
  gradeProgress: StudentGradeProgress[]
  courses: StudentCourse[]
}

function fullName(person?: PersonRow) {
  if (!person) return 'Persona sin ficha asociada'

  return [person.nombre, person.apellido_paterno, person.apellido_materno]
    .filter(Boolean)
    .join(' ')
}

export async function getStudentsDirectory(): Promise<StudentsDirectory> {
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
    databaseApi.rows<PersonRow>('personas'),
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

  const requiredFormsByGrade = new Map<number, number[]>()
  gradeForms
    .filter((relation) => !relation.es_opcional)
    .forEach((relation) => {
      const requiredForms = requiredFormsByGrade.get(relation.id_grado) ?? []
      requiredForms.push(relation.id_forma)
      requiredFormsByGrade.set(relation.id_grado, requiredForms)
    })

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
    const knownFormIds = new Set(knownForms.map((form) => form.id))
    const completedGradeIds = grades
      .filter((grade) => {
        const requiredForms = requiredFormsByGrade.get(grade.id_grado) ?? []
        return (
          requiredForms.length > 0 &&
          requiredForms.every((formId) => knownFormIds.has(formId))
        )
      })
      .map((grade) => grade.id_grado)

    return {
      id: student.id_alumno,
      fullName: fullName(person),
      email: person?.email ?? null,
      phone: person?.telefono ?? null,
      enrollmentNumber: student.numero_matricula,
      joinedAt: student.fecha_ingreso,
      active: student.activo,
      knownForms,
      activeEnrollments: activeEnrollmentsByStudent.get(student.id_alumno) ?? 0,
      completedGradeIds,
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
  const [
    studentRows,
    people,
    studentForms,
    forms,
    styles,
    enrollments,
    courses,
    grades,
    gradeForms,
  ] = await Promise.all([
    databaseApi.rows<StudentRow>('alumnos'),
    databaseApi.rows<PersonRow>('personas'),
    databaseApi.rows<StudentFormRow>('alumno_forma'),
    databaseApi.rows<FormRow>('formas'),
    databaseApi.rows<StyleRow>('estilos'),
    databaseApi.rows<EnrollmentRow>('inscripciones'),
    databaseApi.rows<CourseRow>('cursos'),
    databaseApi.rows<GradeRow>('grados'),
    databaseApi.rows<GradeFormRow>('grado_forma'),
  ])

  const student = studentRows.find((row) => row.id_alumno === studentId)
  const person = people.find((row) => row.id_persona === studentId)
  if (!student || !person) return null

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
        completed: requiredFormIds.length > 0 && missingForms.length === 0,
        missingForms,
      }
    })

  const coursesById = new Map(courses.map((course) => [course.id_curso, course]))
  const studentCourses = enrollments
    .filter((enrollment) => enrollment.id_alumno === studentId)
    .flatMap((enrollment): StudentCourse[] => {
      const course = coursesById.get(enrollment.id_curso)
      if (!course) return []

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
    fullName: fullName(person),
    enrollmentNumber: student.numero_matricula,
    joinedAt: student.fecha_ingreso,
    active: student.activo,
    birthDate: person.fecha_nacimiento,
    email: person.email,
    phone: person.telefono,
    address: person.direccion,
    knownForms,
    gradeProgress,
    courses: studentCourses,
  }
}
