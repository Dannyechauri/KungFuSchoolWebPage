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
