import { createServer as createNetServer } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

import bcrypt from 'bcryptjs';
import pg from 'pg';
import { createServer as createViteServer } from 'vite';

const { Client } = pg;
const DATABASE_NAME = 'kungfu_school_dev';
const DATABASE_COMMENT = 'instituto-wushu:development:v1';
const SEED_VERSION = 'calendar-demo-v1';
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
    javaHome: value('DEV_JAVA_HOME') || process.env.JAVA_HOME,
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

function findJava(configuration) {
  const candidates = [
    configuration.javaHome,
    process.platform === 'darwin' ? '/opt/homebrew/opt/openjdk@21' : undefined,
    process.platform === 'darwin' ? '/usr/local/opt/openjdk@21' : undefined,
  ].filter(Boolean);
  for (const javaHome of candidates) {
    const executable = path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    if (existsSync(executable) && isJava21(executable)) return { executable, javaHome };
  }
  const executable = process.platform === 'win32' ? 'java.exe' : 'java';
  if (isJava21(executable)) return { executable, javaHome: undefined };
  throw new Error('No se ha encontrado Java 21. Instálalo y déjalo disponible en la terminal, o define DEV_JAVA_HOME en .env.dev.local.');
}

function isJava21(executable) {
  const result = spawnSync(executable, ['-version'], { encoding: 'utf8' });
  return result.status === 0 && `${result.stdout}\n${result.stderr}`.includes('version "21');
}

async function assertPortFree(port) {
  await new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once('error', () => reject(new Error(`El puerto ${port} ya está ocupado. Cierra el proceso que lo usa antes de ejecutar npm run dev.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

function startBackend(configuration, java) {
  if (!existsSync(BACKEND_DIRECTORY)) throw new Error(`No se ha encontrado el backend en ${BACKEND_DIRECTORY}. Comprueba que el submódulo esté inicializado.`);
  const environment = {
    ...process.env,
    DB_HOST: configuration.host,
    DB_PORT: String(configuration.port),
    DB_NAME: DATABASE_NAME,
    DB_USER: configuration.user,
    DB_PASSWORD: configuration.password,
    SERVER_ADDRESS: '127.0.0.1',
    SERVER_PORT: '8080',
    ...(java.javaHome ? { JAVA_HOME: java.javaHome } : {}),
  };
  const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'sh';
  const argumentsForCommand = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'gradlew.bat bootRun --console=plain --no-daemon']
    : ['./gradlew', 'bootRun', '--console=plain', '--no-daemon'];
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
      // Spring Boot todavía está arrancando.
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
      const passwordHash = await bcrypt.hash('WushuDemo2026!', 12);
      await client.query('INSERT INTO administradores (nombre, fecha_inicio, correo_electronico, password_hash) VALUES ($1, CURRENT_DATE, $2, $3)', ['Administración de demostración', 'admin@wushu.test', passwordHash]);

      const instructors = [
        ['Marta Serra', '2021-09-01', 'Ving Tsun', 'marta.serra@wushu.test'],
        ['Daniel Rius', '2022-01-10', 'Jungar', 'daniel.rius@wushu.test'],
        ['Laia Font', '2023-02-15', 'Shaolin', 'laia.font@wushu.test'],
      ];
      const instructorIds = [];
      for (const [name, hiredAt, specialty, email] of instructors) {
        const result = await client.query('INSERT INTO instructores (nombre, fecha_contratacion, activo, especialidad, correo_electronico, password_hash) VALUES ($1, $2, TRUE, $3, $4, $5) RETURNING id_instructor', [name, hiredAt, specialty, email, passwordHash]);
        instructorIds.push(result.rows[0].id_instructor);
        await client.query('INSERT INTO instructor_estilo (id_instructor, id_estilo) SELECT $1, id_estilo FROM estilos WHERE nombre = $2', [result.rows[0].id_instructor, specialty]);
      }

      const courses = [
        ['Ving Tsun: base y estructura', 'Técnica', 'Sesión de fundamentos para alumnado de todos los niveles.'],
        ['Jungar: acondicionamiento', 'Preparación física', 'Trabajo de fuerza, movilidad y coordinación.'],
        ['Shaolin: formas tradicionales', 'Formas', 'Repaso guiado de una forma tradicional.'],
        ['Práctica abierta de Wu-shu', 'Entrenamiento', 'Sesión abierta para practicar y resolver dudas.'],
      ];
      const courseIds = [];
      for (const [name, topic, description] of courses) {
        const result = await client.query('INSERT INTO cursos (nombre, tema, descripcion) VALUES ($1, $2, $3) RETURNING id_curso', [name, topic, description]);
        courseIds.push(result.rows[0].id_curso);
      }

      const sessions = [[0, 0, -3, 18, 30, true], [1, 1, -1, 19, 0, true], [2, 2, 1, 18, 30, true], [3, 0, 2, 19, 0, true], [0, 0, 4, 18, 30, true], [1, 1, 6, 19, 0, true], [2, 2, 8, 18, 30, true], [3, 0, 10, 19, 0, true], [0, 0, 12, 18, 30, true], [1, 1, 14, 19, 0, true], [2, 2, 3, 17, 0, false]];
      for (const [courseIndex, instructorIndex, offset, hour, minute, active] of sessions) {
        await client.query('INSERT INTO cursos_agendados (id_curso, id_instructor, fecha_hora, activo) VALUES ($1, $2, $3, $4)', [courseIds[courseIndex], instructorIds[instructorIndex], dateTimeAt(offset, hour, minute), active]);
      }
      await client.query('INSERT INTO dev_support.seed_state (version) VALUES ($1)', [SEED_VERSION]);
      await client.query('COMMIT');
      console.log('Datos de demostración creados: administración, instructores, cursos y calendario.');
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
  const java = findJava(configuration);
  await assertPortFree(8000);
  await assertPortFree(8080);
  await prepareDevelopmentDatabase(configuration);
  backendProcess = startBackend(configuration, java);
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
