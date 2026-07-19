# Prototipo React · Instituto de Wu-shu

Propuesta de interfaz interna para maestros y administradores de la escuela.
Está construida sobre el backend existente y apunta a validar flujos de producto:
alumnos, agenda, conocimiento técnico, equipo docente y acceso de administración.

El prototipo no sustituye todavía al front existente. Es una rama de exploración
para probar cómo podría evolucionar la herramienta final.

## Qué arranca en local

Con el arranque automático se levantan:

- PostgreSQL con una base local, por defecto `kungfu_school`;
- el backend en `http://127.0.0.1:8080`;
- el prototipo React en `http://127.0.0.1:8000`;
- un administrador demo para poder iniciar sesión; y
- datos falsos de prueba si la base está vacía.

Credenciales demo:

```text
Correo: admin.demo@iwushu.local
Contraseña: password
```

Se usa `127.0.0.1` de forma intencionada para evitar problemas de cookies de
sesión al mezclar `localhost` y `127.0.0.1`.

## Instalación desde cero

### 1. Obtener el proyecto completo

Después de clonar `KungFuSchoolAdminSystem`, descarga sus repositorios enlazados:

```bash
cd KungFuSchoolAdminSystem
git submodule update --init --recursive
```

La estructura necesaria es:

```text
KungFuSchoolAdminSystem/
├── KungFuBackendService/backend-service/
└── KungFuSchoolWebPage/react-prototype/
```

### 2. Instalar requisitos

Necesitas:

- Node.js 20.19 o superior, con npm.
- Java JDK 21 o superior.
- PostgreSQL 14 o superior, incluyendo `psql`, `createdb` y `pg_isready`.
- Git, curl y Bash.

Comprueba la instalación:

```bash
node --version
npm --version
java -version
psql --version
```

## Arranque recomendado: macOS, Linux o WSL

Desde el prototipo:

```bash
cd KungFuSchoolWebPage/react-prototype
npm run dev:all
```

El script hace lo siguiente:

1. valida Node.js, Java, PostgreSQL y curl;
2. instala dependencias npm;
3. crea la base local si no existe;
4. arranca el backend y aplica migraciones Flyway;
5. crea o asegura el administrador demo;
6. inicia sesión desde el script de seed;
7. genera datos demo si la base no contiene datos de dominio; y
8. arranca React.

Cuando termine, abre:

```text
http://127.0.0.1:8000/
```

Para detener backend y frontend, pulsa `Ctrl+C` en la terminal donde ejecutaste
`npm run dev:all`.

### macOS

Con Homebrew puedes instalar los requisitos así:

```bash
brew install node@20 openjdk@21 postgresql@16
```

Si PostgreSQL no está arrancado, el script intentará levantarlo mediante
Homebrew.

### Linux

En Ubuntu o Debian:

```bash
sudo apt update
sudo apt install openjdk-21-jdk postgresql postgresql-client curl
sudo systemctl enable --now postgresql
```

La instalación habitual crea el usuario `postgres`. Puedes asignarle una
contraseña:

```bash
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'kungfu_dev';"
```

Después configura el prototipo:

```bash
cd KungFuSchoolWebPage/react-prototype
cp .env.dev.example .env.dev.local
```

Edita `.env.dev.local`:

```text
DB_USER=postgres
DB_PASSWORD=kungfu_dev
```

Y arranca:

```bash
npm run dev:all
```

### Windows con WSL

Es la opción recomendada para Windows. Instala Ubuntu con WSL y sigue los pasos
de Linux dentro de WSL. El comando final también es:

```bash
npm run dev:all
```

## Windows nativo con PowerShell

El script `dev:all` usa Bash, así que en Windows nativo hay que hacer más pasos
manuales. La opción práctica sigue siendo WSL, pero si quieres PowerShell puro:

