console.log('✓ app.js cargado');

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
    gradosOptions: [],
    estilosOptions: [],
    gradoFormaFormasOptions: [],
    alumnoFormaAlumnosOptions: [],
    alumnoFormaFormasOptions: [],
    selectedRowsRaw: [],
    sessionUser: null,
    cursosAgendadosOptions: { cursos: [], instructores: [] },
};

// ==================== Inicialización ==================== 
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    loadSettings();
    setupEventListeners();
    initializeSession();
}

// ==================== Event Listeners ==================== 
function setupEventListeners() {
    // Sesion
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Navegación
    document.querySelectorAll('.nav-btn:not(.nav-btn-toggle)').forEach(btn => {
        btn.addEventListener('click', (e) => {
            closeFinalView();
            handleNavigation(e);
        });
    });

    // ESC para cerrar vista final o modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('final-add-modal');
            if (modal && modal.style.display === 'flex') {
                closeFinalAddDialog();
            } else {
                closeFinalView();
            }
        }
    });
    
    // Click fuera del modal para cerrar
    document.getElementById('final-add-modal').addEventListener('click', (e) => {
        if (e.target.id === 'final-add-modal') {
            closeFinalAddDialog();
        }
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

    // Vista Final
    const toggleBtn = document.getElementById('toggle-final-view-btn');
    const closeBtn = document.getElementById('close-final-view-btn');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', openFinalView);
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', closeFinalView);
    }
    document.querySelectorAll('.final-tab-btn').forEach(btn => {
        btn.addEventListener('click', handleFinalTabClick);
    });
}

