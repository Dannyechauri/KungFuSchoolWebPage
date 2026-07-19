const API_URL = (process.env.VITE_API_URL ?? 'http://localhost:8080').replace(
  /\/$/,
  '',
)
const DEMO_ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL ?? 'admin.demo@iwushu.local'
const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD ?? 'password'
let authCookie = ''

const firstNames = [
  'Adriana',
  'Alejandro',
  'Alicia',
  'Álvaro',
  'Ana',
  'Bruno',
  'Carla',
  'Carlos',
  'Clara',
  'Daniel',
  'David',
  'Elena',
  'Eva',
  'Ferran',
  'Gabriel',
  'Helena',
  'Hugo',
  'Irene',
  'Javier',
  'Jing',
  'Laia',
  'Laura',
  'Lucía',
  'Marc',
  'Marina',
  'Marta',
  'Miguel',
  'Nora',
  'Pablo',
  'Pau',
  'Raquel',
  'Rocío',
  'Sergio',
  'Sílvia',
  'Sofía',
  'Tomás',
  'Víctor',
  'Wei',
  'Xavier',
  'Yolanda',
]

const paternalSurnames = [
  'Álvarez',
  'Blanch',
  'Chen',
  'Costa',
  'Domènech',
  'Ferrer',
  'García',
  'Giménez',
  'Gómez',
  'Hernández',
  'Iglesias',
  'Jiménez',
  'Li',
  'López',
  'Martí',
  'Martínez',
  'Molina',
  'Morales',
  'Navarro',
  'Ortega',
]

const maternalSurnames = [
  'Benet',
  'Campos',
  'Cano',
  'Castro',
  'Díaz',
  'Esteve',
  'Flores',
  'Gil',
  'Guerrero',
  'Marín',
  'Miró',
  'Muñoz',
  'Pérez',
  'Puig',
  'Ramos',
  'Roca',
  'Ruiz',
  'Sánchez',
  'Soler',
  'Vidal',
]

const streetNames = [
  'Mallorca',
  'Aragó',
  'València',
  'Consell de Cent',
  'Provença',
  'Rosselló',
  'Balmes',
  'Muntaner',
  'Sardenya',
  'Marina',
]

const styleSeeds = [
  ['Ving Tsun', 'Sistema directo basado en estructura, sensibilidad y distancia corta'],
  ['Jungar', 'Trabajo tradicional de fuerza, disciplina y coordinación'],
  ['Shaolin', 'Estilo externo de base amplia, potencia y formas tradicionales'],
  ['Tai Chi Chuan', 'Estilo interno centrado en estructura, fluidez y escucha'],
  ['Xing-I Chuan', 'Estilo interno de desplazamiento directo y cinco elementos'],
  ['Pa Kua Chang', 'Trabajo circular, cambios de palma y desplazamiento continuo'],
  ['Hung Gar', 'Sistema del sur con posiciones sólidas y potencia corta'],
  ['Choy Li Fut', 'Sistema dinámico de técnicas circulares y largo alcance'],
]

const formNamesByStyle = {
  'Ving Tsun': ['Siu Nim Tao', 'Chum Kiu', 'Biu Jee', 'Muk Yan Jong', 'Luk Dim Boon Gwun'],
  Jungar: ['Fundamentos Jungar', 'Puño de las cinco direcciones', 'Palma continua', 'Trabajo de bastón', 'Forma larga Jungar'],
  Shaolin: ['Lian Bu Quan', 'Gong Li Quan', 'Tan Tui', 'Xiao Hong Quan', 'Da Hong Quan'],
  'Tai Chi Chuan': ['Forma 24', 'Lao Jia Yi Lu', 'Lao Jia Er Lu', 'Espada 32', 'Abanico de Tai Chi'],
  'Xing-I Chuan': ['Wu Xing Quan', 'Pi Quan', 'Beng Quan', 'Zuan Quan', 'Pao Quan'],
  'Pa Kua Chang': ['Ba Mu Zhang', 'Lao Ba Zhang', 'Ocho palmas madre', 'Espada de Pa Kua', 'Cambio simple de palma'],
  'Hung Gar': ['Gung Ji Fuk Fu Kuen', 'Fu Hok Seung Ying Kuen', 'Tit Sin Kuen', 'Ng Ying Kuen', 'Lau Gar Kuen'],
  'Choy Li Fut': ['Siu Mui Fa Kuen', 'Sup Ji Kau Da Kuen', 'Ping Kuen', 'Ng Lun Ma', 'Mui Fa Darn Do'],
}

