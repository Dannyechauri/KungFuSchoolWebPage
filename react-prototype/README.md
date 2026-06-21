# Prototipo React · Instituto de Wu-shu

Exploración frontend construida sobre el backend existente, sin modificar su
esquema ni sus endpoints.

## Instalación desde cero

Al terminar estos pasos deben estar funcionando:

- PostgreSQL con una base local llamada `kungfu_school` y datos demo;
- el backend en `http://localhost:8080`; y
- React en `http://localhost:8000`.

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

### 2. Instalar los programas necesarios

- [Node.js](https://nodejs.org/) 20.19 o superior, con npm.
- [Java JDK](https://adoptium.net/) 21 o superior.
- [PostgreSQL](https://www.postgresql.org/download/) 14 o superior, incluyendo
  `psql`, `createdb` y `pg_isready`.
- Git y `curl`.
- Bash para utilizar el arranque automático en macOS, Linux o WSL.

Comprueba la instalación en una terminal:

```bash
node --version
npm --version
java -version
psql --version
```

### 3. Seguir los pasos de tu sistema operativo

#### macOS

Con Homebrew se pueden instalar los requisitos mediante:

```bash
brew install node@20 openjdk@21 postgresql@16
```

Entra en el prototipo y ejecuta:

```bash
cd KungFuSchoolWebPage/react-prototype
npm run dev:all
```

El script instala las dependencias del proyecto, arranca PostgreSQL de Homebrew,
crea la base, ejecuta las migraciones, genera los datos demo y levanta backend y
frontend. Pulsa `Ctrl+C` para detener los procesos iniciados por el comando.

#### Linux

Instala Node.js 20.19+, Java 21 y PostgreSQL con el gestor de paquetes de tu
distribución. En Ubuntu o Debian, Java y PostgreSQL pueden instalarse así:

```bash
sudo apt update
sudo apt install openjdk-21-jdk postgresql postgresql-client curl
sudo systemctl enable --now postgresql
```

La instalación habitual de PostgreSQL crea el usuario `postgres`. Asígnale una
contraseña para permitir que el script se conecte localmente:

```bash
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'kungfu_dev';"
```

Entra en el prototipo, crea la configuración local y edítala:

```bash
cd KungFuSchoolWebPage/react-prototype
cp .env.dev.example .env.dev.local
```

Configura al menos estas líneas en `.env.dev.local`:

```text
DB_USER=postgres
DB_PASSWORD=kungfu_dev
```

Finalmente ejecuta:

```bash
npm run dev:all
```

#### Windows con WSL

Instala WSL con Ubuntu y realiza **dentro de WSL** todos los pasos indicados en
la sección de Linux, incluida la instalación y configuración de PostgreSQL. El
resultado y el comando final son los mismos:

```bash
npm run dev:all
```

#### Windows nativo con PowerShell

El script Bash no funciona de forma nativa en PowerShell. El resultado es el
mismo, pero la primera preparación se realiza manualmente y se usan dos
terminales.

1. Instala Node.js, Java 21 y PostgreSQL usando los instaladores enlazados arriba.
   Durante la instalación de PostgreSQL, conserva la contraseña del usuario
   `postgres` y asegúrate de instalar también sus herramientas de línea de
   comandos.

2. Crea la base **antes de arrancar el backend**. Puedes hacerlo desde pgAdmin
   mediante `Servers > PostgreSQL > Databases > Create > Database`, usando el
   nombre `kungfu_school`; o desde PowerShell:

   ```powershell
   createdb -h localhost -U postgres kungfu_school
   ```

3. Abre una primera terminal PowerShell, entra en el backend y arráncalo con las
   credenciales elegidas durante la instalación:

   ```powershell
   cd C:\ruta\al\proyecto\KungFuSchoolAdminSystem\KungFuBackendService\backend-service
   $env:DB_HOST = "localhost"
   $env:DB_PORT = "5432"
   $env:DB_NAME = "kungfu_school"
   $env:DB_USER = "postgres"
   $env:DB_PASSWORD = "tu_password_de_postgresql"
   .\gradlew.bat bootRun
   ```

   La primera ejecución descarga Gradle y sus dependencias. Espera hasta que el
   backend indique que ha arrancado; Flyway creará las tablas automáticamente.

4. Abre una segunda terminal PowerShell, instala las dependencias del frontend y
   genera los datos demo:

   ```powershell
   cd C:\ruta\al\proyecto\KungFuSchoolAdminSystem\KungFuSchoolWebPage\react-prototype
   npm install
   npm run seed:demo
   ```

5. En esa misma segunda terminal, arranca React:

   ```powershell
   npm run dev
   ```

6. Abre `http://localhost:8000`. Mantén ambas terminales abiertas mientras uses
   la aplicación; `Ctrl+C` detiene cada servicio.

## Desarrollo

### Qué hace `npm run dev:all`

El comando automático:

1. valida Node.js, Java y PostgreSQL;
2. instala las dependencias npm;
3. prepara la base `kungfu_school`;
4. arranca el backend y deja que Flyway cree el esquema;
5. genera datos demo sólo si la base está vacía; y
6. arranca React.

Por defecto utiliza el usuario del sistema para PostgreSQL. Para cambiar
credenciales o puertos, copia `.env.dev.example` como `.env.dev.local` y edita
sus valores. El archivo local está ignorado por Git.

### Arranque manual

```bash
npm install
npm run dev
```

La aplicación se sirve en `http://localhost:8000` para utilizar la configuración
CORS actual del backend.

## Configuración

La URL de la API puede cambiarse copiando `.env.example` como `.env.local`:

```text
VITE_API_URL=http://localhost:8080
```

## Comprobaciones

```bash
npm run lint
npm run build
```

## Datos de demostración

Con el backend en ejecución y una base local vacía (excepto los estilos iniciales):

```bash
npm run seed:demo
```

El script utiliza exclusivamente la API existente. Se detiene si encuentra datos
de dominio para evitar duplicados accidentales.
