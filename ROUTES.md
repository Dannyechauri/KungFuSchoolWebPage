# 🥋 Rutas y Navegación

## Estructura de URLs

El panel utiliza navegación por hash (#) para cambiar entre secciones sin recargar la página.

### URLs Disponibles

```
http://localhost:8000/                    # Dashboard (por defecto)
http://localhost:8000/#dashboard          # Dashboard explícito
http://localhost:8000/#tables             # Sección de Tablas
http://localhost:8000/#migrate            # Sección de Migraciones
http://localhost:8000/#settings           # Sección de Configuración
```

## Navegación Programática

### Desde JavaScript
```javascript
// Cambiar a sección de tablas
switchSection('tables');

// Cambiar a dashboard
switchSection('dashboard');
```

## API Endpoints del Backend

### Health Check
```
GET /api/database/health
```
**Descripción:** Verifica el estado de la base de datos

**Respuesta:**
```json
{
    "status": "UP",
    "databaseTime": "2026-06-17T10:30:00Z",
    "checkedAt": "2026-06-17T10:30:00Z"
}
```

---

### Listar Tablas
```
GET /api/database/tables
```
**Descripción:** Obtiene la lista de todas las tablas en la base de datos

**Respuesta:**
```json
[
    "users",
    "students",
    "instructors",
    "classes",
    "schedules"
]
```

---

### Ejecutar Migraciones
```
POST /api/database/migrate
```
**Descripción:** Ejecuta las migraciones pendientes en la base de datos

**Respuesta:**
```json
{
    "migrationsExecuted": 3,
    "targetSchemaVersion": "4",
    "initialSchemaVersion": "1",
    "database": "PostgreSQL 14.2",
    "flywayVersion": "9.2.0"
}
```

## Flujo de Navegación Recomendado

1. **Inicio (Dashboard)**
   - Verificar estado de la base de datos
   - Ver estadísticas generales

2. **Verificación (Tablas)**
   - Revisar todas las tablas disponibles
   - Confirmar estructura de datos

3. **Mantenimiento (Migraciones)**
   - Si es necesario, ejecutar migraciones
   - Verificar cambios de esquema

4. **Configuración (Settings)**
   - Ajustar URL del backend si es necesario
   - Configurar actualización automática

## Integración con Otros Sistemas

### Acceder desde Otra Aplicación
```html
<iframe src="http://localhost:8000/#dashboard"></iframe>
```

### URL Deeplink
```
https://admin.escuela-kunfu.com/#tables?table=students
```

## Seguridad de Navegación

- No se guardan datos sensibles en URLs
- Las configuraciones se almacenan en localStorage
- Todos los cambios requieren confirmación
- Las migraciones piden confirmación antes de ejecutarse
