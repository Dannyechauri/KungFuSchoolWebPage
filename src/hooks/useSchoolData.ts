import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadSchoolData } from '../api/schoolApi';
import type {
  EnrichedEvent,
  EnrichedForm,
  EnrichedGrade,
  EnrichedInstructor,
  EnrichedStudent,
  FormRow,
  GradeRow,
  InstructorRow,
  SchoolData,
  StudentRow,
  StyleRow,
} from '../types/school';

const emptySchoolData: SchoolData = {
  students: [],
  grades: [],
  styles: [],
  forms: [],
  studentForms: [],
  gradeForms: [],
  instructors: [],
  instructorStyles: [],
  courses: [],
  scheduledCourses: [],
};

function byId<T>(rows: T[], getId: (row: T) => number) {
  return new Map(rows.map((row) => [getId(row), row]));
}

export function useSchoolData() {
  /**
   * TanStack Query separa la carga de datos de la pantalla.
   * El componente pregunta por `school-data`; la librería decide si puede
   * devolver caché, si debe recargar, y cómo exponer loading/error.
   */
  const query = useQuery({
    queryKey: ['school-data'],
    queryFn: loadSchoolData,
  });

  const data = query.data ?? emptySchoolData;

  const derived = useMemo(() => {
    const gradeById = byId<GradeRow>(data.grades, (grade) => Number(grade.id_grado));
    const styleById = byId<StyleRow>(data.styles, (style) => Number(style.id_estilo));
    const formById = byId<FormRow>(data.forms, (form) => Number(form.id_forma));
    const studentById = byId<StudentRow>(data.students, (student) => Number(student.id_alumno));
    const instructorById = byId<InstructorRow>(
      data.instructors,
      (instructor) => Number(instructor.id_instructor),
    );
    const courseById = byId(data.courses, (course) => Number(course.id_curso));

    const students: EnrichedStudent[] = data.students.map((student) => {
      const knownForms = data.studentForms
        .filter((link) => Number(link.id_alumno) === Number(student.id_alumno))
        .map((link) => formById.get(Number(link.id_forma)))
        .filter((form): form is FormRow => Boolean(form));

      return {
        ...student,
        grade: gradeById.get(Number(student.id_grado)),
        knownForms,
      };
    });

    const forms: EnrichedForm[] = data.forms.map((form) => {
      const knownByStudents = data.studentForms
        .filter((link) => Number(link.id_forma) === Number(form.id_forma))
        .map((link) => studentById.get(Number(link.id_alumno)))
        .filter((student): student is StudentRow => Boolean(student));

      return {
        ...form,
        style: styleById.get(Number(form.id_estilo)),
        knownByStudents,
      };
    });

    const grades: EnrichedGrade[] = data.grades
      .map((grade) => {
        const requiredForms = data.gradeForms
          .filter((link) => Number(link.id_grado) === Number(grade.id_grado))
          .map((link) => formById.get(Number(link.id_forma)))
          .filter((form): form is FormRow => Boolean(form));

        return {
          ...grade,
          requiredForms,
          students: data.students.filter((student) => Number(student.id_grado) === Number(grade.id_grado)),
        };
      })
      .sort((left, right) => Number(left.orden_grado) - Number(right.orden_grado));

    const instructors: EnrichedInstructor[] = data.instructors.map((instructor) => {
      const styles = data.instructorStyles
        .filter((link) => Number(link.id_instructor) === Number(instructor.id_instructor))
        .map((link) => styleById.get(Number(link.id_estilo)))
        .filter((style): style is StyleRow => Boolean(style));

      return {
        ...instructor,
        styles,
        scheduledCourses: data.scheduledCourses.filter(
          (course) => Number(course.id_instructor) === Number(instructor.id_instructor),
        ),
      };
    });

    const events: EnrichedEvent[] = data.scheduledCourses
      .map((event) => ({
        ...event,
        course: courseById.get(Number(event.id_curso)),
        instructor: instructorById.get(Number(event.id_instructor)),
      }))
      .sort((left, right) => new Date(left.fecha_hora).getTime() - new Date(right.fecha_hora).getTime());

    return {
      gradeById,
      styleById,
      formById,
      studentById,
      instructorById,
      courseById,
      students,
      forms,
      grades,
      instructors,
      events,
    };
  }, [data]);

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    data,
    styles: data.styles,
    courses: data.courses,
    studentForms: data.studentForms,
    gradeForms: data.gradeForms,
    ...derived,
  };
}
