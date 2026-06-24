export type DatabaseHealth = {
  status: string
  databaseTime: string | null
  checkedAt: string
}

export type StudentRow = {
  id_alumno: number
  nombre?: string
  fecha_nacimiento?: string | null
  id_grado?: number
  correo_electronico?: string | null
  numero_matricula: string
  fecha_ingreso: string
  grupo?: string | null
  tutor_nombre?: string | null
  tutor_telefono?: string | null
  observaciones?: string | null
  activo: boolean
}

export type InstructorRow = {
  id_instructor: number
  nombre?: string
  fecha_contratacion: string | null
  activo: boolean
  especialidad: string | null
  cinturon_actual?: string
}

export type PersonRow = {
  id_persona: number
  nombre: string
  apellido_paterno: string
  apellido_materno: string | null
  fecha_nacimiento: string
  telefono: string | null
  email: string | null
  direccion: string | null
  foto_url: string | null
}

export type CourseRow = {
  id_curso: number
  nombre: string
  tema: string
  descripcion: string | null
  id_instructor?: number
  fecha_hora?: string
}

export type ScheduledCourseRow = {
  id_curso_agendado: number
  id_curso: number
  id_instructor: number
  fecha_hora: string
  activo: boolean
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

export type StudentFormRow = {
  id_alumno: number
  id_forma: number
  fecha_aprendida: string
}

export type GradeRow = {
  id_grado: number
  nombre: string
  orden_grado: number
  color_cinturon: string
  formas_requeridas: number
}

export type GradeFormRow = {
  id_grado: number
  id_forma: number
  es_opcional: boolean
}

export type EnrollmentRow = {
  id_inscripcion: number
  id_alumno: number
  id_curso?: number
  id_curso_agendado?: number
  fecha_inscripcion: string
  estado: 'activa' | 'inactiva' | 'suspendida'
}
