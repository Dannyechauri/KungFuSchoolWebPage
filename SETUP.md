# Guía de Configuración y Despliegue

## 1. Configuración Inicial

### Paso 1: Preparar el Backend
Asegúrate de que el backend Spring Boot está corriendo:

```bash
cd KungFuBackendService/backend-service
./gradlew.bat bootRun
```

El backend debe estar disponible en: `http://localhost:8080`

### Paso 2: Servir el Panel Web

#### Opción A: Abrir Directamente
Simplemente abre el archivo `index.html` en tu navegador.

#### Opción B: Con Servidor Local (Recomendado)
```bash
cd KungFuSchoolWebPage

# Con Python
python -m http.server 8000

# Con Node.js
npx http-server
```

Accede a: `http://localhost:8000`

## 2. Configuración del Panel

### Primera Vez
1. Abre el panel en tu navegador
2. Ve a la sección **Configuración**
3. Verifica que la URL del API sea: `http://localhost:8080`
4. Guarda la configuración

### Actualización Automática
El panel puede actualizar automáticamente cada 30 segundos (configurable):
- Activa **Actualizar estado automáticamente** en Configuración
- Ajusta el intervalo según sea necesario

## 3. Funcionalidades Principales

### Dashboard
- Monitorea el estado en tiempo real
- Ve las estadísticas de tablas
- Accede rápidamente a otras funciones

### Tablas
- Lista todas las tablas de la base de datos
- Ver detalles de cada tabla
- Información de estructura

### Migraciones
- Ejecuta migraciones de base de datos
- Ve el historial de cambios
- Información de versiones de esquema

## 4. Solución de Problemas

### Problema: "No se puede conectar al backend"
**Solución:**
1. Verifica que el backend está corriendo
2. Usa `http://localhost:8080` como URL
3. Revisa en Configuración

### Problema: Error CORS
**Solución:**
El backend necesita permitir CORS. En tu aplicación Spring Boot:

```kotlin
@Configuration
class CorsConfig : WebMvcConfigurer {
    override fun addCorsMappings(registry: CorsRegistry) {
        registry.addMapping("/api/**")
            .allowedOrigins("http://localhost:3000", "http://localhost:8000")
            .allowedMethods("GET", "POST", "PUT", "DELETE")
            .allowedHeaders("*")
            .allowCredentials(true)
    }
}
```

### Problema: Las tablas no aparecen
**Solución:**
1. Ejecuta las migraciones desde la sección **Migraciones**
2. Verifica la base de datos PostgreSQL
3. Revisa los logs del backend

## 5. Despliegue en Producción

### Opción A: Servir como Archivos Estáticos
```bash
# En un servidor web (Nginx, Apache, etc.)
server {
    listen 80;
    server_name admin.escuela-kunfu.com;

    location / {
        root /var/www/kung-fu-admin;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:8080;
    }
}
```

### Opción B: Con Node.js
```bash
npm install -g http-server
http-server /path/to/KungFuSchoolWebPage -p 80
```

### Opción C: Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install -g http-server
EXPOSE 3000
CMD ["http-server", "-p", "3000"]
```

## 6. Variables de Entorno

Puedes crear un archivo `.env.local` para configurar valores por defecto:

```javascript
// En app.js, modifica:
const DEFAULT_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';
```

## 7. Seguridad

### HTTPS
En producción, siempre usa HTTPS:
```javascript
const DEFAULT_API_URL = 'https://api.escuela-kunfu.com';
```

### Autenticación (Futuro)
Para agregar autenticación:
```javascript
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('authToken');
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };
    // ...
}
```

## 8. Monitoreo

### Logs del Backend
```bash
# Ver logs en tiempo real
tail -f logs/application.log
```

### Verificar Conectividad
```bash
# Probar el endpoint de salud
curl http://localhost:8080/api/database/health

# Listar tablas
curl http://localhost:8080/api/database/tables
```

## 9. Mantenimiento

### Actualizar Configuración
- Cambia la URL en la sección Configuración
- Los cambios se guardan automáticamente

### Limpiar Cache Local
```javascript
// En consola del navegador:
localStorage.clear();
location.reload();
```

### Resetear a Valores por Defecto
1. Abre la consola del navegador (F12)
2. Ejecuta: `localStorage.clear(); location.reload();`

## 10. API Reference

El panel se comunica con estos endpoints:

```
GET /api/database/health
Respuesta:
{
    "status": "UP",
    "databaseTime": "2026-06-17T10:30:00Z",
    "checkedAt": "2026-06-17T10:30:00Z"
}

GET /api/database/tables
Respuesta:
["users", "students", "classes", "schedules", ...]

POST /api/database/migrate
Respuesta:
{
    "migrationsExecuted": 3,
    "initialSchemaVersion": "1",
    "targetSchemaVersion": "4",
    "database": "PostgreSQL 14.2",
    "flywayVersion": "9.2.0"
}
```

## 11. Próximos Pasos

- [ ] Agregar página de login
- [ ] Implementar CRUD de tablas
- [ ] Agregar búsqueda y filtrado
- [ ] Exportar datos a CSV
- [ ] Crear backups automáticos
- [ ] Agregar gráficos de estadísticas
- [ ] Soporte multiidioma
