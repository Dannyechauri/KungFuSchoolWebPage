# Panel interno · Instituto de Wu-shu de Barcelona

Esta rama convierte el front original en una aplicación React orientada al uso diario de maestros, instructores y administradores de la escuela.

La herramienta técnica original no se ha borrado: queda preservada en `legacy-admin/`. La pantalla principal ahora es una experiencia más clara para trabajar con alumnos, calendario, conocimiento y equipo docente.

## Objetivo de esta rama

- Usar React como base del futuro front de producto.
- Mantener una UI moderna, pero sencilla de usar para un usuario no técnico.
- Evitar enseñar tablas crudas como experiencia principal.
- Reutilizar la estructura ya existente del backend.
- Dejar comentarios didácticos mínimos en el código para que sirva también como material de aprendizaje de React.

## Requisitos

- Node.js `>=20.19.0`
- Backend arrancado, por defecto en `http://127.0.0.1:8080`
- Sesión válida en el backend

## Arranque local

Desde esta carpeta:

```bash
npm install
npm run dev
```

Abre:

```text
http://127.0.0.1:8000/
```

Si tu backend usa otra URL:

```bash
VITE_API_URL=http://127.0.0.1:8080 npm run dev
```

También puedes crear un `.env.local`:

```bash
VITE_API_URL=http://127.0.0.1:8080
```

## Credenciales de prueba

Si el backend se ha arrancado con la base demo que usamos durante la POC:

```text
admin.demo@iwushu.local
password
```

## Scripts

```bash
npm run dev       # Arranca Vite en http://127.0.0.1:8000
npm run dev:host  # Expone el front en la red local
npm run build     # Compila TypeScript y genera dist/
npm test          # Ejecuta los tests unitarios mínimos con Vitest
npm run preview   # Sirve el build de producción
npm run legacy    # Abre la herramienta técnica original
```

## Secciones React actuales

- Inicio: resumen tranquilo de alumnos, próximas actividades y avisos.
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

Esa parte sigue siendo útil como herramienta cruda para desarrollo o inspección, pero no es la experiencia que queremos poner delante de maestros, instructores o administradores.

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
- componentes con props: piezas pequeñas que reciben datos y devuelven UI.

No pretende ser un curso completo de React, pero sí una base legible para revisarla con alguien que viene de programación técnica no web.

## Tests

Hay un plan inicial en `TESTING_PLAN.md`. La idea no es testearlo todo todavía, sino empezar por una red pequeña: build/typecheck, funciones puras, componentes clave y más adelante un smoke test con Playwright.
