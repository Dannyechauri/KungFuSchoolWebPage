export type DatabaseHealth = {
  status: string
  databaseTime: string | null
  checkedAt: string
}

export type StudentRow = {
  id_alumno: number
  numero_matricula: string
  fecha_ingreso: string
  activo: boolean
}

export type InstructorRow = {
  id_instructor: number
  fecha_contratacion: string
  activo: boolean
  especialidad: string | null
}

export type PersonRow = {
  id_persona: number
  nombre: string
  apellido_paterno: string
  apellido_materno: string | null
}

export type CourseRow = {
  id_curso: number
  id_instructor: number
  nombre: string
  tema: string
  descripcion: string | null
  fecha_hora: string
}

export type StyleRow = {
  id_estilo: number
  nombre: string
  descripcion: string | null
}

export type FormRow = {
  id_forma: number
  id_estilo: number
  nombre: string
  descripcion: string | null
}
