// ==================== Configuración ==================== 
const DEFAULT_API_URL = 'http://localhost:8080';
const DEFAULT_REFRESH_INTERVAL = 30; // segundos

// Estado de la aplicación
const appState = {
    apiUrl: localStorage.getItem('apiUrl') || DEFAULT_API_URL,
    autoRefresh: localStorage.getItem('autoRefresh') !== 'false',
    refreshInterval: parseInt(localStorage.getItem('refreshInterval') || DEFAULT_REFRESH_INTERVAL),
    refreshInterval: null,
};

// ==================== Inicialización ==================== 
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    loadSettings();
    setupEventListeners();
    initializeAutoRefresh();
    checkHealthStatus();
}

// ==================== Event Listeners ==================== 
function setupEventListeners() {
    // Navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', handleNavigation);
    });

    // Dashboard
    document.getElementById('check-health-btn').addEventListener('click', checkHealthStatus);
    document.getElementById('refresh-stats-btn').addEventListener('click', loadDashboardStats);
    document.getElementById('view-tables-btn').addEventListener('click', () => switchSection('tables'));
    document.getElementById('run-migrate-btn').addEventListener('click', () => switchSection('migrate'));

    // Tables
    document.getElementById('reload-tables-btn').addEventListener('click', loadTables);

    // Migrations
    document.getElementById('execute-migrate-btn').addEventListener('click', executeMigrations);

    // Settings
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
}

// ==================== Navegación ==================== 
function handleNavigation(e) {
    const section = e.target.dataset.section;
    switchSection(section);

    // Actualizar botones activos
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
}

function switchSection(sectionName) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Mostrar sección seleccionada
    const section = document.getElementById(`${sectionName}-section`);
    if (section) {
        section.classList.add('active');
    }

    // Actualizar navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.dataset.section === sectionName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Cargar datos si es necesario
    if (sectionName === 'tables') {
        loadTables();
    } else if (sectionName === 'settings') {
        loadSettings();
    }
}