const gradeSeeds = [
  ['Blanco', 'Blanco'],
  ['Amarillo', 'Amarillo'],
  ['Naranja', 'Naranja'],
  ['Verde', 'Verde'],
  ['Azul', 'Azul'],
  ['Violeta', 'Violeta'],
  ['Marrón', 'Marrón'],
  ['Rojo', 'Rojo'],
  ['1.er Duan', 'Negro'],
  ['2.º Duan', 'Negro'],
]

const specialties = [
  'Shaolin del Norte',
  'Tai Chi Chuan',
  'Xing-I Chuan',
  'Pa Kua Chang',
  'Hung Gar',
  'Choy Li Fut',
]

function pad(value) {
  return String(value).padStart(2, '0')
}

function dateOnly(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function localDateTime(date) {
  return `${dateOnly(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

function slug(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '')
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authCookie ? { Cookie: authCookie } : {}),
    },
    ...options,
  })

  const setCookie = response.headers.get('set-cookie')
  if (setCookie) {
    authCookie = setCookie.split(';')[0]
  }

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${options.method ?? 'GET'} ${path}: ${response.status} ${body}`)
  }

  return response.json()
}

async function loginDemoAdmin() {
  try {
    await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: DEMO_ADMIN_EMAIL,
        password: DEMO_ADMIN_PASSWORD,
      }),
    })
    console.log(`Sesión demo iniciada como ${DEMO_ADMIN_EMAIL}`)
  } catch (error) {
    if (String(error.message).includes('404')) {
      return
    }

    throw error
  }
}

function rows(tableName) {
  return request(`/api/database/tables/${tableName}/rows?limit=500`)
}

function tables() {
  return request('/api/database/tables')
}

