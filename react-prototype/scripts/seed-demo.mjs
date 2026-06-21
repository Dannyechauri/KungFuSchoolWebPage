const API_URL = (process.env.VITE_API_URL ?? 'http://localhost:8080').replace(
  /\/$/,
  '',
)

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
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${options.method ?? 'GET'} ${path}: ${response.status} ${body}`)
  }

  return response.json()
}

function rows(tableName) {
  return request(`/api/database/tables/${tableName}/rows?limit=500`)
}

function insert(tableName, payload) {
  return request(`/api/database/tables/${tableName}/rows`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

async function ensureEmptyDemoDatabase() {
  const protectedTables = [
    'personas',
    'alumnos',
    'instructores',
    'administradores',
    'usuarios',
    'formas',
    'grados',
    'grado_forma',
    'alumno_forma',
    'cursos',
    'inscripciones',
  ]

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

async function seedPeople() {
  const people = []

  for (let index = 0; index < 40; index += 1) {
    const nombre = firstNames[index]
    const apellidoPaterno = paternalSurnames[index % paternalSurnames.length]
    const apellidoMaterno = maternalSurnames[(index * 3) % maternalSurnames.length]
    const birthDate = new Date(1970 + ((index * 7) % 35), (index * 5) % 12, 2 + ((index * 3) % 25))

    people.push(
      await insert('personas', {
        nombre,
        apellido_paterno: apellidoPaterno,
        apellido_materno: apellidoMaterno,
        fecha_nacimiento: dateOnly(birthDate),
        telefono: `6${String(10000000 + index * 13711).slice(-8)}`,
        email: `${slug(nombre)}.${slug(apellidoPaterno)}${index + 1}@demo.iwushu.local`,
        direccion: `Carrer de ${streetNames[index % streetNames.length]}, ${18 + index}`,
      }),
    )
  }

  return people
}

async function seedStudents(people) {
  const students = []

  for (let index = 0; index < 30; index += 1) {
    const joined = new Date(2017 + (index % 9), (index * 2) % 12, 1 + (index % 24))
    students.push(
      await insert('alumnos', {
        id_alumno: people[index].id_persona,
        numero_matricula: `IW-${joined.getFullYear()}-${String(index + 1).padStart(3, '0')}`,
        fecha_ingreso: dateOnly(joined),
        activo: index < 27,
      }),
    )
  }

  return students
}

async function seedInstructors(students) {
  const instructors = []

  for (let index = 0; index < 6; index += 1) {
    instructors.push(
      await insert('instructores', {
        id_instructor: students[index].id_alumno,
        fecha_contratacion: `${2015 + index}-09-01`,
        activo: true,
        especialidad: specialties[index],
      }),
    )
  }

  return instructors
}

async function seedAdministrators(people) {
  const administrators = []

  for (let index = 36; index < 40; index += 1) {
    administrators.push(
      await insert('administradores', {
        id_administrador: people[index].id_persona,
        fecha_inicio: `${2020 + (index % 4)}-09-01`,
      }),
    )
  }

  return administrators
}

async function seedUsers(people) {
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
  const grades = []

  for (const [index, [name, beltColor]] of gradeSeeds.entries()) {
    grades.push(
      await insert('grados', {
        nombre: name,
        orden_grado: index + 1,
        color_cinturon: beltColor,
        formas_requeridas: Math.min(4, Math.floor(index / 2) + 1),
      }),
    )
  }

  return grades
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

async function seedCourses(instructors, styles) {
  const courses = []
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

    courses.push(
      await insert('cursos', {
        id_instructor: instructors[index % instructors.length].id_instructor,
        nombre: courseNames[index % courseNames.length],
        tema: index % 4 === 0 ? 'Seminario' : index % 4 === 1 ? 'Clase técnica' : index % 4 === 2 ? 'Práctica guiada' : 'Intensivo',
        descripcion: `Sesión dedicada al trabajo progresivo y aplicaciones de ${style.nombre}.`,
        fecha_hora: localDateTime(scheduledAt),
      }),
    )
  }

  return courses
}

async function seedEnrollments(students, courses) {
  const enrollments = []

  for (let index = 0; index < 40; index += 1) {
    const studentIndex = index % students.length
    const courseIndex = index < 30 ? (index * 7) % courses.length : ((index - 30) * 7 + 1) % courses.length
    const enrolledAt = new Date()
    enrolledAt.setDate(enrolledAt.getDate() - (index % 45))

    enrollments.push(
      await insert('inscripciones', {
        id_alumno: students[studentIndex].id_alumno,
        id_curso: courses[courseIndex].id_curso,
        fecha_inscripcion: dateOnly(enrolledAt),
        estado: index % 13 === 0 ? 'inactiva' : 'activa',
      }),
    )
  }

  return enrollments
}

async function main() {
  console.log(`Generando datos demo mediante ${API_URL}...`)
  const databaseIsEmpty = await ensureEmptyDemoDatabase()

  if (!databaseIsEmpty) {
    return
  }

  const styles = await seedStyles()
  const people = await seedPeople()
  const students = await seedStudents(people)
  const instructors = await seedInstructors(students)
  const administrators = await seedAdministrators(people)
  const users = await seedUsers(people)
  const forms = await seedForms(styles)
  const grades = await seedGrades()
  const gradeForms = await seedGradeForms(grades, forms)
  const studentForms = await seedStudentForms(
    students,
    forms,
    grades,
    gradeForms,
  )
  const courses = await seedCourses(instructors, styles)
  const enrollments = await seedEnrollments(students, courses)

  console.table({
    personas: people.length,
    alumnos: students.length,
    instructores: instructors.length,
    administradores: administrators.length,
    usuarios: users.length,
    estilos: styles.length,
    formas: forms.length,
    grados: grades.length,
    grado_forma: gradeForms.length,
    alumno_forma: studentForms.length,
    cursos: courses.length,
    inscripciones: enrollments.length,
  })
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
