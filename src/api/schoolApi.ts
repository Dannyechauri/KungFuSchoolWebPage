import { ApiError, apiRequest } from './http';
import type {
  CourseRow,
  DbRow,
  FormRow,
  GradeFormRow,
  GradeRow,
  InstructorRow,
  InstructorStyleRow,
  ScheduledCourseRow,
  SchoolData,
  SessionUser,
  StudentFormRow,
  StudentRow,
  StyleRow,
} from '../types/school';

function rowPayload(row: DbRow): string {
  return JSON.stringify(row);
}

export const authApi = {
  login(email: string, password: string) {
    return apiRequest<SessionUser>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  me() {
    return apiRequest<SessionUser>('/api/auth/me');
  },

  logout() {
    return apiRequest<{ authenticated: false }>('/api/auth/logout', {
      method: 'DELETE',
    });
  },
};

export const databaseApi = {
  rows<T extends DbRow>(tableName: string, limit = 1000) {
    return apiRequest<T[]>(`/api/database/tables/${encodeURIComponent(tableName)}/rows?limit=${limit}`);
  },

  async optionalRows<T extends DbRow>(tableName: string, limit = 1000) {
    try {
      return await databaseApi.rows<T>(tableName, limit);
    } catch (error) {
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        return [];
      }
      throw error;
    }
  },

  insert<T extends DbRow>(tableName: string, payload: DbRow) {
    return apiRequest<T>(`/api/database/tables/${encodeURIComponent(tableName)}/rows`, {
      method: 'POST',
      body: rowPayload(payload),
    });
  },

  update<T extends DbRow>(tableName: string, rowId: string | number, payload: DbRow) {
    return apiRequest<T>(`/api/database/tables/${encodeURIComponent(tableName)}/rows/${encodeURIComponent(rowId)}`, {
      method: 'PUT',
      body: rowPayload(payload),
    });
  },

  delete(tableName: string, rowId: string | number) {
    return apiRequest<{ deleted: boolean }>(
      `/api/database/tables/${encodeURIComponent(tableName)}/rows/${encodeURIComponent(rowId)}`,
      { method: 'DELETE' },
    );
  },
};

export async function loadSchoolData(): Promise<SchoolData> {
  /**
   * Esta función carga varias tablas en paralelo. En React la usaremos con
   * TanStack Query para que el componente no tenga que saber cuándo cachear,
   * recargar o enseñar estados de "cargando".
   */
  const [
    students,
    grades,
    styles,
    forms,
    studentForms,
    gradeForms,
    instructors,
    instructorStyles,
    courses,
    scheduledCourses,
  ] = await Promise.all([
    databaseApi.optionalRows<StudentRow>('alumnos', 5000),
    databaseApi.optionalRows<GradeRow>('grados', 1000),
    databaseApi.optionalRows<StyleRow>('estilos', 1000),
    databaseApi.optionalRows<FormRow>('formas', 3000),
    databaseApi.optionalRows<StudentFormRow>('alumno_forma', 10000),
    databaseApi.optionalRows<GradeFormRow>('grado_forma', 10000),
    databaseApi.optionalRows<InstructorRow>('instructores', 1000),
    databaseApi.optionalRows<InstructorStyleRow>('instructor_estilo', 3000),
    databaseApi.optionalRows<CourseRow>('cursos', 2000),
    databaseApi.optionalRows<ScheduledCourseRow>('cursos_agendados', 6000),
  ]);

  return {
    students,
    grades,
    styles,
    forms,
    studentForms,
    gradeForms,
    instructors,
    instructorStyles,
    courses,
    scheduledCourses,
  };
}
