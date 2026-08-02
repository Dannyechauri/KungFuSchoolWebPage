#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontDir = resolve(scriptDir, '..');
const backendDir = resolve(frontDir, '../KungFuBackendService/backend-service');
const seedFile = join(scriptDir, 'seed-demo.sql');

const args = new Set(process.argv.slice(2));
const shouldInstall = !args.has('--no-install');
const shouldSeed = !args.has('--no-seed');
const seedOnly = args.has('--seed-only');

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const gradleCommand = isWindows ? 'gradlew.bat' : './gradlew';

const fileEnv = readEnvFile(join(frontDir, '.env.local'));
const defaultDbUser = isWindows ? 'postgres' : os.userInfo().username || 'postgres';

const config = {
  apiUrl: envValue('VITE_API_URL', 'http://127.0.0.1:8080'),
  frontUrl: envValue('FRONT_URL', 'http://127.0.0.1:8000'),
  dbHost: envValue('DB_HOST', 'localhost'),
  dbPort: envValue('DB_PORT', '5432'),
  dbName: envValue('DB_NAME', 'kungfu_school_react_demo'),
  dbUser: envValue('DB_USER', defaultDbUser),
  dbPassword: envValue('DB_PASSWORD', ''),
};

const managedProcesses = [];
let backendStartedByScript = false;

main().catch((error) => {
  console.error(`\n❌ ${error.message}`);
  stopManagedProcesses();
  process.exit(1);
});

async function main() {
  printHeader();
  ensureLocalEnvFile();
  ensureBackendExists();
  resolveJavaHome();

  if (shouldInstall) {
    installFrontendDependencies();
  }

  if (shouldSeed) {
    ensurePsqlAvailable();
    ensureDatabaseExists();
  }

  const backendAlreadyRunning = await isHealthy(`${config.apiUrl}/api/database/health`);
  if (backendAlreadyRunning) {
    console.log(`✅ Backend ya responde en ${config.apiUrl}`);
    console.log('   Si ese backend usa otra base de datos, páralo y vuelve a ejecutar el script con las variables DB_* correctas.');
  } else {
    startBackend();
    await waitForHealth(`${config.apiUrl}/api/database/health`, 'backend');
  }

  if (shouldSeed) {
    seedDemoDatabase();
  }

  if (seedOnly) {
    console.log('\n✅ Base demo preparada.');
    stopManagedProcesses();
    return;
  }

  const frontendAlreadyRunning = await isHealthy(config.frontUrl);
  if (frontendAlreadyRunning) {
    console.log(`✅ Frontend ya responde en ${config.frontUrl}`);
  } else {
    startFrontend();
  }

  console.log('\nListo para probar:');
  console.log(`- Panel React: ${config.frontUrl}`);
  console.log(`- Backend: ${config.apiUrl}`);
  console.log('- Login demo: admin.demo@iwushu.local / password');
  console.log('\nPulsa Ctrl+C para apagar los procesos arrancados por este script.\n');

  await waitForever();
}

function printHeader() {
  console.log('\nInstituto de Wu-shu · arranque local completo');
  console.log('================================================');
  console.log(`Sistema operativo: ${os.platform()} ${os.release()}`);
  console.log(`Base demo: ${config.dbName}`);
}

function envValue(key, fallback) {
  return process.env[key] ?? fileEnv[key] ?? fallback;
}

function readEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .reduce((values, rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        return values;
      }

      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        return values;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
      values[key] = value;
      return values;
    }, {});
}

function ensureLocalEnvFile() {
  const envPath = join(frontDir, '.env.local');
  if (existsSync(envPath)) {
    return;
  }

  writeFileSync(
    envPath,
    [
      'VITE_API_URL=http://127.0.0.1:8080',
      'DB_HOST=localhost',
      'DB_PORT=5432',
      'DB_NAME=kungfu_school_react_demo',
      '# DB_USER=postgres',
      '# DB_PASSWORD=tu_password_local',
      '',
    ].join('\n'),
  );
  console.log('📝 Creado .env.local con valores demo.');
}

function ensureBackendExists() {
  if (!existsSync(backendDir)) {
    throw new Error(
      `No encuentro el backend en ${backendDir}. Clona el repo padre con submódulos o ejecuta: git submodule update --init --recursive`,
    );
  }
}

function resolveJavaHome() {
  if (process.env.JAVA_HOME || commandWorks('java', ['-version'])) {
    return;
  }

  if (isWindows) {
    console.warn('⚠️  No encuentro java en PATH. Instala JDK 21 o define JAVA_HOME antes de ejecutar este script.');
    return;
  }

  const candidates = [
    '/opt/homebrew/opt/openjdk@21',
    '/usr/local/opt/openjdk@21',
    '/opt/homebrew/opt/openjdk',
    '/usr/local/opt/openjdk',
    '/usr/lib/jvm/java-21-openjdk',
    '/usr/lib/jvm/java-21-openjdk-amd64',
  ];

  const found = candidates.find((candidate) => existsSync(join(candidate, 'bin', 'java')));
  if (found) {
    process.env.JAVA_HOME = found;
    process.env.PATH = `${join(found, 'bin')}${isWindows ? ';' : ':'}${process.env.PATH}`;
    console.log(`☕ Usando JAVA_HOME=${found}`);
  }
}

