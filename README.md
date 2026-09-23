# Instituto de Wu-shu de Barcelona

Aplicación interna para maestros, instructores y administradores. Construiremos sus pantallas paso a paso.

Por ahora solo existe la base de desarrollo y una pantalla inicial. El front todavía no tiene autenticación ni consume datos del backend, aunque el entorno local ya los prepara para las siguientes pantallas.

## Stack

- React 19 y TypeScript: componentes y tipos.
- Vite 8: servidor de desarrollo y compilación.
- React Router 7: navegación del navegador, preparada con `BrowserRouter`.
- Tailwind CSS 4: estilos mediante clases, integrado con el plugin oficial de Vite.
- Oxlint: revisión estática del código, incluido en la plantilla oficial de Vite utilizada.

React Router se mantiene en la versión 7 elegida para esta base. Actualizar Node no implica actualizar las librerías del front.

## Entorno común para macOS y Windows

Las versiones de referencia son **Node.js 24.21.0 LTS** y **npm 11.19.0**. Se registran en `.node-version` y `packageManager` de `package.json`, respectivamente. `engines` admite Node desde 24.21.0 hasta antes de 25, y npm desde 11.19.0 hasta antes de 12.

`engines` declara las versiones compatibles y `.npmrc` hace que una instalación con versiones incompatibles se detenga con `EBADENGINE`. `.node-version` y `packageManager` documentan el entorno; no instalan ni seleccionan por sí solos Node o npm.

