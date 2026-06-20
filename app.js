// ==================== Configuración ==================== 
const DEFAULT_API_URL = 'http://localhost:8080';
const DEFAULT_REFRESH_INTERVAL = 30; // segundos

// Estado de la aplicación
const appState = {
    apiUrl: normalizeApiUrl(localStorage.getItem('apiUrl')) || DEFAULT_API_URL,
    autoRefresh: localStorage.getItem('autoRefresh') !== 'false',
    refreshIntervalSeconds: parseInt(localStorage.getItem('refreshInterval') || DEFAULT_REFRESH_INTERVAL),
    refreshTimerId: null,
    selectedTable: null,
    selectedColumns: [],
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
    document.getElementById('reload-selected-table-btn').addEventListener('click', reloadSelectedTableData);
    document.getElementById('insert-row-btn').addEventListener('click', insertSelectedTableRow);

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
    const baseUrl = normalizeApiUrl(appState.apiUrl) || DEFAULT_API_URL;
    const url = `${baseUrl}${endpoint}`;
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
                    <button class="btn btn-info btn-sm" onclick="openTableData('${tableName}')">Ver Datos</button>
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

async function openTableData(tableName) {
    try {
        appState.selectedTable = tableName;
        document.getElementById('table-data-panel').style.display = 'block';
        document.getElementById('selected-table-name').textContent = tableName;

        const columns = await apiCall(`/api/database/tables/${encodeURIComponent(tableName)}/columns`);
        appState.selectedColumns = columns;
        renderInsertForm(columns);
        await reloadSelectedTableData();
        showToast(`Tabla seleccionada: ${tableName}`, 'success');
    } catch (error) {
        showToast(`No se pudo abrir la tabla ${tableName}`, 'error');
    }
}

async function reloadSelectedTableData() {
    if (!appState.selectedTable) {
        showToast('Selecciona una tabla primero', 'info');
        return;
    }

    try {
        const tableName = appState.selectedTable;
        const rows = await apiCall(`/api/database/tables/${encodeURIComponent(tableName)}/rows?limit=100`);
        renderTableData(rows, appState.selectedColumns);
    } catch (error) {
        showToast('No se pudieron cargar los registros', 'error');
    }
}

function renderTableData(rows, columns) {
    const head = document.getElementById('table-data-head');
    const body = document.getElementById('table-data-body');
    const empty = document.getElementById('table-data-empty');
    const table = document.getElementById('table-data-table');
    const primaryKeyColumn = columns.find(col => col.primaryKey)?.name;

    if (rows.length === 0) {
        table.style.display = 'none';
        empty.style.display = 'block';
        body.innerHTML = '';
        return;
    }

    empty.style.display = 'none';
    table.style.display = 'table';

    const columnNames = columns.map(col => col.name);
    head.innerHTML = `
        <tr>
            ${columnNames.map(name => `<th>${name}</th>`).join('')}
            <th>Acciones</th>
        </tr>
    `;

    body.innerHTML = rows.map(row => {
        const actionBtn = primaryKeyColumn && row[primaryKeyColumn] !== undefined
            ? `<button class="btn btn-danger btn-sm" onclick="deleteRow('${appState.selectedTable}', '${String(row[primaryKeyColumn]).replace(/'/g, "\\'")}')">Eliminar</button>`
            : '<span class="text-muted">Sin PK</span>';

        return `
            <tr>
                ${columnNames.map(name => `<td>${formatCellValue(row[name])}</td>`).join('')}
                <td>${actionBtn}</td>
            </tr>
        `;
    }).join('');
}

function renderInsertForm(columns) {
    const form = document.getElementById('insert-row-form');
    const editableColumns = columns.filter(col => !col.autoGenerated && !col.primaryKey);

    if (editableColumns.length === 0) {
        form.innerHTML = '<p class="info-text">No hay columnas editables para insertar en esta tabla.</p>';
        return;
    }

    form.innerHTML = editableColumns.map(col => {
        const dataType = String(col.dataType || '').toLowerCase();
        const isRequired = !col.nullable && !col.hasDefault;
        const requiredAttr = isRequired ? 'required' : '';

        if (col.name === 'rol') {
            return `
                <div class="form-group">
                    <label for="field-${col.name}">${col.name} (${col.dataType})${isRequired ? ' *' : ''}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona un rol</option>
                        <option value="administrador">administrador</option>
                        <option value="instructor">instructor</option>
                        <option value="alumno">alumno</option>
                    </select>
                </div>
            `;
        }

        if (col.name === 'estado') {
            return `
                <div class="form-group">
                    <label for="field-${col.name}">${col.name} (${col.dataType})${isRequired ? ' *' : ''}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona un estado</option>
                        <option value="activa">activa</option>
                        <option value="inactiva">inactiva</option>
                        <option value="suspendida">suspendida</option>
                    </select>
                </div>
            `;
        }

        if (dataType === 'boolean') {
            if (col.nullable) {
                return `
                    <div class="form-group">
                        <label for="field-${col.name}">${col.name} (${col.dataType})</label>
                        <select id="field-${col.name}" class="form-input" data-column="${col.name}">
                            <option value="">Sin valor</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                        </select>
                    </div>
                `;
            }

            return `
                <div class="form-group form-group-checkbox">
                    <label class="checkbox-label" for="field-${col.name}">
                        <input type="checkbox" id="field-${col.name}" class="form-checkbox" data-column="${col.name}" ${col.hasDefault ? '' : 'checked'}>
                        ${col.name} (${col.dataType})
                    </label>
                </div>
            `;
        }

        if (dataType === 'date') {
            return `
                <div class="form-group">
                    <label for="field-${col.name}">${col.name} (${col.dataType})${isRequired ? ' *' : ''}</label>
                    <input type="date" id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                </div>
            `;
        }

        if (dataType.includes('timestamp')) {
            return `
                <div class="form-group">
                    <label for="field-${col.name}">${col.name} (${col.dataType})${isRequired ? ' *' : ''}</label>
                    <input type="datetime-local" id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                </div>
            `;
        }

        const isIntegerType = dataType.includes('int');
        const isNumericType = isIntegerType || dataType.includes('numeric') || dataType.includes('real') || dataType.includes('double') || dataType.includes('decimal');
        if (isNumericType) {
            return `
                <div class="form-group">
                    <label for="field-${col.name}">${col.name} (${col.dataType})${isRequired ? ' *' : ''}</label>
                    <input type="number" id="field-${col.name}" class="form-input" data-column="${col.name}" step="${isIntegerType ? '1' : 'any'}" ${requiredAttr}>
                </div>
            `;
        }

        const inputType = col.name.includes('email')
            ? 'email'
            : (col.name.includes('telefono') || col.name.includes('phone') ? 'tel' : (col.name.includes('url') ? 'url' : 'text'));

        return `
            <div class="form-group">
                <label for="field-${col.name}">${col.name} (${col.dataType})${isRequired ? ' *' : ''}</label>
                <input type="${inputType}" id="field-${col.name}" class="form-input" data-column="${col.name}" placeholder="Valor para ${col.name}" ${requiredAttr}>
            </div>
        `;
    }).join('');

    attachNativePickers(form);
}

function attachNativePickers(container) {
    const pickerInputs = container.querySelectorAll('input[type="date"], input[type="datetime-local"]');

    pickerInputs.forEach(input => {
        const openPicker = () => {
            if (typeof input.showPicker === 'function') {
                try {
                    input.showPicker();
                } catch (error) {
                    // Some browsers require a trusted user gesture; ignore if unavailable.
                }
            }
        };

        input.addEventListener('focus', openPicker);
        input.addEventListener('click', openPicker);
    });
}

async function insertSelectedTableRow() {
    if (!appState.selectedTable) {
        showToast('Selecciona una tabla primero', 'info');
        return;
    }

    const form = document.getElementById('insert-row-form');
    const payload = {};
    const editableColumns = appState.selectedColumns.filter(col => !col.autoGenerated && !col.primaryKey);
    const hiddenRequiredColumns = appState.selectedColumns.filter(col => {
        if (col.autoGenerated) {
            return false;
        }
        if (col.hasDefault) {
            return false;
        }
        if (col.nullable) {
            return false;
        }
        return col.primaryKey;
    });
    const missingRequired = [];

    if (hiddenRequiredColumns.length > 0) {
        showToast(`No se puede insertar desde este formulario. Campos ID requeridos: ${hiddenRequiredColumns.map(col => col.name).join(', ')}`, 'error');
        return;
    }

    editableColumns.forEach(col => {
        const input = form.querySelector(`[data-column="${col.name}"]`);
        const dataType = String(col.dataType || '').toLowerCase();

        if (!input) {
            return;
        }

        if (input.type === 'checkbox') {
            payload[col.name] = input.checked;
            return;
        }

        const rawValue = input.value?.trim();

        if (rawValue === '' || rawValue === undefined) {
            // If the column has a DB default, omit it to allow PostgreSQL to apply that default.
            if (!col.nullable && !col.hasDefault) {
                missingRequired.push(col.name);
            }
            return;
        }

        if (rawValue.toLowerCase() === 'null') {
            if (!col.nullable) {
                missingRequired.push(col.name);
            } else {
                payload[col.name] = null;
            }
            return;
        }

        if (rawValue.toLowerCase() === 'true' || rawValue.toLowerCase() === 'false') {
            payload[col.name] = rawValue.toLowerCase() === 'true';
            return;
        }

        if (dataType === 'date') {
            payload[col.name] = rawValue;
            return;
        }

        if (dataType.includes('timestamp')) {
            payload[col.name] = rawValue;
            return;
        }

        const isNumericType = dataType.includes('int') || dataType.includes('numeric') || dataType.includes('real') || dataType.includes('double') || dataType.includes('decimal');
        const numericValue = Number(rawValue);
        if (isNumericType && !Number.isNaN(numericValue) && rawValue !== '') {
            payload[col.name] = numericValue;
            return;
        }

        payload[col.name] = rawValue;
    });

    if (missingRequired.length > 0) {
        showToast(`Campos obligatorios faltantes: ${missingRequired.join(', ')}`, 'error');
        return;
    }

    try {
        await apiCall(`/api/database/tables/${encodeURIComponent(appState.selectedTable)}/rows`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        form.reset();
        await reloadSelectedTableData();
        showToast('Registro agregado correctamente', 'success');
    } catch (error) {
        showToast('No se pudo agregar el registro', 'error');
    }
}

async function deleteRow(tableName, id) {
    if (!confirm(`¿Eliminar el registro ${id} de ${tableName}?`)) {
        return;
    }

    try {
        await apiCall(`/api/database/tables/${encodeURIComponent(tableName)}/rows/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        });
        await reloadSelectedTableData();
        showToast('Registro eliminado', 'success');
    } catch (error) {
        showToast('No se pudo eliminar el registro', 'error');
    }
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
    document.getElementById('api-url').value = normalizeApiUrl(appState.apiUrl) || DEFAULT_API_URL;
    document.getElementById('auto-refresh').checked = appState.autoRefresh;
    document.getElementById('refresh-interval').value = appState.refreshIntervalSeconds;
}

function saveSettings() {
    const apiUrl = normalizeApiUrl(document.getElementById('api-url').value.trim());
    const autoRefresh = document.getElementById('auto-refresh').checked;
    const refreshInterval = parseInt(document.getElementById('refresh-interval').value);

    if (!apiUrl) {
        showToast('Por favor, ingrese una URL válida', 'error');
        return;
    }

    try {
        // Validar formato y esquema para evitar fallos silenciosos en fetch.
        const parsedUrl = new URL(apiUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new Error('Protocolo inválido');
        }
    } catch (error) {
        showToast('La URL del API no es válida', 'error');
        return;
    }

    if (refreshInterval < 5 || refreshInterval > 300) {
        showToast('El intervalo debe estar entre 5 y 300 segundos', 'error');
        return;
    }

    appState.apiUrl = apiUrl;
    appState.autoRefresh = autoRefresh;
    appState.refreshIntervalSeconds = refreshInterval;

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
    if (appState.refreshTimerId) {
        clearInterval(appState.refreshTimerId);
    }

    if (appState.autoRefresh) {
        appState.refreshTimerId = setInterval(() => {
            const activeSection = document.querySelector('.section.active');
            if (activeSection.id === 'dashboard-section') {
                checkHealthStatus();
                loadDashboardStats();
            }
        }, appState.refreshIntervalSeconds * 1000);
    }
}

function formatCellValue(value) {
    if (value === null || value === undefined) {
        return '<span class="text-muted">NULL</span>';
    }
    return String(value);
}

function normalizeApiUrl(url) {
    if (!url) {
        return '';
    }
    return String(url).trim().replace(/\/+$/, '');
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

    .btn-danger {
        background-color: #c62828;
        color: white;
    }

    .btn-danger:hover:not(:disabled) {
        background-color: #9e1f1f;
    }
`;
document.head.appendChild(style);
