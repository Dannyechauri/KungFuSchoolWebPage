# Prototipo React · Instituto de Wu-shu

Exploración frontend construida sobre el backend existente, sin modificar su
esquema ni sus endpoints.

## Requisitos

- Node.js 20.19 o superior
- Backend local disponible en `http://localhost:8080`

## Desarrollo

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