En macOS con Homebrew, instalar `node@24` y seleccionar su carpeta `bin` en el `PATH` de la terminal. En Windows, instalar Node desde su [web oficial](https://nodejs.org/en/download), seleccionando la versión de referencia y la arquitectura del equipo. No se necesitan WSL ni Git Bash para ejecutar el front.

Después de instalar o cambiar Node, abrir una nueva terminal y verificar:

```text
node --version
npm --version
```

Si la terminal aún muestra la versión anterior, revisar `type -a node npm` en macOS o `where.exe node` y `where.exe npm` en Windows. También puede ser necesario cerrar y volver a abrir el editor para que sus terminales hereden el nuevo entorno.

## Arranque del entorno de desarrollo

Abrir una terminal en `KungFuSchoolWebPage`, la carpeta que contiene este `package.json`. Si se parte del repositorio padre, ejecutar primero `cd KungFuSchoolWebPage`.

Los comandos son los mismos en macOS y Windows:

```text
npm ci
npm run dev
```

`npm ci` instala las versiones del `package-lock.json` sin actualizarlo. Ejecutarlo en la primera instalación y cuando cambie ese archivo; no hace falta reinstalar en cada arranque. Para añadir o actualizar una dependencia de forma deliberada se usa `npm install` y se revisan los cambios del lockfile.

Cada ordenador debe instalar sus propias dependencias. No copiar `node_modules/` entre macOS y Windows: algunas herramientas contienen binarios distintos para cada plataforma.

`npm run dev` prepara el entorno completo: comprueba que los puertos 8000 y 8080 estén libres, crea si hace falta la base PostgreSQL local `kungfu_school_dev`, arranca el backend, aplica sus migraciones y carga datos de demostración completos solo la primera vez. Después arranca el front en http://127.0.0.1:8000/.

La base queda en el ordenador entre arranques, también los cambios que se hagan durante las pruebas. El lanzador únicamente acepta una base local y se niega a adoptar una base con ese nombre si no fue creada por él. No borra ni reinicializa datos.

Para borrar únicamente esta base local marcada por el proyecto y crearla de nuevo con los datos iniciales, detener primero el entorno con Ctrl+C y ejecutar el comando npm run dev:reset.

Este comando no puede eliminar una base con el mismo nombre que no haya sido creada por el lanzador.

Los datos iniciales incluyen un administrador, 50 alumnos, 10 instructores, 8 estilos, 70 formas, grados con sus formas requeridas, ocho tipos de curso y actividades repartidas entre días recientes y las cuatro semanas siguientes. La cuenta de demostración es `admin@wushu.test` con contraseña `WushuDemo2026!`; es exclusiva para esta base local y ficticia.

Hace falta instalar una vez PostgreSQL local y Java 21 además de Node. En macOS el usuario por defecto de PostgreSQL es el mismo usuario del sistema; en Windows es normalmente `postgres`. Si ese usuario tiene contraseña, copiar `.env.example` como `.env.dev.local` y completar `DEV_DB_USER` y `DEV_DB_PASSWORD`. Este archivo está ignorado por Git. Se puede indicar `DEV_JAVA_HOME` en ese mismo archivo si Java 21 no está disponible desde la terminal.

Para revisar únicamente la maquetación, sin arrancar PostgreSQL ni el backend:

```text
npm run dev:front
```

Este modo no permite iniciar sesión ni consultar o guardar datos. Para usar la aplicación de administración se necesita `npm run dev`.

El puerto es fijo: si está ocupado, el lanzador lo indicará en lugar de elegir otro.

Si PowerShell bloquea `npm.ps1`, usar el lanzador de Windows, sin cambiar las políticas de ejecución:

```powershell
npm.cmd ci
npm.cmd run dev
```

Ante `EBADENGINE`, comprobar las versiones indicadas por el error e instalar el entorno acordado. No omitir la comprobación con `--force`. Si el puerto 8000 está ocupado, cerrar el servidor anterior del proyecto o revisar qué aplicación lo utiliza.

## Criterios de compatibilidad

- Los scripts de npm deben funcionar en ambos sistemas. Evitar comandos exclusivos de Bash o PowerShell; si hace falta automatización adicional, escribirla en Node y comprobarla en ambos sistemas.
- `.gitattributes` normaliza los archivos de texto a LF y reserva CRLF para posibles lanzadores `.bat` o `.cmd`. No hace falta cambiar la configuración global de Git.
- Usar exactamente las mismas mayúsculas y minúsculas en los nombres de archivo y sus imports.
- Las credenciales de PostgreSQL usadas por el lanzador local se guardan en `.env.dev.local`. El `.env.local` del front no configura automáticamente Spring Boot.

## Primeros archivos

El recorrido de arranque es `index.html` → `src/main.tsx` → `src/App.tsx`.

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Documento HTML con el contenedor `root` y la entrada de JavaScript. |
| `src/main.tsx` | Monta React en `root` y envuelve la aplicación con `StrictMode` y `BrowserRouter`. |
| `src/App.tsx` | Componente raíz; por ahora muestra una pantalla mínima. |
| `src/index.css` | Importa Tailwind. Las clases se usan en `className` de los componentes. |
| `vite.config.ts` | Activa React y Tailwind y configura el servidor local. |
| `tsconfig*.json` | Configura TypeScript para la aplicación y las herramientas. |
| `.oxlintrc.json` | Configura el análisis estático y las reglas de React. |
| `package.json` | Declara dependencias y comandos. |
| `package-lock.json` | Fija las versiones instaladas para reproducir la instalación con `npm ci`. |
| `.node-version` y `.npmrc` | Documentan Node y activan la comprobación de versiones durante la instalación. |
| `.gitattributes` | Mantiene finales de línea consistentes entre sistemas. |

## Comprobaciones

```bash
npm run lint
npm run build
```

`build` comprueba los tipos y genera `dist/`. Para revisar esa compilación localmente:

```bash
npm run preview
```

No hay todavía una suite de tests; se decidirá al construir las funcionalidades.

El entorno se ha comprobado localmente en macOS. La instalación y ejecución en Windows siguen pendientes de validación real.

### Comprobación automática en GitHub

El workflow `.github/workflows/frontend-checks.yml` pertenece al repositorio web `KungFuSchoolWebPage`. Cuando esté publicado, se ejecutará en cada push y en las propuestas de merge dirigidas a `main`.

Ejecuta `npm ci`, `npm run lint` y `npm run build` por separado en macOS y Windows. Obtiene Node de `.node-version`, con el npm incluido en esa distribución (Node 24.21.0 incluye npm 11.19.0), y muestra ambas versiones en los registros. `.npmrc` comprueba que el entorno cumple `engines`.

Los resultados aparecerán en la pestaña **Actions** del repositorio y en las comprobaciones de la propuesta de merge. Un fallo en un sistema no cancela la comprobación del otro. Este workflow no despliega la aplicación ni hace merges, y no necesita el backend ni una base de datos.

Preparar el archivo localmente no ejecuta comprobaciones en GitHub: hace falta publicar los cambios, con autorización explícita para el push. La primera ejecución remota queda pendiente.

### Primera prueba manual en Windows

Cuando terminemos la primera página, la probaremos en el PC de sobremesa Windows: instalación con `npm ci`, arranque con `npm run dev`, carga y recarga en el navegador, y las interacciones que tenga esa página. Que la compilación automática pase no sustituye esta prueba de uso.

`npm run dev` y `npm run preview` son herramientas de desarrollo y revisión. El paquete de ejecución para el ordenador de la escuela se preparará en otra fase.

`node_modules/`, `dist/` y la configuración local `.env.local` están ignorados por Git. `npm run dev` entrega al backend las credenciales mediante variables privadas. Nunca deben añadirse secretos a variables `VITE_*`, porque son accesibles desde el navegador.
