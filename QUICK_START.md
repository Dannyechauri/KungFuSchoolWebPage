# 🚀 Inicio Rápido

## En 3 pasos

### 1️⃣ Inicia el Backend
```bash
cd KungFuBackendService/backend-service
./gradlew.bat bootRun
```
✅ Backend corriendo en: `http://localhost:8080`

### 2️⃣ Inicia el Servidor Web
Elige uno de estos:

**Opción A: Abrir HTML directamente**
- Haz doble clic en `KungFuSchoolWebPage/index.html`

**Opción B: Python**
```bash
cd KungFuSchoolWebPage
python -m http.server 8000
```

**Opción C: Node.js**
```bash
cd KungFuSchoolWebPage
npx http-server
```

### 3️⃣ Accede al Panel
- Si usaste Opción A: Ya está abierto
- Si usaste Opción B o C: Abre `http://localhost:8000`

---

## ¿Qué Hacer Ahora?

### 📊 Dashboard
- Haz clic en **"Verificar Estado"** para comprobar la conexión
- Observa las estadísticas de la base de datos

### 📋 Tablas
- Haz clic en **"Ver Tablas"** para ver todas las tablas
- Cada tabla muestra opciones disponibles

### 🔄 Migraciones
- Haz clic en **"Ejecutar Migraciones"** si necesitas actualizar el esquema
- Revisa los detalles de las migraciones ejecutadas

### ⚙️ Configuración
- Ajusta la **URL del API** si tu backend está en otro lugar
- Activa la **Actualización Automática** para monitoreo continuo

---

## Características Principales

### ✨ Interfaz Moderna
- Diseño limpio y profesional
- Completamente responsivo
- Tema rojo y dorado (colores de Kung Fu)

### 🔌 Conectividad
- Se conecta automáticamente al backend
- Mensajes de estado claros
- Manejo de errores inteligente

### 🎯 Funcionalidades
- Monitoreo de salud en tiempo real
- Gestión de tablas
- Control de migraciones
- Configuración personalizada

### 💾 Almacenamiento
- Las configuraciones se guardan automáticamente
- Persistencia entre sesiones
- Sin necesidad de servidor adicional

---

## Solucionar Problemas

### ❌ "No se puede conectar al backend"
1. Verifica que el backend está corriendo (`gradlew.bat bootRun`)
2. Revisa que está en `http://localhost:8080`
3. En Configuración, asegúrate de que la URL sea correcta

### ❌ Error CORS
1. Abre el backend en `http://localhost:8080` en tu navegador
2. Debería mostrar la página de error de Spring Boot (esto es normal)
3. Intenta con un servidor local: `python -m http.server 8000`

### ❌ Las tablas no cargan
1. Ve a **Migraciones**
2. Haz clic en **"Ejecutar Migraciones"**
3. Intenta recargar la sección de Tablas

---

## Próximos Pasos

- Explora las diferentes secciones del panel
- Personaliza la configuración según tus necesidades
- Considera agregar autenticación para producción
- Lee la documentación completa en `README.md`

---

## Contacto y Soporte

Para problemas o sugerencias, contacta al administrador del sistema.

🥋 **Escuela de Kung Fu - 2026**
