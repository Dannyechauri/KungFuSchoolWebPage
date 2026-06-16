# 🥋 Panel de Administración - Escuela de Kung Fu

## Descripción

Panel web moderno y responsivo para administrar la base de datos de la Escuela de Kung Fu. Proporciona una interfaz intuitiva para monitorear el estado de la base de datos, visualizar tablas y ejecutar migraciones.

## Características

✅ **Dashboard Interactivo**
- Estado en tiempo real de la base de datos
- Estadísticas de tablas y migraciones
- Acciones rápidas

✅ **Gestión de Tablas**
- Visualizar todas las tablas de la base de datos
- Información detallada de cada tabla
- Interfaz responsiva

✅ **Gestión de Migraciones**
- Ejecutar migraciones con un clic
- Ver detalles de migraciones ejecutadas
- Información de versiones

✅ **Configuración**
- Cambiar URL del API backend
- Configurar actualización automática
- Ajustar intervalo de actualización

✅ **Diseño Responsivo**
- Compatible con escritorio, tablet y móvil
- Interfaz moderna con gradientes y animaciones
- Notificaciones toast amigables

## Requisitos

- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- Acceso al servidor backend de Kung Fu en `http://localhost:8080`
- JavaScript habilitado

## Instalación

### Opción 1: Acceso Directo (Recomendado)

1. Abre el archivo `index.html` en tu navegador web:
   ```
   Abre KungFuSchoolWebPage/index.html
   ```

### Opción 2: Usando un Servidor Local

Para evitar problemas de CORS, es recomendable servir los archivos localmente:

#### Con Python (3.x):
```bash
cd KungFuSchoolWebPage
python -m http.server 8000
```

Luego accede a: `http://localhost:8000`

#### Con Node.js:
```bash
cd KungFuSchoolWebPage
npx http-server
```

#### Con Live Server (VS Code):
1. Instala la extensión "Live Server"
2. Click derecho en `index.html`
3. Selecciona "Open with Live Server"

## Uso

### 1. Dashboard
- **Verificar Estado**: Comprueba la conexión y estado de la base de datos
- **Ver Tablas**: Número total de tablas en la base de datos
- **Acciones Rápidas**: Botones para navegar a otras secciones

### 2. Tablas
- Visualiza todas las tablas de la base de datos
- Cada tabla muestra opciones de información detallada
- Recarga la lista con el botón "Recargar"

### 3. Migraciones
- Ejecuta las migraciones de base de datos
- Revisa los detalles de ejecución
- Información sobre versiones de esquema

### 4. Configuración
- **URL del API**: Configura la dirección del servidor backend
- **Actualización Automática**: Habilita/deshabilita el refresco automático
- **Intervalo**: Define cada cuántos segundos se actualiza

## Configuración del Backend

La aplicación se conecta al backend en `http://localhost:8080` por defecto. 

### Endpoints Utilizados

```
GET  /api/database/health     - Estado de la base de datos
GET  /api/database/tables     - Listar tablas
POST /api/database/migrate    - Ejecutar migraciones
```

Si tu backend está en otra ubicación, cambia la URL en la sección **Configuración**.

## Configuración de CORS

Si experimentas errores de CORS, asegúrate de que tu backend Spring Boot tenga CORS habilitado:

```kotlin
@Configuration
class CorsConfig {
    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val configuration = CorsConfiguration()
        configuration.allowedOrigins = listOf("http://localhost:8000", "http://localhost:3000")
        configuration.allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS")
        configuration.allowedHeaders = listOf("*")
        configuration.allowCredentials = true
        
        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/api/**", configuration)
        return source
    }
}
```

## Almacenamiento Local

La aplicación utiliza `localStorage` del navegador para guardar:
- URL del API
- Preferencias de actualización automática
- Intervalo de actualización

Estos datos persisten entre sesiones.

## Características Avanzadas

### Notificaciones Toast
- **Información**: Mensajes de estado general
- **Éxito**: Operaciones completadas correctamente
- **Error**: Problemas detectados
- Se cierran automáticamente después de 4 segundos

### Auto-Actualización
- Actualiza automáticamente cuando estás en el Dashboard
- Intervalo configurable (5-300 segundos)
- Pausa cuando cambias de sección

### Manejo de Errores
- Mensajes de error claros y descriptivos
- Validación de entradas
- Confirmación para operaciones críticas

## Estructura de Archivos

```
KungFuSchoolWebPage/
├── index.html          # Página principal HTML
├── styles.css          # Estilos CSS
├── app.js              # Lógica JavaScript
├── README.md           # Esta documentación
└── package.json        # Configuración de proyecto (opcional)
```

## Desarrollo

### Personalización de Estilos

Edita `styles.css` para personalizar los colores y estilos:

```css
:root {
    --primary-color: #d32f2f;      /* Rojo primario */
    --secondary-color: #1976d2;    /* Azul secundario */
    --success-color: #388e3c;      /* Verde de éxito */
}
```

### Agregar Nuevos Endpoints

En `app.js`, agrega nuevas funciones:

```javascript
async function newFeature() {
    try {
        const data = await apiCall('/api/database/new-endpoint');
        // Procesa los datos
    } catch (error) {
        showToast('Error', 'error');
    }
}
```

## Resolución de Problemas

### El panel no se conecta al backend
1. Verifica que el servidor backend está corriendo en `http://localhost:8080`
2. En Configuración, cambia la URL del API si es necesario
3. Revisa la consola del navegador (F12 → Consola) para errores

### Error de CORS
- Asegúrate de que el backend permite CORS
- Intenta acceder desde un servidor local (http://localhost:xxxx)
- Consulta la sección de Configuración de CORS arriba

### Las tablas no cargan
- Verifica que la base de datos está correctamente inicializada
- Ejecuta las migraciones desde la sección de Migraciones
- Revisa los logs del backend para más información

## Navegadores Soportados

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Licencia

© 2026 Escuela de Kung Fu. Todos los derechos reservados.

## Soporte

Para reportar problemas o sugerencias, contacta al administrador del sistema.