// ==================== API Calls ==================== 
async function apiCall(endpoint, options = {}) {
    const url = `${appState.apiUrl}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    };

    try {
        const response = await fetch(url, defaultOptions);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast(`Error: ${error.message}`, 'error');
        throw error;
    }
}

// ==================== Dashboard ==================== 
async function checkHealthStatus() {
    try {
        const btn = document.getElementById('check-health-btn');
        btn.disabled = true;

        const health = await apiCall('/api/database/health');

        // Actualizar UI
        const indicator = document.getElementById('status-indicator');
        const dot = document.getElementById('status-dot');
        const text = document.getElementById('status-text');

        dot.className = 'status-dot online';
        text.textContent = 'Base de datos: CONECTADA';

        document.getElementById('db-time').textContent = formatDateTime(health.databaseTime);
        document.getElementById('check-time').textContent = formatDateTime(health.checkedAt);

        showToast('Estado verificado correctamente', 'success');
    } catch (error) {
        updateOfflineStatus();
    } finally {
        document.getElementById('check-health-btn').disabled = false;
    }
}

function updateOfflineStatus() {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');

    dot.className = 'status-dot offline';
    text.textContent = 'Base de datos: DESCONECTADA';

    document.getElementById('db-time').textContent = '--';
    document.getElementById('check-time').textContent = new Date().toLocaleString('es-ES');
}

async function loadDashboardStats() {
    try {
        const tables = await apiCall('/api/database/tables');
        document.getElementById('table-count').textContent = tables.length;
        showToast('Estadísticas actualizadas', 'success');
    } catch (error) {
        // Error ya mostrado por apiCall
    }
}

// ==================== Tablas ==================== 
async function loadTables() {
    try {
        const loading = document.getElementById('tables-loading');
        const table = document.getElementById('tables-table');
        const tbody = document.getElementById('tables-tbody');
        const empty = document.getElementById('tables-empty');

        loading.style.display = 'flex';
        table.style.display = 'none';
        empty.style.display = 'none';

        const tables = await apiCall('/api/database/tables');

        if (tables.length === 0) {
            empty.style.display = 'block';
            loading.style.display = 'none';
            return;
        }

        tbody.innerHTML = '';
        tables.forEach((tableName, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><strong>${tableName}</strong></td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="viewTableInfo('${tableName}')">Ver Info</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        table.style.display = 'table';
        loading.style.display = 'none';

        showToast(`Se cargaron ${tables.length} tablas`, 'success');
    } catch (error) {
        document.getElementById('tables-loading').style.display = 'none';
        document.getElementById('tables-empty').style.display = 'block';
    }
}

function viewTableInfo(tableName) {
    showToast(`Información de tabla: ${tableName}`, 'info');
    // Aquí se podría expandir para mostrar más información sobre la tabla
}

// ==================== Migraciones ==================== 
async function executeMigrations() {
    if (!confirm('¿Está seguro de que desea ejecutar las migraciones? Esto puede modificar la base de datos.')) {
        return;
    }

    try {
        const btn = document.getElementById('execute-migrate-btn');
        btn.disabled = true;

        const result = await apiCall('/api/database/migrate', { method: 'POST' });

        // Mostrar resultados
        displayMigrationResults(result);

        showToast('Migraciones ejecutadas correctamente', 'success');
    } catch (error) {
        showToast('Error al ejecutar migraciones', 'error');
    } finally {
        document.getElementById('execute-migrate-btn').disabled = false;
    }
}

function displayMigrationResults(result) {
    const resultsCard = document.getElementById('migration-results');

    document.getElementById('migrations-executed').textContent = result.migrationsExecuted || 0;
    document.getElementById('initial-version').textContent = result.initialSchemaVersion || '--';
    document.getElementById('target-version').textContent = result.targetSchemaVersion || '--';
    document.getElementById('migration-db').textContent = result.database || '--';
    document.getElementById('flyway-version').textContent = result.flywayVersion || '--';

    resultsCard.style.display = 'block';
}

// ==================== Configuración ==================== 
function loadSettings() {
    document.getElementById('api-url').value = appState.apiUrl;
    document.getElementById('auto-refresh').checked = appState.autoRefresh;
    document.getElementById('refresh-interval').value = appState.refreshInterval;
}

function saveSettings() {
    const apiUrl = document.getElementById('api-url').value.trim();
    const autoRefresh = document.getElementById('auto-refresh').checked;
    const refreshInterval = parseInt(document.getElementById('refresh-interval').value);

    if (!apiUrl) {
        showToast('Por favor, ingrese una URL válida', 'error');
        return;
    }

    if (refreshInterval < 5 || refreshInterval > 300) {
        showToast('El intervalo debe estar entre 5 y 300 segundos', 'error');
        return;
    }

    appState.apiUrl = apiUrl;
    appState.autoRefresh = autoRefresh;
    appState.refreshInterval = refreshInterval;

    localStorage.setItem('apiUrl', apiUrl);
    localStorage.setItem('autoRefresh', autoRefresh);
    localStorage.setItem('refreshInterval', refreshInterval);

    // Reinicializar actualización automática
    initializeAutoRefresh();

    showToast('Configuración guardada correctamente', 'success');
}

// ==================== Auto Refresh ==================== 
function initializeAutoRefresh() {
    // Limpiar intervalo anterior si existe
    if (appState.refreshInterval) {
        clearInterval(appState.refreshInterval);
    }

    if (appState.autoRefresh) {
        appState.refreshInterval = setInterval(() => {
            const activeSection = document.querySelector('.section.active');
            if (activeSection.id === 'dashboard-section') {
                checkHealthStatus();
                loadDashboardStats();
            }
        }, appState.refreshInterval * 1000);
    }
}

// ==================== Utilidades ==================== 
function formatDateTime(dateString) {
    if (!dateString) return '--';

    try {
        const date = new Date(dateString);
        return date.toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    } catch (error) {
        return dateString;
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Auto-eliminar después de 4 segundos
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==================== Utilidades para Botones ==================== 
// Estilos adicionales para botones pequeños
const style = document.createElement('style');
style.textContent = `
    .btn-sm {
        padding: 6px 12px;
        font-size: 0.85rem;
    }
`;
document.head.appendChild(style);