1. Instala Node.js, Java 21 y PostgreSQL con sus instaladores oficiales.
2. Crea una base llamada `kungfu_school`.
3. Arranca el backend en una terminal.
4. Crea un administrador demo en PostgreSQL.
5. Genera datos demo con sesión.
6. Arranca React en otra terminal.

Backend:

```powershell
cd C:\ruta\al\proyecto\KungFuSchoolAdminSystem\KungFuBackendService\backend-service
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "5432"
$env:DB_NAME = "kungfu_school"
$env:DB_USER = "postgres"
$env:DB_PASSWORD = "tu_password_de_postgresql"
$env:SERVER_PORT = "8080"
.\gradlew.bat bootRun
```

Administrador demo:

```powershell
psql -h 127.0.0.1 -U postgres -d kungfu_school
```

Dentro de `psql`, ejecuta:

```sql
INSERT INTO administradores (nombre, fecha_inicio, correo_electronico, password_hash)
SELECT
  'Administrador Demo',
  CURRENT_DATE,
  'admin.demo@iwushu.local',
  '$2a$10$chyCUl5Pkd4regJanpaenODRCcd45eVzuVqct1ltLs249If/2rUNK'
WHERE NOT EXISTS (
  SELECT 1
  FROM administradores
  WHERE LOWER(correo_electronico) = LOWER('admin.demo@iwushu.local')
);
```

Frontend y seed:

```powershell
cd C:\ruta\al\proyecto\KungFuSchoolAdminSystem\KungFuSchoolWebPage\react-prototype
npm install
$env:VITE_API_URL = "http://127.0.0.1:8080"
$env:DEMO_ADMIN_EMAIL = "admin.demo@iwushu.local"
$env:DEMO_ADMIN_PASSWORD = "password"
npm run seed:demo -- --if-empty
npm run dev -- --host 127.0.0.1 --port 8000
```

Abre:

```text
http://127.0.0.1:8000/
```

## Configuración local

Puedes copiar el ejemplo:

```bash
cp .env.dev.example .env.dev.local
```

Variables soportadas:

```text
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=kungfu_school
DB_USER=postgres
DB_PASSWORD=
BACKEND_PORT=8080
FRONTEND_PORT=8000
VITE_API_URL=http://127.0.0.1:8080
DEMO_ADMIN_EMAIL=admin.demo@iwushu.local
DEMO_ADMIN_PASSWORD=password
```

`.env.dev.local` está ignorado por Git.

Si quieres una base limpia separada para pruebas, cambia `DB_NAME`, por ejemplo:

```bash
DB_NAME=kungfu_school_latest_poc npm run dev:all
```

## Datos demo

El seed usa la API del backend. Como el backend actual protege los endpoints de
base de datos con sesión, el script primero inicia sesión con el administrador
demo.

Con backend arrancado:

```bash
VITE_API_URL=http://127.0.0.1:8080 npm run seed:demo -- --if-empty
```

Si encuentra datos de dominio existentes, no duplica registros cuando se usa
`--if-empty`.

## Comprobaciones

Antes de compartir cambios:

```bash
npm run lint
npm run build
```

El build puede mostrar un aviso de bundle grande por FullCalendar. No bloquea el
prototipo.

## Alcance actual del prototipo

Implementado:

- login y logout;
- panel de resumen;
- directorio de alumnos;
- alta rápida de alumnos;
- edición de ficha de alumno;
- cambio de grado;
- registro de formas aprendidas;
- calendario de cursos agendados;
- creación y cancelación de eventos;
- catálogo de estilos, formas y grados;
- altas básicas de conocimiento;
- vista de equipo docente y administradores;
- altas básicas de instructores y administradores.

Limitaciones conocidas:

- no hay gestión completa de permisos por rol de usuario;
- no hay edición de administradores existentes, porque el backend la bloquea;
- no se borran relaciones con clave compuesta desde la UI;
- no hay todavía gestión completa de requisitos de grado (`grado_forma`);
- no hay asignación visual de estilos a instructores;
- sigue siendo una propuesta POC, no una interfaz final cerrada.
