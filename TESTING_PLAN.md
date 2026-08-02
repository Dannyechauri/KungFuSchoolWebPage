# Plan base de tests frontend

Sí tiene sentido testear el front, pero en esta fase conviene hacerlo con cabeza: pocos tests que protejan lo importante, no una muralla de tests frágiles para una UI que todavía va a cambiar.

## Nivel 0: comprobaciones obligatorias

Estos checks deberían pasar siempre antes de enseñar o subir cambios:

```bash
npm run build
```

Qué cubre:

- TypeScript compila.
- Vite puede generar producción.
- Las rutas/imports principales no están rotos.

## Nivel 1: unit tests pequeños

Herramienta recomendada:

- Vitest.

Qué probar primero:

- utilidades de fecha en `src/utils/date.ts`;
- utilidades de filas/ids compuestos;
- funciones puras que agrupen eventos, formas o progreso cuando las extraigamos de las páginas.

Regla práctica:

- Si una función transforma datos sin tocar navegador ni backend, merece unit test.

## Nivel 2: tests de componentes

Herramientas recomendadas:

- React Testing Library;
- `@testing-library/user-event`;
- MSW o mocks de `fetch` para simular el backend.

Casos iniciales útiles:

- Login muestra error si falla la sesión.
- Layout muestra menú principal y nombre de usuario.
- Alumnos filtra por texto, grado y forma.
- Ficha de alumno muestra formas conocidas y requeridas.
- Calendario muestra evento en vista mes y agenda.

Regla práctica:

- Testear comportamiento visible, no detalles internos de implementación.

## Nivel 3: smoke/e2e local

Herramienta recomendada:

- Playwright.

Casos mínimos:

1. Abre `/`.
2. Hace login con usuario demo.
3. Navega a Alumnos.
4. Abre una ficha.
5. Navega a Calendario.
6. Comprueba que la app no rompe y que hay contenido principal visible.

Esto es especialmente útil para un panel como este, porque gran parte del valor está en que el flujo completo se sienta usable.

## Nivel 4: visual regression, más adelante

No lo metería todavía. Cuando el estilo esté más decidido, podemos guardar capturas de:

- Inicio;
- Alumnos;
- Ficha de alumno;
- Calendario;
- Conocimiento;
- Equipo.

En esta fase sería demasiado pronto: cambiaríamos diseño cada dos días y los tests visuales harían ruido.

## Orden recomendado para implementarlos

1. Añadir Vitest y 4-6 unit tests de utilidades.
2. Extraer lógica de datos de páginas grandes a funciones puras testeables.
3. Añadir React Testing Library para login/layout/filtros.
4. Añadir un único smoke test con Playwright cuando el backend demo sea estable.

## Qué no testear todavía

- Colores exactos.
- Textos que sabemos que van a cambiar.
- Estructura interna de componentes.
- Cada formulario CRUD si el backend todavía está cambiando.

La idea es tener una red mínima de seguridad, no congelar el prototipo.