function insert(tableName, payload) {
  return request(`/api/database/tables/${tableName}/rows`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

async function ensureEmptyDemoDatabase(existingTables) {
  const protectedTables = [
    'personas',
    'alumnos',
    'instructores',
    'usuarios',
    'formas',
    'grado_forma',
    'alumno_forma',
    'cursos',
    'cursos_agendados',
    'inscripciones',
  ].filter((tableName) => existingTables.includes(tableName))

  const contents = await Promise.all(protectedTables.map(rows))
  const populated = protectedTables.filter((_, index) => contents[index].length > 0)

  if (populated.length > 0) {
    if (process.argv.includes('--if-empty')) {
      console.log(
        `Datos demo ya presentes en ${populated.join(', ')}; no se generan duplicados.`,
      )
      return false
    }

    throw new Error(
      `Seed cancelado: ya existen datos en ${populated.join(', ')}. Usa una base vacía para evitar duplicados.`,
    )
  }

  return true
}

async function seedStyles() {
  const existingStyles = await rows('estilos')
  const stylesByName = new Map(existingStyles.map((style) => [style.nombre, style]))

  for (const [nombre, descripcion] of styleSeeds) {
    if (!stylesByName.has(nombre)) {
      const style = await insert('estilos', { nombre, descripcion })
      stylesByName.set(style.nombre, style)
    }
  }

  return styleSeeds.map(([name]) => stylesByName.get(name))
}

function buildPersonSeeds() {
  return Array.from({ length: 40 }, (_, index) => {
    const nombre = firstNames[index]
    const apellidoPaterno = paternalSurnames[index % paternalSurnames.length]
    const apellidoMaterno = maternalSurnames[(index * 3) % maternalSurnames.length]
    const birthDate = new Date(
      1970 + ((index * 7) % 35),
      (index * 5) % 12,
      2 + ((index * 3) % 25),
    )

    return {
      nombre,
      apellido_paterno: apellidoPaterno,
      apellido_materno: apellidoMaterno,
      nombre_completo: [nombre, apellidoPaterno, apellidoMaterno].join(' '),
      fecha_nacimiento: dateOnly(birthDate),
      telefono: `6${String(10000000 + index * 13711).slice(-8)}`,
      email: `${slug(nombre)}.${slug(apellidoPaterno)}${index + 1}@demo.iwushu.local`,
      direccion: `Carrer de ${streetNames[index % streetNames.length]}, ${18 + index}`,
    }
  })
}

async function seedPeople(personSeeds) {
  const people = []

  for (const personSeed of personSeeds) {
    people.push(
      await insert('personas', {
        nombre: personSeed.nombre,
        apellido_paterno: personSeed.apellido_paterno,
        apellido_materno: personSeed.apellido_materno,
        fecha_nacimiento: personSeed.fecha_nacimiento,
        telefono: personSeed.telefono,
        email: personSeed.email,
        direccion: personSeed.direccion,
      }),
    )
  }

  return people
}

async function seedStudents(personSeeds, people, grades, hasPeopleTable) {
  const students = []

  for (let index = 0; index < 30; index += 1) {
    const joined = new Date(2017 + (index % 9), (index * 2) % 12, 1 + (index % 24))
    const personSeed = personSeeds[index]
    const grade = grades[index % grades.length]
    const commonPayload = {
      numero_matricula: `IW-${joined.getFullYear()}-${String(index + 1).padStart(3, '0')}`,
      fecha_ingreso: dateOnly(joined),
      activo: index < 27,
    }

    const payload = hasPeopleTable
      ? {
          id_alumno: people[index].id_persona,
          ...commonPayload,
        }
      : {
          nombre: personSeed.nombre_completo,
          fecha_nacimiento: personSeed.fecha_nacimiento,
          id_grado: grade.id_grado,
          correo_electronico: personSeed.email,
          grupo: ['A', 'B', 'C'][index % 3],
          tutor_nombre:
            index % 4 === 0
              ? `${paternalSurnames[(index + 5) % paternalSurnames.length]} ${maternalSurnames[(index + 7) % maternalSurnames.length]}`
              : null,
          tutor_telefono:
            index % 4 === 0
              ? `6${String(20000000 + index * 17017).slice(-8)}`
              : null,
          observaciones:
            index % 9 === 0
              ? 'Pendiente revisar objetivos técnicos del trimestre.'
              : null,
          ...commonPayload,
        }

    students.push(
      await insert('alumnos', payload),
    )
  }

  return students
}

async function seedInstructors(students, personSeeds, hasPeopleTable) {
  const instructors = []

  for (let index = 0; index < 6; index += 1) {
    const student = students[index]
    const payload = hasPeopleTable
      ? {
          id_instructor: student.id_alumno,
          fecha_contratacion: `${2015 + index}-09-01`,
          activo: true,
          especialidad: specialties[index],
        }
      : {
          nombre: student.nombre ?? personSeeds[index].nombre_completo,
          fecha_contratacion: `${2015 + index}-09-01`,
          activo: true,
          especialidad: specialties[index],
          cinturon_actual: ['Negro', 'Negro 2.º Duan', 'Negro', 'Marrón', 'Negro', 'Negro'][index],
        }

    instructors.push(
      await insert('instructores', payload),
    )
  }

  return instructors
}

async function seedAdministrators(personSeeds, people, hasPeopleTable) {
  const administrators = []

  for (let index = 36; index < 40; index += 1) {
    const payload = hasPeopleTable
      ? {
          id_administrador: people[index].id_persona,
          fecha_inicio: `${2020 + (index % 4)}-09-01`,
        }
      : {
          nombre: personSeeds[index].nombre_completo,
          fecha_inicio: `${2020 + (index % 4)}-09-01`,
          rfc: null,
        }

    administrators.push(
      await insert('administradores', payload),
    )
  }

  return administrators
}

async function seedUsers(people, hasUsersTable) {
  if (!hasUsersTable) {
    return []
  }

  const userPeople = [...people.slice(0, 30), ...people.slice(36, 40)]
  const users = []
  const demoHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

  for (const [index, person] of userPeople.entries()) {
    const isAdministrator = index >= 30
    const role = isAdministrator ? 'administrador' : index < 6 ? 'instructor' : 'alumno'
    users.push(
      await insert('usuarios', {
        id_persona: person.id_persona,
        username: `${slug(person.nombre)}.${slug(person.apellido_paterno)}${index + 1}`,
        password_hash: demoHash,
        rol: role,
        activo: index !== 29,
      }),
    )
  }

  return users
}

async function seedForms(styles) {
  const forms = []

  for (const style of styles) {
    for (const formName of formNamesByStyle[style.nombre]) {
      forms.push(
        await insert('formas', {
          id_estilo: style.id_estilo,
          nombre: formName,
          descripcion: `Forma de ${style.nombre} incluida en el programa técnico de la escuela`,
        }),
      )
    }
  }

  return forms
}

async function seedGrades() {
  const existingGrades = await rows('grados')
  const gradesByName = new Map(existingGrades.map((grade) => [grade.nombre, grade]))
  let nextOrder =
    existingGrades.reduce(
      (maxOrder, grade) => Math.max(maxOrder, Number(grade.orden_grado) || 0),
      0,
    ) + 1

  for (const [index, [name, beltColor]] of gradeSeeds.entries()) {
    if (!gradesByName.has(name)) {
      const grade = await insert('grados', {
        nombre: name,
        orden_grado: nextOrder,
        color_cinturon: beltColor,
        formas_requeridas: Math.min(4, Math.floor(index / 2) + 1),
      })
      gradesByName.set(grade.nombre, grade)
      nextOrder += 1
    }
  }

  return gradeSeeds.map(([name]) => gradesByName.get(name))
}

async function seedGradeForms(grades, forms) {
  const links = []

  for (const [gradeIndex, grade] of grades.entries()) {
    for (let offset = 0; offset < 4; offset += 1) {
      const form = forms[(gradeIndex * 3 + offset) % forms.length]
      links.push(
        await insert('grado_forma', {
          id_grado: grade.id_grado,
          id_forma: form.id_forma,
          es_opcional: offset === 3,
        }),
      )
    }
  }

  return links
}

async function seedStudentForms(students, forms, grades, gradeForms) {
  const links = []
  const requiredFormsByGrade = new Map()

  gradeForms
    .filter((relation) => !relation.es_opcional)
    .forEach((relation) => {
      const requiredForms = requiredFormsByGrade.get(relation.id_grado) ?? []
      requiredForms.push(relation.id_forma)
      requiredFormsByGrade.set(relation.id_grado, requiredForms)
    })

  for (const [studentIndex, student] of students.entries()) {
    const targetGrade = grades[studentIndex % grades.length]
    const requiredForms = requiredFormsByGrade.get(targetGrade.id_grado) ?? []
    const additionalForm = forms[(studentIndex * 7 + 5) % forms.length].id_forma
    const learnedForms = [...new Set([...requiredForms, additionalForm])]

    for (const [formIndex, formId] of learnedForms.entries()) {
      const learnedDate = new Date(
        2021 + (studentIndex % 5),
        (studentIndex * 3 + formIndex) % 12,
        2 + ((studentIndex + formIndex) % 24),
      )
      links.push(
        await insert('alumno_forma', {
          id_alumno: student.id_alumno,
          id_forma: formId,
          fecha_aprendida: dateOnly(learnedDate),
        }),
      )
    }
  }

  return links
}

async function seedInstructorStyles(instructors, styles, hasInstructorStyleTable) {
  if (!hasInstructorStyleTable) {
    return []
  }

  const links = []

  for (const [index, instructor] of instructors.entries()) {
    const primaryStyle = styles[index % styles.length]
    const secondaryStyle = styles[(index + 3) % styles.length]

    for (const style of [primaryStyle, secondaryStyle]) {
      links.push(
        await insert('instructor_estilo', {
          id_instructor: instructor.id_instructor,
          id_estilo: style.id_estilo,
        }),
      )
    }
  }

  return links
}

async function seedCourses(instructors, styles, hasScheduledCoursesTable) {
  const courses = []
  const scheduledCourses = []
  const now = new Date()

  for (let index = 0; index < 30; index += 1) {
    const style = styles[index % styles.length]
    const scheduledAt = new Date(now)
    scheduledAt.setDate(now.getDate() + index * 3 - 18)
    scheduledAt.setHours(index % 3 === 0 ? 10 : 19, index % 2 === 0 ? 0 : 30, 0, 0)
    const courseNames = [
      `Fundamentos de ${style.nombre}`,
      `Aplicaciones de ${style.nombre}`,
      `Entrenamiento técnico de ${style.nombre}`,
    ]

    const course = await insert('cursos', {
        nombre: courseNames[index % courseNames.length],
        tema: index % 4 === 0 ? 'Seminario' : index % 4 === 1 ? 'Clase técnica' : index % 4 === 2 ? 'Práctica guiada' : 'Intensivo',
        descripcion: `Sesión dedicada al trabajo progresivo y aplicaciones de ${style.nombre}.`,
        ...(hasScheduledCoursesTable
          ? {}
          : {
              id_instructor: instructors[index % instructors.length].id_instructor,
              fecha_hora: localDateTime(scheduledAt),
            }),
      })

    courses.push(course)

    if (hasScheduledCoursesTable) {
      scheduledCourses.push(
        await insert('cursos_agendados', {
          id_curso: course.id_curso,
          id_instructor: instructors[index % instructors.length].id_instructor,
          fecha_hora: localDateTime(scheduledAt),
          activo: true,
        }),
      )
    }
  }

  return { courses, scheduledCourses }
}

async function seedEnrollments(students, courseTargets, hasScheduledCoursesTable) {
  const enrollments = []

  for (let index = 0; index < 40; index += 1) {
    const studentIndex = index % students.length
    const courseIndex = index < 30 ? (index * 7) % courseTargets.length : ((index - 30) * 7 + 1) % courseTargets.length
    const enrolledAt = new Date()
    enrolledAt.setDate(enrolledAt.getDate() - (index % 45))

    enrollments.push(
      await insert('inscripciones', {
        id_alumno: students[studentIndex].id_alumno,
        ...(hasScheduledCoursesTable
          ? { id_curso_agendado: courseTargets[courseIndex].id_curso_agendado }
          : { id_curso: courseTargets[courseIndex].id_curso }),
        fecha_inscripcion: dateOnly(enrolledAt),
        estado: index % 13 === 0 ? 'inactiva' : 'activa',
      }),
    )
  }

  return enrollments
}

async function main() {
  console.log(`Generando datos demo mediante ${API_URL}...`)
  await loginDemoAdmin()
  const existingTables = await tables()
  const hasPeopleTable = existingTables.includes('personas')
  const hasUsersTable = existingTables.includes('usuarios')
  const hasScheduledCoursesTable = existingTables.includes('cursos_agendados')
  const hasInstructorStyleTable = existingTables.includes('instructor_estilo')
  const databaseIsEmpty = await ensureEmptyDemoDatabase(existingTables)

  if (!databaseIsEmpty) {
    return
  }

  const personSeeds = buildPersonSeeds()
  const styles = await seedStyles()
  const forms = await seedForms(styles)
  const grades = await seedGrades()
  const people = hasPeopleTable ? await seedPeople(personSeeds) : []
  const students = await seedStudents(personSeeds, people, grades, hasPeopleTable)
  const instructors = await seedInstructors(students, personSeeds, hasPeopleTable)
  const administrators = await seedAdministrators(
    personSeeds,
    people,
    hasPeopleTable,
  )
  const users = await seedUsers(people, hasUsersTable)
  const instructorStyles = await seedInstructorStyles(
    instructors,
    styles,
    hasInstructorStyleTable,
  )
  const gradeForms = await seedGradeForms(grades, forms)
  const studentForms = await seedStudentForms(
    students,
    forms,
    grades,
    gradeForms,
  )
  const { courses, scheduledCourses } = await seedCourses(
    instructors,
    styles,
    hasScheduledCoursesTable,
  )
  const enrollments = await seedEnrollments(
    students,
    hasScheduledCoursesTable ? scheduledCourses : courses,
    hasScheduledCoursesTable,
  )

  console.table({
    personas: people.length,
    alumnos: students.length,
    instructores: instructors.length,
    administradores: administrators.length,
    usuarios: users.length,
    instructor_estilo: instructorStyles.length,
    estilos: styles.length,
    formas: forms.length,
    grados: grades.length,
    grado_forma: gradeForms.length,
    alumno_forma: studentForms.length,
    cursos: courses.length,
    cursos_agendados: scheduledCourses.length,
    inscripciones: enrollments.length,
  })
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
