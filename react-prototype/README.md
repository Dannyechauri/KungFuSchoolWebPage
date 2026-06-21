# Prototipo React · Instituto de Wu-shu

Exploración frontend construida sobre el backend existente, sin modificar su
esquema ni sus endpoints.

## Requisitos

- Node.js 20.19 o superior
- Java 21 o superior
- PostgreSQL 14 o superior
- Bash en macOS, Linux o WSL

## Desarrollo

### Arranque completo en un comando

Con los tres repositorios clonados como submódulos, ejecuta:

```bash
npm run dev:all
```

El comando:

1. valida Node.js 20.19+, Java 21 y PostgreSQL;
2. instala las dependencias npm;
3. arranca PostgreSQL de Homebrew si está instalado pero detenido;
4. crea `kungfu_school` si no existe;
5. arranca el backend y deja que Flyway cree el esquema;
6. genera datos demo si la base está vacía; y
7. arranca React en `http://localhost:8000`.

El wrapper de Gradle descarga las dependencias del backend automáticamente. Para
detener los procesos iniciados por el comando, pulsa `Ctrl+C`.

Por defecto se utiliza el usuario del sistema para PostgreSQL. Si tu instalación
usa otras credenciales, copia `.env.dev.example` como `.env.dev.local` y cambia
los valores `DB_*`. También puedes cambiar los puertos del backend y frontend.
Este archivo local está ignorado por Git.

### Compatibilidad por sistema operativo

#### macOS

`npm run dev:all` funciona directamente. Si PostgreSQL fue instalado mediante
Homebrew y está detenido, el script intenta arrancar su servicio.

#### Linux

`npm run dev:all` funciona con Bash. PostgreSQL debe estar arrancado previamente;
por ejemplo, en distribuciones con systemd:

```bash
sudo systemctl start postgresql
npm run dev:all
```

El usuario configurado en `DB_USER` debe poder conectarse y crear bases de datos.
Si las credenciales no coinciden con el usuario del sistema, configúralas en
`.env.dev.local`.

#### Windows

La opción recomendada para esta POC es usar WSL. Instala Node.js, Java y
PostgreSQL dentro de WSL y ejecuta el mismo comando que en Linux:

```bash
npm run dev:all
```

El script Bash no soporta PowerShell de forma nativa. Para trabajar sin WSL,
arranca PostgreSQL y utiliza tres terminales de PowerShell:

```powershell
# Terminal 1: backend
cd ..\..\KungFuBackendService\backend-service
$env:DB_USER = "postgres"
$env:DB_PASSWORD = "tu_password"
.\gradlew.bat bootRun
```

```powershell
# Terminal 2: datos demo, cuando el backend ya responda
npm install
npm run seed:demo
```

```powershell
# Terminal 3: frontend
npm run dev
```

Antes del primer arranque nativo en Windows, crea `kungfu_school` desde pgAdmin
o con `createdb -U postgres kungfu_school`.

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