function installFrontendDependencies() {
  if (existsSync(join(frontDir, 'node_modules'))) {
    console.log('✅ Dependencias npm ya instaladas.');
    return;
  }

  console.log('📦 Instalando dependencias npm...');
  runChecked(npmCommand, ['install'], { cwd: frontDir });
}

function ensurePsqlAvailable() {
  if (!commandWorks('psql', ['--version'])) {
    throw new Error(
      'No encuentro psql en PATH. Instala PostgreSQL con sus herramientas de línea de comandos, o ejecuta npm run dev:all -- --no-seed.',
    );
  }
}

function ensureDatabaseExists() {
  validateDatabaseName(config.dbName);

  const existsResult = runChecked(
    'psql',
    [
      '-h',
      config.dbHost,
      '-p',
      config.dbPort,
      '-U',
      config.dbUser,
      '-d',
      'postgres',
      '-Atc',
      `SELECT 1 FROM pg_database WHERE datname = '${sqlLiteral(config.dbName)}';`,
    ],
    { env: postgresEnv(), stdio: 'pipe' },
  );

  if (existsResult.stdout.trim() === '1') {
    console.log(`✅ Base ${config.dbName} ya existe.`);
    return;
  }

  console.log(`🗄️  Creando base ${config.dbName}...`);
  runChecked('psql', ['-h', config.dbHost, '-p', config.dbPort, '-U', config.dbUser, '-d', 'postgres', '-c', `CREATE DATABASE "${sqlIdentifier(config.dbName)}";`], {
    env: postgresEnv(),
  });
}

function startBackend() {
  console.log('🚀 Arrancando backend Spring Boot...');
  backendStartedByScript = true;
  spawnManaged('backend', gradleCommand, ['bootRun'], {
    cwd: backendDir,
    env: {
      ...process.env,
      DB_HOST: config.dbHost,
      DB_PORT: config.dbPort,
      DB_NAME: config.dbName,
      DB_USER: config.dbUser,
      DB_PASSWORD: config.dbPassword,
    },
  });
}

function seedDemoDatabase() {
  console.log('🌱 Cargando datos demo...');
  runChecked(
    'psql',
    ['-h', config.dbHost, '-p', config.dbPort, '-U', config.dbUser, '-d', config.dbName, '-v', 'ON_ERROR_STOP=1', '-f', seedFile],
    { env: postgresEnv() },
  );
  console.log('✅ Datos demo cargados.');
}

function startFrontend() {
  console.log('🖥️  Arrancando frontend React...');
  spawnManaged('frontend', npmCommand, ['run', 'dev'], {
    cwd: frontDir,
    env: {
      ...process.env,
      VITE_API_URL: config.apiUrl,
    },
  });
}

function spawnManaged(label, command, childArgs, options = {}) {
  const child = spawn(command, childArgs, {
    stdio: 'inherit',
    detached: !isWindows,
    ...options,
    env: options.env ?? process.env,
  });

  managedProcesses.push({ label, child });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`\n⚠️  Proceso ${label} terminó con código ${code}.`);
    }
  });

  return child;
}

function runChecked(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? frontDir,
    env: options.env ?? process.env,
    encoding: 'utf8',
    stdio: options.stdio ?? 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    if (result.stderr) {
      console.error(result.stderr);
    }
    throw new Error(`Falló el comando: ${command} ${commandArgs.join(' ')}`);
  }

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function commandWorks(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'ignore' });
  return !result.error && result.status === 0;
}

async function isHealthy(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 900);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(url, label) {
  const startedAt = Date.now();
  const timeoutMs = 120_000;

  while (Date.now() - startedAt < timeoutMs) {
    if (await isHealthy(url)) {
      console.log(`✅ ${label} listo.`);
      return;
    }

    await sleep(1_500);
  }

  throw new Error(`Tiempo agotado esperando ${label} en ${url}. Revisa la salida anterior.`);
}

function postgresEnv() {
  return {
    ...process.env,
    PGPASSWORD: config.dbPassword,
  };
}

function validateDatabaseName(dbName) {
  if (!/^[a-zA-Z0-9_-]+$/.test(dbName)) {
    throw new Error('DB_NAME solo puede contener letras, números, guiones y guiones bajos para este script local.');
  }
}

function sqlIdentifier(value) {
  return value.replaceAll('"', '""');
}

function sqlLiteral(value) {
  return value.replaceAll("'", "''");
}

function stopManagedProcesses() {
  for (const { label, child } of managedProcesses.reverse()) {
    if (child.exitCode !== null) {
      continue;
    }

    console.log(`Apagando ${label}...`);
    if (isWindows) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    }
  }
}

function waitForever() {
  return new Promise((resolve) => {
    const stop = () => {
      stopManagedProcesses();
      resolve();
    };

    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);

    if (!backendStartedByScript && managedProcesses.length === 0) {
      resolve();
    }
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
