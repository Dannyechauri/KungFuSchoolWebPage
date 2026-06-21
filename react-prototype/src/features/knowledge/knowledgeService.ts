import { databaseApi } from '../../api/databaseApi'
import type {
  FormRow,
  GradeFormRow,
  GradeRow,
  StudentFormRow,
  StudentRow,
  StyleRow,
} from '../../types/database'

export type KnowledgeForm = {
  id: number
  name: string
  description: string | null
  students: number
}

export type KnowledgeStyle = {
  id: number
  name: string
  description: string | null
  forms: KnowledgeForm[]
}

export type GradeRequirement = {
  id: number
  name: string
  optional: boolean
}

export type KnowledgeGrade = {
  id: number
  name: string
  order: number
  beltColor: string
  requirements: GradeRequirement[]
  studentsReady: number
}

export type KnowledgeDirectory = {
  styles: KnowledgeStyle[]
  grades: KnowledgeGrade[]
  totalForms: number
}

export async function getKnowledgeDirectory(): Promise<KnowledgeDirectory> {
  const [styles, forms, grades, gradeForms, studentForms, students] =
    await Promise.all([
      databaseApi.rows<StyleRow>('estilos'),
      databaseApi.rows<FormRow>('formas'),
      databaseApi.rows<GradeRow>('grados'),
      databaseApi.rows<GradeFormRow>('grado_forma'),
      databaseApi.rows<StudentFormRow>('alumno_forma'),
      databaseApi.rows<StudentRow>('alumnos'),
    ])

  const studentCountByForm = new Map<number, number>()
  const knownFormsByStudent = new Map<number, Set<number>>()
  studentForms.forEach((relation) => {
    studentCountByForm.set(
      relation.id_forma,
      (studentCountByForm.get(relation.id_forma) ?? 0) + 1,
    )
    const knownForms = knownFormsByStudent.get(relation.id_alumno) ?? new Set()
    knownForms.add(relation.id_forma)
    knownFormsByStudent.set(relation.id_alumno, knownForms)
  })

  const formsById = new Map(forms.map((form) => [form.id_forma, form]))

  return {
    totalForms: forms.length,
    styles: styles
      .map((style) => ({
        id: style.id_estilo,
        name: style.nombre,
        description: style.descripcion,
        forms: forms
          .filter((form) => form.id_estilo === style.id_estilo)
          .map((form) => ({
            id: form.id_forma,
            name: form.nombre,
            description: form.descripcion,
            students: studentCountByForm.get(form.id_forma) ?? 0,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    grades: grades
      .map((grade) => {
        const relations = gradeForms.filter(
          (relation) => relation.id_grado === grade.id_grado,
        )
        const requiredFormIds = relations
          .filter((relation) => !relation.es_opcional)
          .map((relation) => relation.id_forma)
        const studentsReady = students.filter((student) => {
          const knownForms = knownFormsByStudent.get(student.id_alumno) ?? new Set()
          return (
            requiredFormIds.length > 0 &&
            requiredFormIds.every((formId) => knownForms.has(formId))
          )
        }).length

        return {
          id: grade.id_grado,
          name: grade.nombre,
          order: grade.orden_grado,
          beltColor: grade.color_cinturon,
          studentsReady,
          requirements: relations
            .flatMap((relation): GradeRequirement[] => {
              const form = formsById.get(relation.id_forma)
              if (!form) return []
              return [
                {
                  id: form.id_forma,
                  name: form.nombre,
                  optional: relation.es_opcional,
                },
              ]
            })
            .sort((a, b) => Number(a.optional) - Number(b.optional)),
        }
      })
      .sort((a, b) => a.order - b.order),
  }
}
