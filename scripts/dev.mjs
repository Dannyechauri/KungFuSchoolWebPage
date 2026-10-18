import { createServer as createNetServer } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import bcrypt from 'bcryptjs';
import pg from 'pg';
import { createServer as createViteServer } from 'vite';

const { Client } = pg;
const DATABASE_NAME = 'kungfu_school_dev';
const DATABASE_COMMENT = 'instituto-wushu:development:v1';
const SEED_VERSION = 'school-data-v6-multi-session-courses';
const FRONT_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND_DIRECTORY = path.resolve(FRONT_DIRECTORY, '../KungFuBackendService/backend-service');
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

let backendProcess;
let viteServer;
let closing = false;

function readDevelopmentEnvironment() {
  const environmentPath = path.join(FRONT_DIRECTORY, '.env.dev.local');
  if (!existsSync(environmentPath)) return {};

  const parsed = {};
  for (const rawLine of readFileSync(environmentPath, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) throw new Error(`La línea "${rawLine}" de .env.dev.local no tiene formato NOMBRE=valor.`);
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    parsed[key] = value;
  }
  return parsed;
}

function getConfiguration() {
  const localEnvironment = readDevelopmentEnvironment();
  const value = (key, fallback = '') => process.env[key] ?? localEnvironment[key] ?? fallback;
  const host = value('DEV_DB_HOST', '127.0.0.1').toLowerCase();
  const port = Number(value('DEV_DB_PORT', '5432'));
  if (!LOCAL_HOSTS.has(host)) throw new Error('DEV_DB_HOST debe ser localhost, 127.0.0.1 o ::1. El lanzador no crea bases de datos remotas.');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('DEV_DB_PORT debe ser un puerto válido.');
  return {
    host,
    port,
    user: value('DEV_DB_USER', process.platform === 'win32' ? 'postgres' : userInfo().username),
    password: value('DEV_DB_PASSWORD'),
  };
}

function databaseOptions(configuration, database) {
  return { host: configuration.host, port: configuration.port, user: configuration.user, password: configuration.password || undefined, database, connectionTimeoutMillis: 8_000 };
}

