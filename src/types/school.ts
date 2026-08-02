export type SessionRole = 'ADMIN' | 'USER';

export interface SessionUser {
  authenticated: true;
  role: SessionRole;
  userId: number;
  displayName: string;
}

export type DbValue = string | number | boolean | null;

/**
 * Las filas que llegan del backend son dinámicas: dependen de tablas SQL.
 * Usamos `unknown` en el índice para que una fila pueda enriquecerse en React
 * con objetos derivados como `student.grade` o `form.style` sin pelear con TS.
 */
export type DbRow = Record<string, unknown>;

export interface StudentRow extends DbRow {
  id_alumno: number;
  nombre: string;
  numero_matricula: string;
  fecha_ingreso: string;
  fecha_nacimiento?: string | null;
  correo_electronico?: string | null;
  id_grado: number;
  activo: boolean;
}

export interface GradeRow extends DbRow {
  id_grado: number;
  nombre: string;
  orden_grado: number;
  color_cinturon: string;
  formas_requeridas: number;
}

export interface StyleRow extends DbRow {
  id_estilo: number;
  nombre: string;
  descripcion?: string | null;
}

export interface FormRow extends DbRow {
  id_forma: number;
  id_estilo: number;
  nombre: string;
  descripcion?: string | null;
}

export interface StudentFormRow extends DbRow {
  id_alumno: number;
  id_forma: number;
  fecha_aprendida: string;
}

export interface GradeFormRow extends DbRow {
  id_grado: number;
  id_forma: number;
  es_opcional: boolean;
}

export interface InstructorRow extends DbRow {
  id_instructor: number;
  nombre: string;
  fecha_contratacion?: string | null;
  activo: boolean;
  especialidad?: string | null;
  correo_electronico?: string | null;
}

export interface InstructorStyleRow extends DbRow {
  id_instructor: number;
  id_estilo: number;
}

export interface CourseRow extends DbRow {
  id_curso: number;
  nombre: string;
  tema: string;
  descripcion?: string | null;
}

export interface ScheduledCourseRow extends DbRow {
  id_curso_agendado: number;
  id_curso: number;
  id_instructor: number;
  fecha_hora: string;
  activo: boolean;
}

export interface SchoolData {
  students: StudentRow[];
  grades: GradeRow[];
  styles: StyleRow[];
  forms: FormRow[];
  studentForms: StudentFormRow[];
  gradeForms: GradeFormRow[];
  instructors: InstructorRow[];
  instructorStyles: InstructorStyleRow[];
  courses: CourseRow[];
  scheduledCourses: ScheduledCourseRow[];
}

export interface EnrichedStudent extends StudentRow {
  grade?: GradeRow;
  knownForms: FormRow[];
}

export interface EnrichedForm extends FormRow {
  style?: StyleRow;
  knownByStudents: StudentRow[];
}

export interface EnrichedGrade extends GradeRow {
  requiredForms: FormRow[];
  students: StudentRow[];
}

export interface EnrichedInstructor extends InstructorRow {
  styles: StyleRow[];
  scheduledCourses: ScheduledCourseRow[];
}

export interface EnrichedEvent extends ScheduledCourseRow {
  course?: CourseRow;
  instructor?: InstructorRow;
}
