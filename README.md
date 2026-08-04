# Panel interno · Instituto de Wu-shu de Barcelona

Aplicación React para el trabajo diario de maestros, instructores y administradores:
alumnos, calendario, programa técnico y equipo docente.

La herramienta técnica original sigue disponible en `legacy-admin/`, pero la entrada principal del front apunta a una experiencia más clara para uso interno de la escuela.

## Lo más rápido

Desde la carpeta `KungFuSchoolWebPage`:

```bash
npm run dev:all
```

Ese comando intenta hacer todo lo necesario para una prueba local:

- instala dependencias npm si faltan;
- prepara una base demo llamada `kungfu_school_react_demo`;
- arranca el backend en `http://127.0.0.1:8080`;
- carga datos falsos de alumnos, grados, formas, instructores y calendario;
- arranca el front React en `http://127.0.0.1:8000`.

Credenciales demo:

```text
admin.demo@iwushu.local
password
```

## Requisitos comunes

Antes de ejecutar el script necesitas tener instalado:

- Git.
- Node.js `>=20.19.0`.
- JDK 21.
- PostgreSQL con `psql` disponible en terminal.

El comando debe ejecutarse desde el submódulo del front:

```bash
git clone --recurse-submodules https://github.com/Dannyechauri/KungFuSchoolAdminSystem.git
cd KungFuSchoolAdminSystem/KungFuSchoolWebPage
```

Si el backend no está descargado todavía:

```bash
git submodule update --init --recursive
```

## macOS

Con Homebrew, una instalación típica sería:

```bash
brew install node openjdk@21 postgresql@16
brew services start postgresql@16
```

Si PostgreSQL usa tu usuario de macOS sin contraseña, normalmente basta con:

```bash
npm run dev:all
```

Si tu PostgreSQL usa otro usuario:

```bash
DB_USER=postgres DB_PASSWORD=tu_password npm run dev:all
```

## Linux

En Debian/Ubuntu, instala equivalentes de:

```bash
sudo apt update
sudo apt install git postgresql postgresql-contrib openjdk-21-jdk
```

Instala Node.js `>=20.19.0` con tu método habitual, por ejemplo `nvm`, el instalador oficial o el paquete de tu distribución si cumple la versión.

Arranca PostgreSQL:

```bash
sudo systemctl start postgresql
```

Si quieres trabajar con tu usuario local:

```bash
sudo -u postgres createuser --superuser "$USER"
npm run dev:all
```

Si prefieres usar el usuario `postgres`:

```bash
DB_USER=postgres DB_PASSWORD=tu_password npm run dev:all
```

## Windows

Instala:

- Git for Windows.
- Node.js `>=20.19.0`.
- JDK 21.
- PostgreSQL, incluyendo las herramientas de línea de comandos.

Comprueba en PowerShell:

```powershell
node --version
npm --version
java -version
psql --version
```

Si `psql` no aparece, añade la carpeta `bin` de PostgreSQL al `PATH`. Suele parecerse a:

```text
C:\Program Files\PostgreSQL\16\bin
```

Después, desde `KungFuSchoolWebPage`:

```powershell
$env:DB_USER="postgres"
$env:DB_PASSWORD="tu_password_de_postgres"
npm run dev:all
```

## Variables útiles

Puedes pasarlas por terminal o guardarlas en `.env.local`.

```text
VITE_API_URL=http://127.0.0.1:8080
PGCLIENTENCODING=UTF8
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kungfu_school_react_demo
DB_USER=postgres
DB_PASSWORD=tu_password_local
```

Recomendación: usa una base demo nueva para no tocar datos personales. El seed se protege y solo se ejecuta si la base contiene `demo`, `poc`, `local` o `test` en el nombre.

En Windows el script fuerza `PGCLIENTENCODING=UTF8` para que `psql` lea correctamente los acentos del archivo demo.

## Scripts principales

```bash
npm run dev:all    # Backend + base demo + frontend en un solo comando
npm run seed:demo  # Solo prepara/migra/recarga la base demo
npm run dev        # Solo frontend React
npm run dev:host   # Frontend accesible desde la red local
npm run build      # Compila TypeScript y genera dist/
npm run preview    # Sirve el build de producción
npm run legacy     # Abre la herramienta técnica original
```

Si quieres arrancar sin recargar datos demo:

```bash
npm run dev:all -- --no-seed
```

## Secciones React actuales

- Inicio: resumen de alumnos, próximas actividades y puntos a revisar.
- Alumnos: buscador, filtros por grado/forma, alta rápida y ficha de alumno.
- Ficha de alumno: edición básica, cambio de grado y formas que conoce.
- Calendario: vista mensual/agenda, creación y cancelación de actividades.
- Conocimiento: estilos, formas, grados, formas requeridas y tipos de curso.
- Equipo: instructores, estilos que enseñan y próximas actividades.

## Herramienta técnica original

El front vanilla anterior está en:

```text
legacy-admin/
```

Durante desarrollo con Vite se puede abrir en:

```text
http://127.0.0.1:8000/legacy-admin/
```

## Estructura relevante

```text
src/
├── api/                 # Cliente HTTP y acceso al backend genérico
├── components/          # Piezas UI pequeñas reutilizables
├── features/auth/       # Login, sesión y permisos básicos
├── hooks/               # Hooks de datos; useSchoolData concentra la carga principal
├── layout/              # Layout general del panel
├── pages/               # Pantallas principales
├── types/               # Tipos TypeScript del dominio de escuela
└── utils/               # Utilidades pequeñas
```

## Nota didáctica

El código tiene algunos comentarios intencionados para explicar conceptos básicos:

- `useState`: estado local de pantalla.
- `useEffect`: sincronización con sesión/navegador.
- `useMemo`: datos derivados sin recalcular de más.
- `useMutation`: escritura contra backend e invalidación de caché.
- React Router: navegación con `BrowserRouter`, `Routes`, `Route`, `NavLink`, `Link` y `useParams`.
- Componentes con props: piezas pequeñas que reciben datos y devuelven UI.

No pretende ser un curso completo de React, pero sí una base legible para revisarla con alguien que viene de programación técnica no web.