async function withClient(configuration, database, callback) {
  const client = new Client(databaseOptions(configuration, database));
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function prepareDevelopmentDatabase(configuration) {
  await withClient(configuration, 'postgres', async (client) => {
    const result = await client.query('SELECT description FROM pg_database LEFT JOIN pg_shdescription ON objoid = pg_database.oid WHERE datname = $1', [DATABASE_NAME]);
    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE ${DATABASE_NAME}`);
      await client.query(`COMMENT ON DATABASE ${DATABASE_NAME} IS '${DATABASE_COMMENT}'`);
      console.log(`Base de datos de desarrollo creada: ${DATABASE_NAME}`);
      return;
    }
    if (result.rows[0].description !== DATABASE_COMMENT) throw new Error(`La base ${DATABASE_NAME} ya existe pero no pertenece a este entorno de desarrollo. No se ha modificado.`);
    console.log(`Base de datos de desarrollo encontrada: ${DATABASE_NAME}`);
  });
}


async function resetDevelopmentDatabase(configuration) {
  await withClient(configuration, 'postgres', async (client) => {
    const result = await client.query('SELECT description FROM pg_database LEFT JOIN pg_shdescription ON objoid = pg_database.oid WHERE datname = $1', [DATABASE_NAME]);
    if (result.rowCount === 0) {
      console.log('No existe una base de desarrollo previa: ' + DATABASE_NAME);
      return;
    }
    if (result.rows[0].description !== DATABASE_COMMENT) throw new Error('La base ' + DATABASE_NAME + ' no pertenece a este entorno de desarrollo. No se ha eliminado.');
    await client.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [DATABASE_NAME]);
    await client.query('DROP DATABASE ' + DATABASE_NAME);
    console.log('Base de datos de desarrollo eliminada: ' + DATABASE_NAME);
  });
}

async function assertPortFree(port) {
  await new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once('error', () => reject(new Error(`El puerto ${port} ya está ocupado. Cierra el proceso que lo usa antes de ejecutar npm run dev.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

function startBackend(configuration) {
  if (!existsSync(BACKEND_DIRECTORY)) throw new Error(`No se ha encontrado el backend en ${BACKEND_DIRECTORY}. Comprueba que el submódulo esté inicializado.`);
  const databaseUrl = new URL('postgresql://localhost');
  databaseUrl.hostname = configuration.host;
  databaseUrl.port = String(configuration.port);
  databaseUrl.username = configuration.user;
  if (configuration.password) databaseUrl.password = configuration.password;
  databaseUrl.pathname = '/' + DATABASE_NAME;
  const environment = {
    ...process.env,
    NODE_ENV: 'development',
    HOST: '127.0.0.1',
    PORT: '8080',
    DATABASE_URL: databaseUrl.toString(),
    DB_HOST: configuration.host,
    DB_PORT: String(configuration.port),
    DB_NAME: DATABASE_NAME,
    DB_USER: configuration.user,
    DB_PASSWORD: configuration.password,
    COOKIE_SECURE: 'false',
    CORS_ORIGINS: 'http://127.0.0.1:8000,http://localhost:8000',
  };
  const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'sh';
  const argumentsForCommand = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm.cmd run dev']
    : ['-c', 'npm run dev'];
  const child = spawn(command, argumentsForCommand, { cwd: BACKEND_DIRECTORY, env: environment, stdio: 'inherit', detached: process.platform !== 'win32' });
  child.once('error', (error) => console.error(`No se ha podido arrancar el backend: ${error.message}`));
  return child;
}

async function waitForBackend(child) {
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`El backend terminó durante el arranque (código ${child.exitCode}).`);
    try {
      const response = await fetch('http://127.0.0.1:8080/api/database/health');
      if (response.ok) {
        console.log('Backend disponible en http://127.0.0.1:8080');
        return;
      }
    } catch {
      // El backend Node todavía está arrancando.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('El backend no ha estado disponible en cinco minutos. Revisa el registro anterior.');
}

function dateTimeAt(dayOffset, hour, minute = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

function dateTimeOnWeekday(weekOffset, weekday, hour, minute = 0) {
  const today = new Date();
  const currentWeekday = (today.getDay() + 6) % 7;
  return dateTimeAt((weekOffset * 7) + weekday - currentWeekday, hour, minute);
}

function addMinutesToLocal(dateTime, minutes) {
  const date = new Date(`${dateTime}Z`);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}T${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}:${String(date.getUTCSeconds()).padStart(2, '0')}`;
}


function birthdayFor(index) {
  const year = 1968 + ((index * 3) % 45);
  const month = ((index * 7) % 12) + 1;
  const day = ((index * 11) % 27) + 1;
  return String(year) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function joinedAtFor(index) {
  const year = 2020 + (index % 7);
  const month = ((index * 5) % 12) + 1;
  const day = ((index * 3) % 25) + 1;
  return String(year) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

async function seedDatabase(configuration) {
  await withClient(configuration, DATABASE_NAME, async (client) => {
    await client.query('BEGIN');
    try {
      await client.query('CREATE SCHEMA IF NOT EXISTS dev_support');
      await client.query('CREATE TABLE IF NOT EXISTS dev_support.seed_state (version text PRIMARY KEY, seeded_at timestamptz NOT NULL DEFAULT now())');
      const seeded = await client.query('SELECT 1 FROM dev_support.seed_state WHERE version = $1', [SEED_VERSION]);
      if (seeded.rowCount > 0) {
        await client.query('COMMIT');
        console.log('Datos de demostración ya presentes; se conservan los cambios locales.');
        return;
      }
      const previousSeed = await client.query('SELECT version FROM dev_support.seed_state ORDER BY seeded_at DESC LIMIT 1');
      if (previousSeed.rowCount > 0) {
        throw new Error(`La base tiene el conjunto de prueba ${previousSeed.rows[0].version}. Ejecuta npm run dev:reset para crear el nuevo horario de prueba sin mezclar datos.`);
      }
      await client.query("UPDATE estilos SET nombre = 'Shaolin del Norte' WHERE nombre = 'Shaolin'");
      await client.query("UPDATE estilos SET nombre = 'Wing Chun' WHERE nombre = 'Ving Tsun'");
      await client.query("DELETE FROM estilos WHERE nombre = 'Jungar'");
      await client.query("DELETE FROM grados WHERE nombre = 'Cinta Amarilla'");

      const styles = [
        ['Shaolin del Norte', 'Shaolin del Norte (Bei Shaolin): formas largas, piernas amplias y trabajo acrobático.'],
        ['Hung Gar', 'Hung Gar o Hung Kuen: estilo sureño de posiciones firmes y trabajo de tigre y grulla.'],
        ['Taijiquan estilo Yang', 'Taijiquan de la familia Yang, de movimientos amplios y continuos.'],
        ['Wing Chun', 'Sistema de corta distancia centrado en estructura y línea central.'],
        ['Xingyiquan', 'Xingyiquan, también escrito Xing Yi Quan: cinco elementos y doce animales.'],
        ['Tanglangquan', 'Tanglangquan o Mantis religiosa: manos rápidas y cambios de ritmo.'],
        ['Baguazhang', 'Baguazhang: palmas y desplazamiento circular.'],
        ['Bajiquan', 'Bajiquan: potencia explosiva a muy poca distancia.'],
      ];
      const styleIds = new Map();
      for (const [name, description] of styles) {
        const result = await client.query('INSERT INTO estilos (nombre, descripcion) VALUES ($1, $2) ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion RETURNING id_estilo', [name, description]);
        styleIds.set(name, result.rows[0].id_estilo);
      }
      const curricula = [
        ['Shaolin del Norte', ['Lian Bu Quan', 'Gong Li Quan', 'Xiao Hong Quan', 'Da Hong Quan', 'Cha Quan'], ['Bastón (Gun)', 'Sable (Dao)', 'Espada recta (Jian)', 'Lanza (Qiang)', 'Alabarda (Pu Dao)']],
        ['Hung Gar', ['Mui Fa Kuen', 'Lau Gar Kuen', 'Gung Ji Fuk Fu Kuen', 'Fu Hok Seung Ying Kuen', 'Tit Sin Kuen'], ['Bastón largo', 'Sable mariposa', 'Lanza', 'Sable doble', 'Gancho de tigre']],
        ['Taijiquan estilo Yang', ['Forma tradicional Yang (108 movimientos)', 'Forma Yang de 49 movimientos', 'Forma Yang de 16 movimientos', 'Forma Yang de 13 movimientos', 'Forma Yang de demostración'], ['Espada (Jian)', 'Sable (Dao)', 'Abanico', 'Lanza', 'Bastón']],
        ['Wing Chun', ['Siu Nim Tao', 'Chum Kiu', 'Biu Jee'], ['Bastón largo (Luk Dim Boon Gwan)', 'Cuchillos mariposa (Baat Jaam Do)']],
        ['Xingyiquan', ['Wu Xing Quan', 'Lian Huan Quan', 'Za Shi Chui', 'Shi Er Xing', 'Ba Shi Quan'], ['Lanza', 'Sable', 'Espada', 'Bastón largo', 'Alabarda']],
        ['Tanglangquan', ['Beng Bu Quan', 'Luan Jie Quan', 'Ba Zhou', 'Zhai Yao', 'Mei Hua Lu'], ['Bastón', 'Sable', 'Espada', 'Lanza', 'Látigo de nueve secciones']],
        ['Baguazhang', ['Lao Ba Zhang', 'Ding Shi Ba Zhang', 'You Shen Ba Gua Zhang', 'Liu Shi Si Zhang', 'Tian Gan Quan'], ['Espada', 'Sable', 'Lanza', 'Bastón', 'Cuchillos de cuerno de ciervo']],
        ['Bajiquan', ['Xiao Baji', 'Da Baji'], ['Lanza', 'Bastón', 'Espada']],
      ];
      const formIds = new Map();
      for (const [styleName, emptyHandForms, weaponForms] of curricula) {
        for (const name of emptyHandForms) {
          const result = await client.query('INSERT INTO formas (id_estilo, nombre, descripcion) VALUES ($1, $2, $3) ON CONFLICT (nombre) DO UPDATE SET id_estilo = EXCLUDED.id_estilo, descripcion = EXCLUDED.descripcion RETURNING id_forma', [styleIds.get(styleName), name, 'Mano vacía · forma del currículo de ' + styleName + '.']);
          formIds.set(name, result.rows[0].id_forma);
        }
        for (const weapon of weaponForms) {
          const name = weapon + ' · ' + styleName;
          const result = await client.query('INSERT INTO formas (id_estilo, nombre, descripcion) VALUES ($1, $2, $3) ON CONFLICT (nombre) DO UPDATE SET id_estilo = EXCLUDED.id_estilo, descripcion = EXCLUDED.descripcion RETURNING id_forma', [styleIds.get(styleName), name, 'Arma · ' + weapon + '.']);
          formIds.set(name, result.rows[0].id_forma);
        }
      }
      const grades = [
        ['Cinta Blanca', 1, 'Blanco', []],
        ['Cinta Amarilla', 2, 'Amarillo', ['Lian Bu Quan', 'Siu Nim Tao']],
        ['Cinta Naranja', 3, 'Naranja', ['Gong Li Quan', 'Mui Fa Kuen', 'Forma Yang de 13 movimientos', 'Siu Nim Tao']],
        ['Cinta Verde', 4, 'Verde', ['Xiao Hong Quan', 'Lau Gar Kuen', 'Chum Kiu', 'Wu Xing Quan', 'Beng Bu Quan', 'Xiao Baji']],
        ['Cinta Azul', 5, 'Azul', ['Da Hong Quan', 'Gung Ji Fuk Fu Kuen', 'Forma Yang de 16 movimientos', 'Biu Jee', 'Lian Huan Quan', 'Luan Jie Quan', 'Lao Ba Zhang', 'Da Baji']],
        ['Cinta Marrón', 6, 'Marrón', ['Cha Quan', 'Fu Hok Seung Ying Kuen', 'Forma tradicional Yang (108 movimientos)', 'Shi Er Xing', 'Ba Zhou', 'Ding Shi Ba Zhang', 'Bastón (Gun) · Shaolin del Norte', 'Bastón largo (Luk Dim Boon Gwan) · Wing Chun', 'Lanza · Xingyiquan', 'Lanza · Bajiquan']],
        ['Cinta Negra I Dan', 7, 'Negro', ['Tit Sin Kuen', 'Forma Yang de 49 movimientos', 'Bastón largo · Hung Gar', 'Espada (Jian) · Taijiquan estilo Yang', 'Cuchillos mariposa (Baat Jaam Do) · Wing Chun', 'Espada · Xingyiquan', 'Látigo de nueve secciones · Tanglangquan', 'Cuchillos de cuerno de ciervo · Baguazhang', 'Gancho de tigre · Hung Gar', 'Sable · Baguazhang', 'Espada · Bajiquan', 'Alabarda (Pu Dao) · Shaolin del Norte']],
      ];
      const gradeIds = new Map();
      for (const [name, order, beltColor, requiredFormNames] of grades) {
        const result = await client.query('INSERT INTO grados (nombre, orden_grado, color_cinturon, formas_requeridas) VALUES ($1, $2, $3, $4) ON CONFLICT (orden_grado) DO UPDATE SET nombre = EXCLUDED.nombre, color_cinturon = EXCLUDED.color_cinturon, formas_requeridas = EXCLUDED.formas_requeridas RETURNING id_grado', [name, order, beltColor, requiredFormNames.length]);
        const gradeId = result.rows[0].id_grado;
        gradeIds.set(name, gradeId);
        for (const formName of requiredFormNames) await client.query('INSERT INTO grado_forma (id_grado, id_forma, es_opcional) VALUES ($1, $2, FALSE) ON CONFLICT DO NOTHING', [gradeId, formIds.get(formName)]);
      }

      const passwordHash = await bcrypt.hash('WushuDemo2026!', 12);
      await client.query('INSERT INTO administradores (nombre, fecha_inicio, correo_electronico, password_hash) VALUES ($1, CURRENT_DATE, $2, $3)', ['Administración de demostración', 'admin@wushu.test', passwordHash]);
      const instructors = [
        ['Marta Serra', '2018-09-01', ['Shaolin del Norte'], 'marta.serra@wushu.test'], ['Daniel Rius', '2019-01-10', ['Hung Gar'], 'daniel.rius@wushu.test'],
        ['Laia Font', '2019-09-15', ['Taijiquan estilo Yang'], 'laia.font@wushu.test'], ['Jordi Casals', '2020-02-01', ['Wing Chun'], 'jordi.casals@wushu.test'],
        ['Mei Lin', '2020-09-01', ['Xingyiquan'], 'mei.lin@wushu.test'], ['Chen Wei', '2021-01-12', ['Tanglangquan', 'Baguazhang'], 'chen.wei@wushu.test'],
        ['Sofia Rossi', '2021-09-01', ['Shaolin del Norte', 'Bajiquan'], 'sofia.rossi@wushu.test'], ['Arnau Vidal', '2022-01-10', ['Hung Gar', 'Xingyiquan'], 'arnau.vidal@wushu.test'],
        ['Lucía Martín', '2022-09-15', ['Taijiquan estilo Yang', 'Baguazhang'], 'lucia.martin@wushu.test'], ['Zhang Wei', '2023-02-15', ['Wing Chun', 'Tanglangquan'], 'zhang.wei@wushu.test'],
      ];
      const instructorIds = [];
      for (const [name, hiredAt, specialties, email] of instructors) {
        const result = await client.query('INSERT INTO instructores (nombre, fecha_contratacion, activo, especialidad, correo_electronico, password_hash) VALUES ($1, $2, TRUE, $3, $4, $5) RETURNING id_instructor', [name, hiredAt, specialties.join(' · '), email, passwordHash]);
        const instructorId = result.rows[0].id_instructor;
        instructorIds.push(instructorId);
        for (const styleName of specialties) await client.query('INSERT INTO instructor_estilo (id_instructor, id_estilo) VALUES ($1, $2)', [instructorId, styleIds.get(styleName)]);
      }

      const studentNames = [
        'Aina Puig', 'Marc Soler', 'Núria Vidal', 'Pau Ferrer', 'Laia Bosch', 'Jordi Pons', 'Carla Miró', 'Arnau Roca', 'Júlia Serra', 'Oriol Martí',
        'Berta Casas', 'Biel Navarro', 'Clara Prat', 'Gerard Vila', 'Mariona Costa', 'Pol Mas', 'Eva Sala', 'Ferran Puig', 'Sílvia Grau', 'Nil Comas',
        'Mireia Rius', 'Joan Esteve', 'Alba Fuster', 'Xavier Llorens', 'Irene Batlle', 'Sofía Rossi', 'Luca Bianchi', 'Elena Popescu', 'Andrei Ionescu', 'Marie Dubois',
        'Lucas Martin', 'Anna Kowalska', 'Tomasz Nowak', 'Hannah Müller', 'Jonas Weber', 'Inês Silva', 'Tiago Santos', 'Aoife Murphy', 'Klara Novak', 'Marek Horvat',
        'Li Wei', 'Wang Fang', 'Zhang Min', 'Chen Jie', 'Liu Yang', 'Zhao Lin', 'Xu Mei', 'Huang Tao', 'Zhou Yan', 'Wu Qiang',
      ];
      const studentIds = [];
      for (const [index, name] of studentNames.entries()) {
        const grade = grades[(index % (grades.length - 1)) + 1];
        const result = await client.query('INSERT INTO alumnos (numero_matricula, fecha_ingreso, activo, fecha_nacimiento, id_grado, correo_electronico, password_hash, nombre) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_alumno', ['WSB-' + String(index + 1).padStart(3, '0'), joinedAtFor(index), index % 13 !== 0, birthdayFor(index), gradeIds.get(grade[0]), 'alumno.' + String(index + 1).padStart(2, '0') + '@wushu.test', passwordHash, name]);
        studentIds.push(result.rows[0].id_alumno);
        for (const formName of grade[3].slice(0, Math.min(grade[3].length, 2 + (index % 4)))) await client.query('INSERT INTO alumno_forma (id_alumno, id_forma, fecha_aprendida) VALUES ($1, $2, $3)', [result.rows[0].id_alumno, formIds.get(formName), joinedAtFor(Math.max(0, index - 2))]);
      }

      const courses = [
        ['Clase diaria · mañana', 'Clase diaria', 'Clase regular de mañana para práctica técnica general.', 'HABITUAL'],
        ['Clase diaria · tarde', 'Clase diaria', 'Clase regular de tarde para práctica técnica general.', 'HABITUAL'],
        ['Formas y técnica', 'Formas y técnica', 'Estudio de formas y técnica de los estilos impartidos por la escuela.', 'HABITUAL'],
        ['Preparación física para estilos', 'Preparación física', 'Movilidad, fuerza y acondicionamiento aplicados a la práctica de los estilos.', 'HABITUAL'],
        ['Combate Sanda', 'Sanda', 'Trabajo de distancia, combate y preparación específica de Sanda.', 'HABITUAL'],
        ['Taller de Shuai Jiao', 'Especialización', 'Curso especial de fin de semana sobre lucha tradicional china.', 'CURSO_ESPECIAL'],
        ['Introducción al Taijiquan estilo Chen', 'Especialización', 'Curso intensivo de fin de semana sobre un estilo invitado.', 'CURSO_ESPECIAL'],
        ['Defensa personal', 'Especialización', 'Curso especial de tarde sobre defensa personal.', 'CURSO_ESPECIAL'],
      ];
      const courseIds = [];
      for (const [name, topic, description, type] of courses) {
        const result = await client.query('INSERT INTO cursos (nombre, tema, descripcion, tipo_curso) VALUES ($1, $2, $3, $4) RETURNING id_curso', [name, topic, description, type]);
        courseIds.push(result.rows[0].id_curso);
      }

      const roomNames = ['Sala Principal', 'Sala Tatami', 'Sala Multiusos'];
      const roomIds = [];
      for (const name of roomNames) {
        const result = await client.query('INSERT INTO salas (nombre) VALUES ($1) RETURNING id_sala', [name]);
        roomIds.push(result.rows[0].id_sala);
      }

      const weeklySchedules = [
        [0, 0, 0, 9, 30, 90, 0], [0, 0, 1, 9, 30, 90, 0], [0, 0, 2, 9, 30, 90, 0], [0, 0, 3, 9, 30, 90, 0], [0, 0, 4, 9, 30, 90, 0],
        [1, 1, 0, 18, 30, 90, 1], [1, 1, 1, 18, 30, 90, 1], [1, 1, 2, 18, 30, 90, 1], [1, 1, 3, 18, 30, 90, 1], [1, 1, 4, 18, 30, 90, 1],
        [2, 2, 0, 17, 0, 90, 2], [2, 3, 2, 17, 0, 90, 2], [3, 4, 1, 16, 30, 90, 0], [3, 4, 3, 16, 30, 90, 0], [4, 5, 4, 20, 0, 90, 1],
        [2, 2, 0, 9, 30, 90, 2],
      ];

      const monday = dateTimeOnWeekday(0, 0, 0).slice(0, 10);
      const scheduledCourseIds = [];
      for (const [courseIndex, instructorIndex, weekday, hour, minute, durationMinutes, roomIndex] of weeklySchedules) {
        const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
        const endTime = addMinutesToLocal(`2000-01-01T${startTime}`, durationMinutes).slice(11);
        const rule = await client.query('INSERT INTO horarios_recurrentes (id_curso, id_instructor, id_sala, dia_semana, hora_inicio, hora_fin, fecha_inicio) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_horario_recurrente', [courseIds[courseIndex], instructorIds[instructorIndex], roomIds[roomIndex], weekday + 1, startTime, endTime, monday]);
        for (let weekOffset = 0; weekOffset < 4; weekOffset += 1) {
          const start = dateTimeOnWeekday(weekOffset, weekday, hour, minute);
          const end = addMinutesToLocal(start, durationMinutes);
          const result = await client.query('INSERT INTO cursos_agendados (id_curso, id_instructor, id_sala, fecha_hora, fecha_hora_fin, activo, id_horario_recurrente, fecha_recurrencia) VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7) RETURNING id_curso_agendado', [courseIds[courseIndex], instructorIds[instructorIndex], roomIds[roomIndex], start, end, rule.rows[0].id_horario_recurrente, start.slice(0, 10)]);
          scheduledCourseIds.push(result.rows[0].id_curso_agendado);
        }
      }

      const specialSessions = [
        [5, 5, 1, 5, 10, 3 * 60, 2, true],
        [5, 5, 1, 6, 10, 3 * 60, 2, true],
        [6, 2, 2, 5, 9, 8 * 60, 1, true],
        [7, 7, 3, 4, 15, 3 * 60, 0, true],
        [5, 5, 3, 5, 10, 3 * 60, 2, false],
      ];
      for (const [courseIndex, instructorIndex, weekOffset, weekday, hour, durationMinutes, roomIndex, active] of specialSessions) {
        const start = dateTimeOnWeekday(weekOffset, weekday, hour, 0);
        const end = addMinutesToLocal(start, durationMinutes);
        const result = await client.query('INSERT INTO cursos_agendados (id_curso, id_instructor, id_sala, fecha_hora, fecha_hora_fin, activo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_curso_agendado', [courseIds[courseIndex], instructorIds[instructorIndex], roomIds[roomIndex], start, end, active]);
        scheduledCourseIds.push(result.rows[0].id_curso_agendado);
      }
      for (const [sessionIndex, scheduledCourseId] of scheduledCourseIds.entries()) {
        for (let attendeeOffset = 0; attendeeOffset < 4; attendeeOffset += 1) await client.query("INSERT INTO inscripciones (id_alumno, id_curso_agendado, estado) VALUES ($1, $2, 'activa')", [studentIds[(sessionIndex * 3 + attendeeOffset * 7) % studentIds.length], scheduledCourseId]);
      }
      await client.query('INSERT INTO dev_support.seed_state (version) VALUES ($1)', [SEED_VERSION]);
      await client.query('COMMIT');
      console.log('Datos de demostración creados: 50 alumnos, 10 instructores, 3 salas, clases recurrentes con horarios paralelos, cursos de fin de semana y una actividad cancelada.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

async function startFrontend() {
  process.env.VITE_API_URL = 'http://127.0.0.1:8080';
  viteServer = await createViteServer({ root: FRONT_DIRECTORY, server: { host: '127.0.0.1', port: 8000, strictPort: true } });
  await viteServer.listen();
  console.log('\nAplicación disponible en http://127.0.0.1:8000');
  console.log(`Base activa: ${DATABASE_NAME}`);
  console.log('Acceso de demostración: admin@wushu.test / WushuDemo2026!');
  console.log('Pulsa Ctrl+C para detener el front y el backend.\n');
}

async function stop() {
  if (closing) return;
  closing = true;
  if (viteServer) await viteServer.close();
  if (backendProcess && backendProcess.exitCode === null) {
    if (process.platform === 'win32') spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `taskkill /pid ${backendProcess.pid} /T /F`], { stdio: 'ignore' });
    else process.kill(-backendProcess.pid, 'SIGTERM');
  }
}

async function main() {
  const configuration = getConfiguration();
  await assertPortFree(8000);
  await assertPortFree(8080);
  if (process.argv.includes('--reset')) await resetDevelopmentDatabase(configuration);
  await prepareDevelopmentDatabase(configuration);
  backendProcess = startBackend(configuration);
  await waitForBackend(backendProcess);
  await seedDatabase(configuration);
  await startFrontend();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await stop();
    process.exit(0);
  });
}

main().catch(async (error) => {
  console.error(`\nNo se ha podido iniciar el entorno de desarrollo: ${error.message}`);
  await stop();
  process.exit(1);
});