async function initializeSession() {
    try {
        const session = await apiCall('/api/auth/me', {}, { silent: true, skipUnauthorizedHandler: true });
        setSessionUser(session);
        switchSection('dashboard');
        await checkHealthStatus();
        await loadDashboardStats();
    } catch (error) {
        setSessionUser(null);
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email) {
        showToast('Ingresa un correo electrónico válido', 'error');
        return;
    }

    try {
        const session = await apiCall('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }, { skipUnauthorizedHandler: true });

        setSessionUser(session);
        document.getElementById('login-password').value = '';
        switchSection('dashboard');
        await checkHealthStatus();
        await loadDashboardStats();
        showToast('Sesión iniciada correctamente', 'success');
    } catch (error) {
        // Error mostrado por apiCall
    }
}

async function handleLogout() {
    try {
        await apiCall('/api/auth/logout', { method: 'DELETE' }, { silent: true, skipUnauthorizedHandler: true });
    } catch (error) {
        // Ignorar: aun con error local, forzamos salida visual.
    }

    setSessionUser(null);
    showToast('Sesión cerrada', 'info');
}

function setSessionUser(sessionUser) {
    appState.sessionUser = sessionUser || null;
    updateAuthUi();
    applyRolePermissions();
    initializeAutoRefresh();
}

function updateAuthUi() {
    const isAuthenticated = Boolean(appState.sessionUser);
    const loginForm = document.getElementById('login-form');
    const sessionPanel = document.getElementById('session-panel');
    const mainNavbar = document.getElementById('main-navbar');
    const mainContent = document.getElementById('main-content');
    const mainFooter = document.getElementById('main-footer');

    loginForm.style.display = isAuthenticated ? 'none' : 'grid';
    sessionPanel.style.display = isAuthenticated ? 'flex' : 'none';
    mainNavbar.hidden = !isAuthenticated;
    mainContent.hidden = !isAuthenticated;
    mainFooter.hidden = !isAuthenticated;

    if (isAuthenticated) {
        document.getElementById('session-user-name').textContent = appState.sessionUser.displayName || 'Usuario';
        document.getElementById('session-user-role').textContent = appState.sessionUser.role === 'ADMIN' ? 'Administrador' : 'Usuario';
    }
}

function applyRolePermissions() {
    const isAdmin = isAdminSession();
    const migrateNavBtn = document.querySelector('.nav-btn[data-section="migrate"]');

    if (migrateNavBtn) {
        migrateNavBtn.style.display = isAdmin ? 'inline-block' : 'none';
    }

    if (!isAdmin) {
        const activeSection = document.querySelector('.section.active');
        if (activeSection && activeSection.id === 'migrate-section') {
            switchSection('dashboard');
        }
    }

    document.getElementById('insert-row-btn').style.display = isAdmin ? 'inline-block' : 'none';
    document.getElementById('execute-migrate-btn').style.display = isAdmin ? 'inline-block' : 'none';
    document.getElementById('run-migrate-btn').style.display = isAdmin ? 'inline-block' : 'none';
}

function isAdminSession() {
    return appState.sessionUser?.role === 'ADMIN';
}

function canEditCurrentTable() {
    if (!isAdminSession()) {
        return false;
    }

    const nonEditableTables = new Set(['administradores', 'grado_forma', 'alumno_forma', 'instructor_estilo', 'flyway_schema_history']);
    return !nonEditableTables.has(appState.selectedTable);
}

// ==================== Navegación ==================== 
function handleNavigation(e) {
    if (!appState.sessionUser) {
        showToast('Inicia sesión para navegar', 'info');
        return;
    }

    const section = e.target.dataset.section;
    switchSection(section);

    // Actualizar botones activos
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
}

function switchSection(sectionName) {
    if (!appState.sessionUser) {
        return;
    }

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

// ==================== Vista Final ====================
function openFinalView() {
    const overlay = document.getElementById('final-view-overlay');
    const container = document.querySelector('.container');
    const toastContainer = document.getElementById('toast-container');
    
    if (overlay) {
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Ocultar la interfaz anterior
        if (container) container.style.display = 'none';
        if (toastContainer) toastContainer.style.display = 'none';
        
        // Cargar datos de la primera pestaña
        loadFinalTabData('administradores');
    }
}

function closeFinalView() {
    const overlay = document.getElementById('final-view-overlay');
    const container = document.querySelector('.container');
    const toastContainer = document.getElementById('toast-container');
    
    if (overlay) {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
        
        // Mostrar la interfaz anterior
        if (container) container.style.display = 'flex';
        if (toastContainer) toastContainer.style.display = 'flex';
    }
}

function handleFinalTabClick(e) {
    const tabName = e.target.dataset.tab;

    // Cerrar modal si está abierto
    closeFinalAddDialog();

    document.querySelectorAll('.final-tab-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');

    document.querySelectorAll('.final-tab-panel').forEach(panel => panel.classList.remove('active'));
    const panel = document.getElementById(`final-tab-${tabName}`);
    if (panel) {
        panel.classList.add('active');
        loadFinalTabData(tabName);
    }
}

// ==================== Final View Data Loading ====================
const finalViewState = {
    currentTable: null,
    currentColumns: [],
    currentData: [],
    editingRowId: null,
    editingMode: false
};

function getPrimaryKeyField(columns) {
    const pkColumn = columns.find(col => col.primaryKey);
    return pkColumn ? pkColumn.name : 'id';
}

async function loadFinalTabData(tableName) {
    finalViewState.currentTable = tableName;
    const tableContainer = document.getElementById(`final-table-${tableName}`);
    
    if (!tableContainer) return;
    
    try {
        tableContainer.innerHTML = '<div class="loading"><span class="spinner"></span> Cargando...</div>';
        
        // Cargar datos especiales para relaciones foráneas
        await loadSpecialDataForTable(tableName);
        
        // Obtener columnas
        const columns = await apiCall(`/api/database/tables/${encodeURIComponent(tableName)}/columns`);
        finalViewState.currentColumns = columns;
        
        // Obtener datos
        const rows = await apiCall(`/api/database/tables/${encodeURIComponent(tableName)}/rows?limit=1000`);
        finalViewState.currentData = rows || [];
        
        renderFinalTable(tableName, columns, rows);
    } catch (error) {
        tableContainer.innerHTML = '<div class="final-table-empty"><p>Error al cargar datos</p></div>';
    }
}

function getForeignKeyDisplayValue(tableName, columnName, value) {
    if (value === null || value === undefined) return '—';
    
    // Mapeo de id_campo -> opciones y campo de nombre
    const mappings = {
        'alumnos': {
            'id_grado': { options: 'gradosOptions', nameField: 'nombre' }
        },
        'formas': {
            'id_estilo': { options: 'estilosOptions', nameField: 'nombre' }
        },
        'grado_forma': {
            'id_grado': { options: 'gradosOptions', nameField: 'nombre' }
        },
        'alumno_forma': {
            'id_forma': { options: 'formasOptions', nameField: 'nombre' }
        },
        'cursos_agendados': {
            'id_curso': { options: 'cursosOptions', nameField: 'nombre' },
            'id_instructor': { options: 'instructoresOptions', nameField: 'nombre' }
        }
    };
    
    // Verificar si este campo necesita mapeo
    const tableMapping = mappings[tableName];
    if (!tableMapping || !tableMapping[columnName]) {
        return String(value).substring(0, 50);
    }
    
    const { options, nameField } = tableMapping[columnName];
    const optionsArray = appState[options] || [];
    
    if (optionsArray.length === 0) {
        return String(value);
    }
    
    // Verificar estructura de datos - encontrar la propiedad ID correcta
    const firstItem = optionsArray[0];
    const idField = Object.keys(firstItem || {}).find(k => k.includes('id') && k !== 'id');
    const actualIdField = idField || 'id';
    
    const item = optionsArray.find(opt => opt[actualIdField] == value || opt.id == value);
    return item && item[nameField] ? item[nameField] : String(value);
}

function renderFinalTable(tableName, columns, rows) {
    const tableContainer = document.getElementById(`final-table-${tableName}`);
    
    if (!tableContainer) return;
    
    if (!rows || rows.length === 0) {
        tableContainer.innerHTML = '<div class="final-table-empty"><p>No hay registros disponibles</p></div>';
        return;
    }
    
    // Filtrar columnas para mostrar (excluir campos muy largos)
    const displayColumns = columns.filter(col => {
        const type = String(col.dataType || '').toLowerCase();
        return !type.includes('text') && !type.includes('json');
    }).slice(0, 8);
    
    const pkField = getPrimaryKeyField(columns);
    
    let html = '<table class="final-data-table"><thead><tr>';
    displayColumns.forEach(col => {
        html += `<th>${col.name}</th>`;
    });
    html += '<th>Acciones</th></tr></thead><tbody>';
    
    rows.forEach(row => {
        const rowId = row[pkField];
        html += '<tr>';
        displayColumns.forEach(col => {
            const value = row[col.name];
            const displayValue = getForeignKeyDisplayValue(tableName, col.name, value);
            html += `<td>${displayValue}</td>`;
        });
        html += `<td class="final-table-actions">
                    <button class="final-btn-edit" data-row-id="${rowId}" title="Editar">✏️</button>
                    <button class="final-btn-delete" data-row-id="${rowId}" title="Eliminar">🗑️</button>
                 </td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    tableContainer.innerHTML = html;
    
    // Agregar event listeners a los botones
    tableContainer.querySelectorAll('.final-btn-edit').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const rowId = btn.dataset.rowId;
            const row = rows.find(r => r[pkField] == rowId);
            if (row) {
                await openFinalEditDialog(tableName, row);
            }
        });
    });
    
    tableContainer.querySelectorAll('.final-btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const rowId = btn.dataset.rowId;
            if (confirm(`¿Estás seguro de que deseas eliminar este registro?`)) {
                await deleteFinalRow(tableName, rowId, pkField);
            }
        });
    });
}

// ==================== Final Add Dialog ====================
async function openFinalAddDialog(tableName) {
    if (!appState.sessionUser) {
        showToast('Debes iniciar sesión', 'info');
        return;
    }
    
    if (!isAdminSession()) {
        showToast('Solo administradores pueden agregar elementos', 'info');
        return;
    }
    
    try {
        // Obtener columnas para el formulario
        const columns = await apiCall(`/api/database/tables/${encodeURIComponent(tableName)}/columns`);
        finalViewState.currentTable = tableName;
        finalViewState.currentColumns = columns;
        
        // Cargar datos especiales si es necesario
        await loadSpecialDataForTable(tableName);
        
        // Generar formulario
        finalViewState.editingMode = false;
        finalViewState.editingRowId = null;
        renderFinalAddForm(columns);
        
        // Mostrar modal
        const modal = document.getElementById('final-add-modal');
        modal.style.display = 'flex';
        document.getElementById('final-add-modal-title').textContent = `Agregar a ${tableName}`;
    } catch (error) {
        showToast('Error al abrir el formulario', 'error');
    }
}

async function openFinalEditDialog(tableName, rowData) {
    if (!appState.sessionUser) {
        showToast('Debes iniciar sesión', 'info');
        return;
    }
    
    if (!isAdminSession()) {
        showToast('Solo administradores pueden editar elementos', 'info');
        return;
    }
    
    try {
        // Obtener columnas para el formulario
        const columns = await apiCall(`/api/database/tables/${encodeURIComponent(tableName)}/columns`);
        finalViewState.currentTable = tableName;
        finalViewState.currentColumns = columns;
        
        // Cargar datos especiales si es necesario
        await loadSpecialDataForTable(tableName);
        
        // Generar formulario en modo edición
        finalViewState.editingMode = true;
        const pkField = getPrimaryKeyField(columns);
        finalViewState.editingRowId = rowData[pkField];
        renderFinalAddForm(columns, rowData);
        
        // Mostrar modal
        const modal = document.getElementById('final-add-modal');
        modal.style.display = 'flex';
        document.getElementById('final-add-modal-title').textContent = `Editar ${tableName}`;
    } catch (error) {
        showToast('Error al abrir el formulario de edición', 'error');
    }
}

async function deleteFinalRow(tableName, rowId, pkField) {
    try {
        await apiCall(`/api/database/tables/${encodeURIComponent(tableName)}/rows/${rowId}`, {
            method: 'DELETE'
        });
        
        showToast(`✓ Registro eliminado de ${tableName}`, 'success');
        
        // Recargar datos
        await loadFinalTabData(tableName);
    } catch (error) {
        console.error('Error al eliminar:', error);
        showToast(`Error al eliminar: ${error.message || 'Intenta nuevamente'}`, 'error');
    }
}

async function loadSpecialDataForTable(tableName) {
    try {
        // Cargar datos de lookup para tablas que lo necesiten
        if (tableName === 'alumnos') {
            try {
                const grados = await apiCall('/api/database/tables/grados/rows?limit=100');
                appState.gradosOptions = grados || [];
            } catch (e) {
                appState.gradosOptions = [];
            }
        }
        if (tableName === 'formas') {
            try {
                const estilos = await apiCall('/api/database/tables/estilos/rows?limit=100');
                appState.estilosOptions = estilos || [];
            } catch (e) {
                appState.estilosOptions = [];
            }
        }
        if (tableName === 'cursos_agendados') {
            try {
                const cursos = await apiCall('/api/database/tables/cursos/rows?limit=100');
                const instructores = await apiCall('/api/database/tables/instructores/rows?limit=100');
                appState.cursosAgendadosOptions = { 
                    cursos: cursos || [], 
                    instructores: instructores || [] 
                };
                appState.cursosOptions = cursos || [];
                appState.instructoresOptions = instructores || [];
            } catch (e) {
                appState.cursosAgendadosOptions = { cursos: [], instructores: [] };
            }
        }
        if (tableName === 'grado_forma') {
            try {
                const grados = await apiCall('/api/database/tables/grados/rows?limit=100');
                const formas = await apiCall('/api/database/tables/formas/rows?limit=100');
                appState.gradoFormaFormasOptions = formas || [];
                appState.gradosOptions = grados || [];
                appState.formasOptions = formas || [];
            } catch (e) {
                console.warn('Error cargando datos para grado_forma:', e);
            }
        }
        if (tableName === 'alumno_forma') {
            try {
                const alumnos = await apiCall('/api/database/tables/alumnos/rows?limit=100');
                const formas = await apiCall('/api/database/tables/formas/rows?limit=100');
                appState.alumnoFormaAlumnosOptions = alumnos || [];
                appState.alumnoFormaFormasOptions = formas || [];
                appState.formasOptions = formas || [];
            } catch (e) {
                console.warn('Error cargando datos para alumno_forma:', e);
            }
        }
    } catch (e) {
        console.warn('Error cargando datos especiales para tabla:', tableName, e);
    }
}

function renderFinalAddForm(columns, rowData = null) {
    const form = document.getElementById('final-add-form');
    
    const editableColumns = columns.filter(col => {
        if (col.autoGenerated) return false;
        if (finalViewState.currentTable === 'grado_forma' || finalViewState.currentTable === 'alumno_forma') return true;
        return !col.primaryKey;
    });
    
    if (editableColumns.length === 0) {
        form.innerHTML = '<p class="info-text">No hay columnas editables para esta tabla.</p>';
        return;
    }
    
    form.innerHTML = editableColumns.map(col => {
        const dataType = String(col.dataType || '').toLowerCase();
        const isRequired = !col.nullable && !col.hasDefault;
        const requiredAttr = isRequired ? 'required' : '';
        const requiredLabel = isRequired ? '<span class="required-indicator">*</span>' : '';
        const currentValue = rowData ? rowData[col.name] : null;
        
        // Detectar campos booleanos
        const isBooleanField = dataType.includes('boolean') || dataType.includes('bool') || 
                               (dataType.includes('tinyint') && dataType.includes('(1)'));
        
        if (isBooleanField) {
            const isChecked = currentValue ? 'checked' : '';
            return `
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="field-${col.name}" class="form-checkbox" data-column="${col.name}" ${isChecked}>
                        ${col.name}
                    </label>
                </div>
            `;
        }
        
        // Select para id_grado en alumnos
        if (finalViewState.currentTable === 'alumnos' && col.name === 'id_grado') {
            const grados = appState.gradosOptions || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Grado${requiredLabel}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona un grado</option>
                        ${grados.map(g => {
                            const selected = currentValue && g.id_grado == currentValue ? 'selected' : '';
                            return `<option value="${g.id_grado}" ${selected}>${g.nombre || `Grado ${g.id_grado}`}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
        }
        
        // Select para id_estilo en formas
        if (finalViewState.currentTable === 'formas' && col.name === 'id_estilo') {
            const estilos = appState.estilosOptions || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Estilo${requiredLabel}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona un estilo</option>
                        ${estilos.map(e => {
                            const selected = currentValue && e.id_estilo == currentValue ? 'selected' : '';
                            return `<option value="${e.id_estilo}" ${selected}>${e.nombre || `Estilo ${e.id_estilo}`}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
        }
        
        // Select para id_grado en grado_forma
        if (finalViewState.currentTable === 'grado_forma' && col.name === 'id_grado') {
            const grados = appState.gradosOptions || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Grado${requiredLabel}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona un grado</option>
                        ${grados.map(g => {
                            const selected = currentValue && g.id_grado == currentValue ? 'selected' : '';
                            return `<option value="${g.id_grado}" ${selected}>${g.nombre || `Grado ${g.id_grado}`}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
        }
        
        // Select para id_forma en grado_forma
        if (finalViewState.currentTable === 'grado_forma' && col.name === 'id_forma') {
            const formas = appState.gradoFormaFormasOptions || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Forma${requiredLabel}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona una forma</option>
                        ${formas.map(f => {
                            const selected = currentValue && f.id_forma == currentValue ? 'selected' : '';
                            return `<option value="${f.id_forma}" ${selected}>${f.nombre || `Forma ${f.id_forma}`}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
        }
        
        // Select para id_alumno en alumno_forma
        if (finalViewState.currentTable === 'alumno_forma' && col.name === 'id_alumno') {
            const alumnos = appState.alumnoFormaAlumnosOptions || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Alumno${requiredLabel}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona un alumno</option>
                        ${alumnos.map(a => {
                            const selected = currentValue && a.id_alumno == currentValue ? 'selected' : '';
                            return `<option value="${a.id_alumno}" ${selected}>${a.nombre || `Alumno ${a.id_alumno}`}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
        }
        
        // Select para id_forma en alumno_forma
        if (finalViewState.currentTable === 'alumno_forma' && col.name === 'id_forma') {
            const formas = appState.alumnoFormaFormasOptions || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Forma${requiredLabel}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona una forma</option>
                        ${formas.map(f => {
                            const selected = currentValue && f.id_forma == currentValue ? 'selected' : '';
                            return `<option value="${f.id_forma}" ${selected}>${f.nombre || `Forma ${f.id_forma}`}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
        }
        
        // Select para id_curso en cursos_agendados
        if (finalViewState.currentTable === 'cursos_agendados' && col.name === 'id_curso') {
            const cursos = appState.cursosAgendadosOptions?.cursos || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Curso${requiredLabel}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona un curso</option>
                        ${cursos.map(c => {
                            const selected = currentValue && c.id_curso == currentValue ? 'selected' : '';
                            return `<option value="${c.id_curso}" ${selected}>${c.nombre || `Curso ${c.id_curso}`}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
        }
        
        // Select para id_instructor en cursos_agendados
        if (finalViewState.currentTable === 'cursos_agendados' && col.name === 'id_instructor') {
            const instructores = appState.cursosAgendadosOptions?.instructores || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Instructor${requiredLabel}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona un instructor</option>
                        ${instructores.map(i => {
                            const selected = currentValue && i.id_instructor == currentValue ? 'selected' : '';
                            return `<option value="${i.id_instructor}" ${selected}>${i.nombre || `Instructor ${i.id_instructor}`}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
        }
        
        // Campos de texto
        if (dataType.includes('varchar') || dataType.includes('char') || dataType.includes('text')) {
            const value = currentValue || '';
            return `
                <div class="form-group">
                    <label for="field-${col.name}">${col.name}${requiredLabel}</label>
                    <input type="text" id="field-${col.name}" class="form-input" data-column="${col.name}" value="${value}" ${requiredAttr}>
                </div>
            `;
        }
        
        // Select para id_forma en alumno_forma
        if (finalViewState.currentTable === 'alumno_forma' && col.name === 'id_forma') {
            const formas = appState.alumnoFormaFormasOptions || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Forma${requiredLabel}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona una forma</option>
                        ${formas.map(f => {
                            const selected = currentValue && f.id_forma == currentValue ? 'selected' : '';
                            return `<option value="${f.id_forma}" ${selected}>${f.nombre || `Forma ${f.id_forma}`}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
        }
        
        // Select para id_curso en cursos_agendados
        if (finalViewState.currentTable === 'cursos_agendados' && col.name === 'id_curso') {
            const cursos = appState.cursosAgendadosOptions?.cursos || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Curso${requiredLabel}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona un curso</option>
                        ${cursos.map(c => {
                            const selected = currentValue && c.id_curso == currentValue ? 'selected' : '';
                            return `<option value="${c.id_curso}" ${selected}>${c.nombre || `Curso ${c.id_curso}`}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
        }
        
        // Select para id_instructor en cursos_agendados
        if (finalViewState.currentTable === 'cursos_agendados' && col.name === 'id_instructor') {
            const instructores = appState.cursosAgendadosOptions?.instructores || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Instructor${requiredLabel}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona un instructor</option>
                        ${instructores.map(i => {
                            const selected = currentValue && i.id_instructor == currentValue ? 'selected' : '';
                            return `<option value="${i.id_instructor}" ${selected}>${i.nombre || `Instructor ${i.id_instructor}`}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
        }
        
        // Campos numéricos
        if (dataType.includes('int') || dataType.includes('decimal') || dataType.includes('float')) {
            const value = currentValue || '';
            return `
                <div class="form-group">
                    <label for="field-${col.name}">${col.name}${requiredLabel}</label>
                    <input type="number" id="field-${col.name}" class="form-input" data-column="${col.name}" value="${value}" ${requiredAttr}>
                </div>
            `;
        }
        
        // Campos de fecha
        if (dataType.includes('date') || dataType.includes('timestamp')) {
            const value = currentValue || '';
            return `
                <div class="form-group">
                    <label for="field-${col.name}">${col.name}${requiredLabel}</label>
                    <input type="date" id="field-${col.name}" class="form-input" data-column="${col.name}" value="${value}" ${requiredAttr}>
                </div>
            `;
        }
        
        // Por defecto
        const value = currentValue || '';
        return `
            <div class="form-group">
                <label for="field-${col.name}">${col.name}${requiredLabel}</label>
                <input type="text" id="field-${col.name}" class="form-input" data-column="${col.name}" value="${value}" ${requiredAttr}>
            </div>
        `;
    }).join('');
}

function closeFinalAddDialog() {
    const modal = document.getElementById('final-add-modal');
    modal.style.display = 'none';
    document.getElementById('final-add-form').innerHTML = '';
    finalViewState.currentTable = null;
    finalViewState.editingMode = false;
    finalViewState.editingRowId = null;
}

async function saveFinalAddForm() {
    const tableName = finalViewState.currentTable;
    
    if (!tableName) {
        showToast('Error: no hay tabla seleccionada', 'error');
        return;
    }
    
    const form = document.getElementById('final-add-form');
    const inputs = form.querySelectorAll('[data-column]');
    
    const rowData = {};
    let isValid = true;
    const missingFields = [];
    
    inputs.forEach(input => {
        const colName = input.dataset.column;
        
        // Limpiar estilos previos
        input.style.borderColor = '';
        input.parentElement.style.backgroundColor = '';
        
        if (input.type === 'checkbox') {
            rowData[colName] = input.checked;
        } else {
            const value = input.value.trim();
            
            if (input.hasAttribute('required') && !value) {
                isValid = false;
                missingFields.push(colName);
                input.style.borderColor = 'var(--danger-color)';
                input.style.borderWidth = '2px';
                input.parentElement.style.backgroundColor = '#ffebee';
            } else {
                input.style.borderColor = '';
                rowData[colName] = value || null;
            }
        }
    });
    
    if (!isValid) {
        const errorMsg = `Campos obligatorios faltantes:\n\n• ${missingFields.join('\n• ')}`;
        showToast(errorMsg, 'error');
        return;
    }
    
    try {
        let response;
        let successMsg;
        
        if (finalViewState.editingMode) {
            // Modo edición - PUT
            const rowId = finalViewState.editingRowId;
            response = await apiCall(`/api/database/tables/${encodeURIComponent(tableName)}/rows/${rowId}`, {
                method: 'PUT',
                body: JSON.stringify(rowData)
            });
            successMsg = `✓ Elemento actualizado en ${tableName}`;
        } else {
            // Modo agregar - POST
            response = await apiCall(`/api/database/tables/${encodeURIComponent(tableName)}/rows`, {
                method: 'POST',
                body: JSON.stringify(rowData)
            });
            successMsg = `✓ Elemento agregado a ${tableName}`;
        }
        
        showToast(successMsg, 'success');
        closeFinalAddDialog();
        
        // Recargar datos completos para asegurar sincronización
        setTimeout(() => {
            loadFinalTabData(tableName);
        }, 500);
    } catch (error) {
        console.error('Error al guardar:', error);
        showToast(`Error al guardar: ${error.message || 'Intenta nuevamente'}`, 'error');
    }
}

// ==================== API Calls ==================== 
async function apiCall(endpoint, options = {}, requestOptions = {}) {
    const { silent = false, skipUnauthorizedHandler = false } = requestOptions;
    const baseUrl = normalizeApiUrl(appState.apiUrl) || DEFAULT_API_URL;
    const url = `${baseUrl}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        ...options,
    };

    try {
        const response = await fetch(url, defaultOptions);

        if (!response.ok) {
            if (response.status === 401 && !skipUnauthorizedHandler) {
                setSessionUser(null);
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (response.status === 204) {
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        if (!silent) {
            showToast(`Error: ${error.message}`, 'error');
        }
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
    if (!appState.sessionUser) {
        return;
    }

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
    if (!appState.sessionUser) {
        showToast('Inicia sesión para ver datos', 'info');
        return;
    }

    try {
        appState.selectedTable = tableName;
        document.getElementById('table-data-panel').style.display = 'block';
        document.getElementById('selected-table-name').textContent = tableName;

        const columns = await apiCall(`/api/database/tables/${encodeURIComponent(tableName)}/columns`);
        appState.selectedColumns = columns;
        
        // Cargar datos especiales para cursos_agendados
        if (tableName === 'cursos_agendados') {
            try {
                const cursos = await apiCall('/api/database/tables/cursos/rows?limit=100');
                const instructores = await apiCall('/api/database/tables/instructores/rows?limit=100');
                appState.cursosAgendadosOptions = {
                    cursos: cursos || [],
                    instructores: instructores || []
                };
            } catch (e) {
                console.warn('No se pudieron cargar opciones para cursos_agendados:', e);
                appState.cursosAgendadosOptions = { cursos: [], instructores: [] };
            }
        }

        // Cargar catalogo de grados para alumnos
        if (tableName === 'alumnos') {
            try {
                const grados = await apiCall('/api/database/tables/grados/rows?limit=200');
                appState.gradosOptions = grados || [];
            } catch (e) {
                console.warn('No se pudo cargar el catalogo de grados:', e);
                appState.gradosOptions = [];
            }
        }

        // Cargar catalogo de estilos para formas
        if (tableName === 'formas') {
            try {
                const estilos = await apiCall('/api/database/tables/estilos/rows?limit=200');
                appState.estilosOptions = estilos || [];
            } catch (e) {
                console.warn('No se pudo cargar el catalogo de estilos:', e);
                appState.estilosOptions = [];
            }
        }

        // Cargar catalogo de formas para grado_forma
        if (tableName === 'grado_forma') {
            try {
                const formas = await apiCall('/api/database/tables/formas/rows?limit=200');
                const grados = await apiCall('/api/database/tables/grados/rows?limit=200');
                appState.gradoFormaFormasOptions = formas || [];
                appState.gradosOptions = grados || [];
            } catch (e) {
                console.warn('No se pudo cargar el catalogo de grados/formas para grado_forma:', e);
                appState.gradoFormaFormasOptions = [];
                appState.gradosOptions = [];
            }
        }

        // Cargar catalogo de alumnos y formas para alumno_forma
        if (tableName === 'alumno_forma') {
            try {
                const alumnos = await apiCall('/api/database/tables/alumnos/rows?limit=200');
                const formas = await apiCall('/api/database/tables/formas/rows?limit=200');
                appState.alumnoFormaAlumnosOptions = alumnos || [];
                appState.alumnoFormaFormasOptions = formas || [];
            } catch (e) {
                console.warn('No se pudo cargar el catalogo de alumnos/formas para alumno_forma:', e);
                appState.alumnoFormaAlumnosOptions = [];
                appState.alumnoFormaFormasOptions = [];
            }
        }
        
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

        // Mantener el formulario de grado_forma sincronizado con catalogos actualizados
        if (tableName === 'grado_forma') {
            try {
                const formas = await apiCall('/api/database/tables/formas/rows?limit=200');
                const grados = await apiCall('/api/database/tables/grados/rows?limit=200');
                appState.gradoFormaFormasOptions = formas || [];
                appState.gradosOptions = grados || [];
                renderInsertForm(appState.selectedColumns);
            } catch (e) {
                console.warn('No se pudieron refrescar catalogos de grado_forma:', e);
            }
        }

        // Mantener el formulario de alumno_forma sincronizado con catalogos actualizados
        if (tableName === 'alumno_forma') {
            try {
                const alumnos = await apiCall('/api/database/tables/alumnos/rows?limit=200');
                const formas = await apiCall('/api/database/tables/formas/rows?limit=200');
                appState.alumnoFormaAlumnosOptions = alumnos || [];
                appState.alumnoFormaFormasOptions = formas || [];
                renderInsertForm(appState.selectedColumns);
            } catch (e) {
                console.warn('No se pudieron refrescar catalogos de alumno_forma:', e);
            }
        }

        const rawRows = await apiCall(`/api/database/tables/${encodeURIComponent(tableName)}/rows?limit=100`);
        appState.selectedRowsRaw = rawRows || [];
        let rows = rawRows;
        
        // Enriquecer datos para cursos_agendados
        if (tableName === 'cursos_agendados' && rows.length > 0) {
            rows = await enrichCursosAgendadosData(rows);
        }

        // Enriquecer datos para alumnos
        if (tableName === 'alumnos' && rows.length > 0) {
            rows = await enrichAlumnosData(rows);
        }

        // Enriquecer datos para formas
        if (tableName === 'formas' && rows.length > 0) {
            rows = await enrichFormasData(rows);
        }

        // Enriquecer datos para grado_forma
        if (tableName === 'grado_forma' && rows.length > 0) {
            rows = await enrichGradoFormaData(rows);
        }

        // Enriquecer datos para alumno_forma
        if (tableName === 'alumno_forma' && rows.length > 0) {
            rows = await enrichAlumnoFormaData(rows);
        }
        
        renderTableData(rows, appState.selectedColumns);
    } catch (error) {
        showToast('No se pudieron cargar los registros', 'error');
    }
}

async function enrichCursosAgendadosData(rows) {
    try {
        // Cargar mapeos de IDs a nombres
        const instructores = await apiCall('/api/database/tables/instructores/rows?limit=100');
        const cursos = await apiCall('/api/database/tables/cursos/rows?limit=100');
        
        const instructorMap = {};
        const cursoMap = {};
        
        instructores.forEach(i => {
            instructorMap[i.id_instructor] = i.nombre || `Instructor ${i.id_instructor}`;
        });
        
        cursos.forEach(c => {
            cursoMap[c.id_curso] = c.nombre || `Curso ${c.id_curso}`;
        });
        
        // Enriquecer cada fila
        return rows.map(row => ({
            ...row,
            id_instructor: `${row.id_instructor} - ${instructorMap[row.id_instructor] || 'Desconocido'}`,
            id_curso: `${row.id_curso} - ${cursoMap[row.id_curso] || 'Desconocido'}`
        }));
    } catch (e) {
        console.warn('Error enriqueciendo datos de cursos_agendados:', e);
        return rows;
    }
}

async function enrichAlumnosData(rows) {
    try {
        const grados = appState.gradosOptions?.length > 0
            ? appState.gradosOptions
            : await apiCall('/api/database/tables/grados/rows?limit=200');

        const gradoMap = {};
        grados.forEach(g => {
            gradoMap[g.id_grado] = g.nombre || `Grado ${g.id_grado}`;
        });

        return rows.map(row => ({
            ...row,
            id_grado: row.id_grado === null || row.id_grado === undefined
                ? row.id_grado
                : `${row.id_grado} - ${gradoMap[row.id_grado] || 'Desconocido'}`,
        }));
    } catch (e) {
        console.warn('Error enriqueciendo datos de alumnos:', e);
        return rows;
    }
}

async function enrichFormasData(rows) {
    try {
        const estilos = appState.estilosOptions?.length > 0
            ? appState.estilosOptions
            : await apiCall('/api/database/tables/estilos/rows?limit=200');

        const estiloMap = {};
        estilos.forEach(e => {
            estiloMap[e.id_estilo] = e.nombre || `Estilo ${e.id_estilo}`;
        });

        return rows.map(row => ({
            ...row,
            id_estilo: row.id_estilo === null || row.id_estilo === undefined
                ? row.id_estilo
                : `${row.id_estilo} - ${estiloMap[row.id_estilo] || 'Desconocido'}`,
        }));
    } catch (e) {
        console.warn('Error enriqueciendo datos de formas:', e);
        return rows;
    }
}

async function enrichGradoFormaData(rows) {
    try {
        const grados = appState.gradosOptions?.length > 0
            ? appState.gradosOptions
            : await apiCall('/api/database/tables/grados/rows?limit=200');

        const formas = appState.gradoFormaFormasOptions?.length > 0
            ? appState.gradoFormaFormasOptions
            : await apiCall('/api/database/tables/formas/rows?limit=200');

        const gradoMap = {};
        const formaMap = {};

        grados.forEach(g => {
            gradoMap[g.id_grado] = g.nombre || `Grado ${g.id_grado}`;
        });

        formas.forEach(f => {
            formaMap[f.id_forma] = f.nombre || `Forma ${f.id_forma}`;
        });

        return rows.map(row => ({
            ...row,
            id_grado: row.id_grado === null || row.id_grado === undefined
                ? row.id_grado
                : `${row.id_grado} - ${gradoMap[row.id_grado] || 'Desconocido'}`,
            id_forma: row.id_forma === null || row.id_forma === undefined
                ? row.id_forma
                : `${row.id_forma} - ${formaMap[row.id_forma] || 'Desconocida'}`,
        }));
    } catch (e) {
        console.warn('Error enriqueciendo datos de grado_forma:', e);
        return rows;
    }
}

async function enrichAlumnoFormaData(rows) {
    try {
        const alumnos = appState.alumnoFormaAlumnosOptions?.length > 0
            ? appState.alumnoFormaAlumnosOptions
            : await apiCall('/api/database/tables/alumnos/rows?limit=200');

        const formas = appState.alumnoFormaFormasOptions?.length > 0
            ? appState.alumnoFormaFormasOptions
            : await apiCall('/api/database/tables/formas/rows?limit=200');

        const alumnoMap = {};
        const formaMap = {};

        alumnos.forEach(a => {
            alumnoMap[a.id_alumno] = a.nombre || a.numero_matricula || `Alumno ${a.id_alumno}`;
        });

        formas.forEach(f => {
            formaMap[f.id_forma] = f.nombre || `Forma ${f.id_forma}`;
        });

        return rows.map(row => ({
            ...row,
            id_alumno: row.id_alumno === null || row.id_alumno === undefined
                ? row.id_alumno
                : `${row.id_alumno} - ${alumnoMap[row.id_alumno] || 'Desconocido'}`,
            id_forma: row.id_forma === null || row.id_forma === undefined
                ? row.id_forma
                : `${row.id_forma} - ${formaMap[row.id_forma] || 'Desconocida'}`,
        }));
    } catch (e) {
        console.warn('Error enriqueciendo datos de alumno_forma:', e);
        return rows;
    }
}

function renderTableData(rows, columns) {
    const head = document.getElementById('table-data-head');
    const body = document.getElementById('table-data-body');
    const empty = document.getElementById('table-data-empty');
    const table = document.getElementById('table-data-table');
    const primaryKeyColumn = columns.find(col => col.primaryKey)?.name;
    const showActions = isAdminSession();

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
            ${showActions ? '<th>Acciones</th>' : ''}
        </tr>
    `;

    body.innerHTML = rows.map((row, index) => {
        const rawRow = appState.selectedRowsRaw[index] || row;
        const primaryKeyValue = primaryKeyColumn ? rawRow[primaryKeyColumn] : undefined;
        const actionButtons = [];

        if (showActions && canEditCurrentTable() && primaryKeyColumn && primaryKeyValue !== undefined) {
            actionButtons.push(`<button class="btn btn-info btn-sm" onclick="editRowByIndex(${index})">Editar</button>`);
        }

        if (showActions && primaryKeyColumn && primaryKeyValue !== undefined) {
            actionButtons.push(`<button class="btn btn-danger btn-sm" onclick="deleteRow('${appState.selectedTable}', '${String(primaryKeyValue).replace(/'/g, "\\'")}')">Eliminar</button>`);
        }

        const actionCell = actionButtons.length > 0
            ? actionButtons.join(' ')
            : '<span class="text-muted">Sin acciones</span>';

        return `
            <tr>
                ${columnNames.map(name => {
                    if (appState.selectedTable === 'grado_forma' && name === 'es_opcional') {
                        return `<td>${row[name] === true ? 'Optativa' : 'Obligatoria'}</td>`;
                    }
                    return `<td>${formatCellValue(row[name])}</td>`;
                }).join('')}
                ${showActions ? `<td>${actionCell}</td>` : ''}
            </tr>
        `;
    }).join('');
}

function renderInsertForm(columns) {
    const form = document.getElementById('insert-row-form');
    if (!isAdminSession()) {
        form.innerHTML = '<p class="info-text">Solo los administradores pueden agregar registros.</p>';
        return;
    }

    const editableColumns = columns.filter(col => {
        if (col.autoGenerated) {
            return false;
        }

        // grado_forma usa PK compuesta manual (id_grado + id_forma), por eso deben capturarse en formulario.
        if (appState.selectedTable === 'grado_forma' || appState.selectedTable === 'alumno_forma') {
            return true;
        }

        return !col.primaryKey;
    });

    if (editableColumns.length === 0) {
        form.innerHTML = '<p class="info-text">No hay columnas editables para insertar en esta tabla.</p>';
        return;
    }

    form.innerHTML = editableColumns.map(col => {
        const dataType = String(col.dataType || '').toLowerCase();
        const isRequired = !col.nullable && !col.hasDefault;
        const requiredAttr = isRequired ? 'required' : '';

        // Manejador especial para id_curso en cursos_agendados
        if (appState.selectedTable === 'cursos_agendados' && col.name === 'id_curso') {
            const cursos = appState.cursosAgendadosOptions?.cursos || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Curso (${col.dataType})${isRequired ? ' *' : ''}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona un curso</option>
                        ${cursos.map(c => `<option value="${c.id_curso}">${c.nombre || `Curso ${c.id_curso}`}</option>`).join('')}
                    </select>
                </div>
            `;
        }

        // Manejador especial para id_instructor en cursos_agendados
        if (appState.selectedTable === 'cursos_agendados' && col.name === 'id_instructor') {
            const instructores = appState.cursosAgendadosOptions?.instructores || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Instructor (${col.dataType})${isRequired ? ' *' : ''}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona un instructor</option>
                        ${instructores.map(i => `<option value="${i.id_instructor}">${i.nombre || `Instructor ${i.id_instructor}`}</option>`).join('')}
                    </select>
                </div>
            `;
        }

        // Manejador especial para id_grado en alumnos
        if (appState.selectedTable === 'alumnos' && col.name === 'id_grado') {
            const grados = appState.gradosOptions || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Grado (${col.dataType})${isRequired ? ' *' : ''}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona un grado</option>
                        ${grados.map(g => `<option value="${g.id_grado}">${g.nombre || `Grado ${g.id_grado}`}</option>`).join('')}
                    </select>
                </div>
            `;
        }

        // Manejador especial para id_grado en grado_forma
        if (appState.selectedTable === 'grado_forma' && col.name === 'id_grado') {
            const grados = appState.gradosOptions || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Grado (${col.dataType})${isRequired ? ' *' : ''}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona un grado</option>
                        ${grados.map(g => `<option value="${g.id_grado}">${g.nombre || `Grado ${g.id_grado}`}</option>`).join('')}
                    </select>
                    <small class="text-muted">Se muestra el nombre del grado, pero se guarda su ID.</small>
                </div>
            `;
        }

        // Manejador especial para id_estilo en formas
        if (appState.selectedTable === 'formas' && col.name === 'id_estilo') {
            const estilos = appState.estilosOptions || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Estilo (${col.dataType})${isRequired ? ' *' : ''}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona un estilo</option>
                        ${estilos.map(e => `<option value="${e.id_estilo}">${e.nombre || `Estilo ${e.id_estilo}`}</option>`).join('')}
                    </select>
                </div>
            `;
        }

        // Manejador especial para id_forma en grado_forma
        if (appState.selectedTable === 'grado_forma' && col.name === 'id_forma') {
            const formas = appState.gradoFormaFormasOptions || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Forma (${col.dataType})${isRequired ? ' *' : ''}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona una forma</option>
                        ${formas.map(f => `<option value="${f.id_forma}">${f.nombre || `Forma ${f.id_forma}`}</option>`).join('')}
                    </select>
                    <small class="text-muted">Se muestra el nombre de la forma, pero se guarda su ID.</small>
                </div>
            `;
        }

        // Manejador especial para id_alumno en alumno_forma
        if (appState.selectedTable === 'alumno_forma' && col.name === 'id_alumno') {
            const alumnos = appState.alumnoFormaAlumnosOptions || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Alumno (${col.dataType})${isRequired ? ' *' : ''}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona un alumno</option>
                        ${alumnos.map(a => `<option value="${a.id_alumno}">${a.nombre || a.numero_matricula || `Alumno ${a.id_alumno}`}</option>`).join('')}
                    </select>
                    <small class="text-muted">Se muestra el nombre del alumno, pero se guarda su ID.</small>
                </div>
            `;
        }

        // Manejador especial para id_forma en alumno_forma
        if (appState.selectedTable === 'alumno_forma' && col.name === 'id_forma') {
            const formas = appState.alumnoFormaFormasOptions || [];
            return `
                <div class="form-group">
                    <label for="field-${col.name}">Forma (${col.dataType})${isRequired ? ' *' : ''}</label>
                    <select id="field-${col.name}" class="form-input" data-column="${col.name}" ${requiredAttr}>
                        <option value="">Selecciona una forma</option>
                        ${formas.map(f => `<option value="${f.id_forma}">${f.nombre || `Forma ${f.id_forma}`}</option>`).join('')}
                    </select>
                    <small class="text-muted">Se muestra el nombre de la forma, pero se guarda su ID.</small>
                </div>
            `;
        }

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

        // Manejador especial para variante obligatoria/optativa en grado_forma
        if (appState.selectedTable === 'grado_forma' && col.name === 'es_opcional') {
            return `
                <div class="form-group form-group-checkbox">
                    <label class="checkbox-label" for="field-${col.name}">
                        <input type="checkbox" id="field-${col.name}" class="form-checkbox" data-column="${col.name}">
                        Forma optativa
                    </label>
                    <small class="text-muted">Si no se marca, la forma se registra como obligatoria.</small>
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

        const normalizedColumnName = String(col.name || '').toLowerCase();
        const isPasswordField = normalizedColumnName.includes('password') || normalizedColumnName.includes('contrasena') || normalizedColumnName.includes('clave');
        const inputType = normalizedColumnName.includes('password') || normalizedColumnName.includes('contrasena') || normalizedColumnName.includes('clave')
            ? 'password'
            : (normalizedColumnName.includes('email') || normalizedColumnName.includes('correo')
            ? 'email'
            : (normalizedColumnName.includes('telefono') || normalizedColumnName.includes('phone') ? 'tel' : (normalizedColumnName.includes('url') ? 'url' : 'text')));
        const passwordAttrs = isPasswordField ? ' minlength="7" title="La contraseña debe tener más de 6 caracteres"' : '';

        return `
            <div class="form-group">
                <label for="field-${col.name}">${col.name} (${col.dataType})${isRequired ? ' *' : ''}</label>
                <input type="${inputType}" id="field-${col.name}" class="form-input" data-column="${col.name}" placeholder="Valor para ${col.name}" ${requiredAttr}${passwordAttrs}>
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
    if (!isAdminSession()) {
        showToast('Solo administradores pueden insertar registros', 'error');
        return;
    }

    if (!appState.selectedTable) {
        showToast('Selecciona una tabla primero', 'info');
        return;
    }

    const form = document.getElementById('insert-row-form');
    const payload = {};
    const editableColumns = appState.selectedColumns.filter(col => {
        if (col.autoGenerated) {
            return false;
        }

        if (appState.selectedTable === 'grado_forma' || appState.selectedTable === 'alumno_forma') {
            return true;
        }

        return !col.primaryKey;
    });
    const hiddenRequiredColumns = appState.selectedColumns.filter(col => {
        if (col.autoGenerated) {
            return false;
        }
        if (appState.selectedTable === 'grado_forma' || appState.selectedTable === 'alumno_forma') {
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
    const invalidPasswordFields = [];

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
        const normalizedColumnName = String(col.name || '').toLowerCase();
        const isPasswordField = normalizedColumnName.includes('password') || normalizedColumnName.includes('contrasena') || normalizedColumnName.includes('clave');

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

        if (isPasswordField && rawValue.length <= 6) {
            invalidPasswordFields.push(col.name);
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

    if (invalidPasswordFields.length > 0) {
        showToast(`La contraseña debe tener más de 6 caracteres en: ${invalidPasswordFields.join(', ')}`, 'error');
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

async function editRowByIndex(rowIndex) {
    if (!isAdminSession()) {
        showToast('Solo administradores pueden editar registros', 'error');
        return;
    }

    if (!canEditCurrentTable()) {
        showToast('Esta tabla no permite edicion por politica de permisos', 'error');
        return;
    }

    const row = appState.selectedRowsRaw[rowIndex];
    if (!row) {
        showToast('No se encontro el registro seleccionado', 'error');
        return;
    }

    const primaryKeyColumn = appState.selectedColumns.find(col => col.primaryKey)?.name;
    if (!primaryKeyColumn || row[primaryKeyColumn] === undefined || row[primaryKeyColumn] === null) {
        showToast('No se puede editar: la tabla no tiene llave primaria utilizable', 'error');
        return;
    }

    const editableColumns = appState.selectedColumns.filter(col => !col.autoGenerated && !col.primaryKey);
    if (editableColumns.length === 0) {
        showToast('No hay columnas editables para este registro', 'info');
        return;
    }

    const editablePayload = {};
    editableColumns.forEach(col => {
        editablePayload[col.name] = row[col.name];
    });

    const proposedJson = JSON.stringify(editablePayload, null, 2);
    const userInput = prompt('Edita el JSON del registro (solo columnas editables):', proposedJson);

    if (userInput === null) {
        return;
    }

    let updatedPayload;
    try {
        updatedPayload = JSON.parse(userInput);
    } catch (error) {
        showToast('JSON invalido. No se realizaron cambios.', 'error');
        return;
    }

    try {
        await apiCall(`/api/database/tables/${encodeURIComponent(appState.selectedTable)}/rows/${encodeURIComponent(row[primaryKeyColumn])}`, {
            method: 'PUT',
            body: JSON.stringify(updatedPayload),
        });

        await reloadSelectedTableData();
        showToast('Registro actualizado correctamente', 'success');
    } catch (error) {
        showToast('No se pudo actualizar el registro', 'error');
    }
}

async function deleteRow(tableName, id) {
    if (!isAdminSession()) {
        showToast('Solo administradores pueden eliminar registros', 'error');
        return;
    }

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
    if (!isAdminSession()) {
        showToast('Solo administradores pueden ejecutar migraciones', 'error');
        return;
    }

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

    if (appState.autoRefresh && appState.sessionUser) {
        appState.refreshTimerId = setInterval(() => {
            const activeSection = document.querySelector('.section.active');
            if (activeSection && activeSection.id === 'dashboard-section') {
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
