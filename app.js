console.log('✓ app.js cargado');

// ==================== Configuración ==================== 
const DEFAULT_API_URL = 'http://localhost:8080';
const DEFAULT_REFRESH_INTERVAL = 30; // segundos
const FINAL_VIEW_SORT_PREFS_KEY = 'finalViewSortPreferences';
const pendingSaveActions = new Set();

function getDefaultFinalViewSortPreferences() {
    return {
        tables: {},
        studentForms: { sortKey: 'name', sortDirection: 'asc' },
        formStudents: { sortKey: 'name', sortDirection: 'asc' },
        gradeStudents: { sortKey: 'name', sortDirection: 'asc' },
        gradeForms: { sortKey: 'name', sortDirection: 'asc' },
        instructorForms: { sortKey: 'name', sortDirection: 'asc' },
        instructorCourses: { sortKey: 'name', sortDirection: 'asc' },
        styleInstructors: { sortKey: 'name', sortDirection: 'asc' },
    };
}

function loadFinalViewSortPreferences() {
    const defaults = getDefaultFinalViewSortPreferences();

    try {
        const rawValue = localStorage.getItem(FINAL_VIEW_SORT_PREFS_KEY);
        if (!rawValue) {
            return defaults;
        }

        const parsed = JSON.parse(rawValue);
        return {
            ...defaults,
            ...parsed,
            studentForms: { ...defaults.studentForms, ...(parsed?.studentForms || {}) },
            formStudents: { ...defaults.formStudents, ...(parsed?.formStudents || {}) },
            gradeStudents: { ...defaults.gradeStudents, ...(parsed?.gradeStudents || {}) },
            gradeForms: { ...defaults.gradeForms, ...(parsed?.gradeForms || {}) },
            instructorForms: { ...defaults.instructorForms, ...(parsed?.instructorForms || {}) },
            instructorCourses: { ...defaults.instructorCourses, ...(parsed?.instructorCourses || {}) },
            styleInstructors: { ...defaults.styleInstructors, ...(parsed?.styleInstructors || {}) },
            tables: parsed?.tables && typeof parsed.tables === 'object' ? parsed.tables : {},
        };
    } catch (error) {
        console.warn('No se pudo leer preferencias de ordenamiento de vista final:', error);
        return defaults;
    }
}

function persistFinalViewSortPreferences() {
    try {
        localStorage.setItem(FINAL_VIEW_SORT_PREFS_KEY, JSON.stringify(finalViewState.sortPreferences));
    } catch (error) {
        console.warn('No se pudo guardar preferencias de ordenamiento de vista final:', error);
    }
}

async function runProtectedSaveAction(actionKey, buttonId, callback) {
    if (pendingSaveActions.has(actionKey)) {
        showToast('Ya hay un guardado en proceso. Espera un momento.', 'info');
        return;
    }

    pendingSaveActions.add(actionKey);
    const button = buttonId ? document.getElementById(buttonId) : null;

    if (button) {
        button.disabled = true;
    }

    try {
        await callback();
    } finally {
        if (button) {
            button.disabled = false;
        }
        pendingSaveActions.delete(actionKey);
    }
}

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
    currentUserStudentName: '',
    hasStudentProfile: null,
    hasInstructorProfile: null,
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
            const styleModal = document.getElementById('style-profile-modal');
            const instructorModal = document.getElementById('instructor-profile-modal');
            const gradeModal = document.getElementById('grade-profile-modal');
            const formModal = document.getElementById('form-profile-modal');
            const studentModal = document.getElementById('student-profile-modal');
            const modal = document.getElementById('final-add-modal');

            if (styleModal && styleModal.style.display === 'flex') {
                closeStyleProfileModal();
            } else if (instructorModal && instructorModal.style.display === 'flex') {
                closeInstructorProfileModal();
            } else if (gradeModal && gradeModal.style.display === 'flex') {
                closeGradeProfileModal();
            } else if (formModal && formModal.style.display === 'flex') {
                closeFormProfileModal();
            } else if (studentModal && studentModal.style.display === 'flex') {
                closeStudentProfileModal();
            } else if (modal && modal.style.display === 'flex') {
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

    setupStudentProfileEventListeners();
    setupInstructorProfileEventListeners();
    setupStyleProfileEventListeners();
    setupFormProfileEventListeners();
    setupGradeProfileEventListeners();
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
    appState.currentUserStudentName = '';
    appState.hasStudentProfile = null;
    appState.hasInstructorProfile = null;
    updateAuthUi();
    applyRolePermissions();
    if (appState.sessionUser && !isAdminSession()) {
        ensureSessionProfileAccessResolved();
    }
    initializeAutoRefresh();
}

async function ensureSessionProfileAccessResolved(forceRefresh = false) {
    if (!appState.sessionUser || isAdminSession()) {
        return;
    }

    const alreadyResolved = appState.hasStudentProfile !== null && appState.hasInstructorProfile !== null;
    if (alreadyResolved && !forceRefresh) {
        return;
    }

    try {
        const studentsRows = await apiCall('/api/database/tables/alumnos/rows?limit=3000', {}, { silent: true });
        const ownStudents = getSessionScopedRows('alumnos', studentsRows || []);
        appState.hasStudentProfile = ownStudents.length > 0;

        const instructorsRows = await apiCall('/api/database/tables/instructores/rows?limit=3000', {}, { silent: true });
        const ownInstructors = getSessionScopedRows('instructores', instructorsRows || []);
        appState.hasInstructorProfile = ownInstructors.length > 0;
    } catch (error) {
        console.warn('No se pudo resolver acceso por perfil de sesión:', error);
        appState.hasStudentProfile = false;
        appState.hasInstructorProfile = false;
    }

    applyFinalViewPermissions();
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
    const tablesNavBtn = document.querySelector('.nav-btn[data-section="tables"]');
    const settingsNavBtn = document.querySelector('.nav-btn[data-section="settings"]');
    const viewTablesBtn = document.getElementById('view-tables-btn');

    if (migrateNavBtn) {
        migrateNavBtn.style.display = isAdmin ? 'inline-block' : 'none';
    }

    if (tablesNavBtn) {
        tablesNavBtn.style.display = isAdmin ? 'inline-block' : 'none';
    }

    if (settingsNavBtn) {
        settingsNavBtn.style.display = isAdmin ? 'inline-block' : 'none';
    }

    if (viewTablesBtn) {
        viewTablesBtn.style.display = isAdmin ? 'inline-block' : 'none';
    }

    if (!isAdmin) {
        const activeSection = document.querySelector('.section.active');
        if (activeSection && (activeSection.id === 'migrate-section' || activeSection.id === 'tables-section' || activeSection.id === 'settings-section')) {
            switchSection('dashboard');
        }
    }

    document.getElementById('insert-row-btn').style.display = isAdmin ? 'inline-block' : 'none';
    document.getElementById('execute-migrate-btn').style.display = isAdmin ? 'inline-block' : 'none';
    document.getElementById('run-migrate-btn').style.display = isAdmin ? 'inline-block' : 'none';

    applyFinalViewPermissions();
}

function isAdminSession() {
    return appState.sessionUser?.role === 'ADMIN';
}

function getAllowedFinalTabsForSession() {
    if (!appState.sessionUser) {
        return [];
    }

    if (isAdminSession()) {
        return ['administradores', 'cursos', 'grados', 'formas', 'alumnos', 'instructores', 'estilos'];
    }

    const allowedTabs = [];

    if (appState.hasStudentProfile) {
        allowedTabs.push('alumnos');
    }

    if (appState.hasInstructorProfile) {
        allowedTabs.push('instructores');
    }

    if (allowedTabs.length === 0 && (appState.hasStudentProfile === null || appState.hasInstructorProfile === null)) {
        return ['alumnos', 'instructores'];
    }

    return allowedTabs;
}

function isFinalTabAllowedForSession(tabName) {
    return getAllowedFinalTabsForSession().includes(tabName);
}

function getSessionScopedRows(tableName, rows) {
    if (isAdminSession()) {
        return rows;
    }

    const userId = Number(appState.sessionUser?.userId);
    if (!Number.isFinite(userId)) {
        return [];
    }

    if (tableName === 'alumnos') {
        const ownStudents = (rows || []).filter(row => Number(row.id_alumno) === userId);
        if (ownStudents[0]?.nombre) {
            appState.currentUserStudentName = String(ownStudents[0].nombre).trim();
        }
        return ownStudents;
    }

    if (tableName === 'instructores') {
        const byId = (rows || []).filter(row => Number(row.id_instructor) === userId);
        if (byId.length > 0) {
            return byId;
        }

        const normalizedExpectedName = String(appState.currentUserStudentName || appState.sessionUser?.displayName || '').trim().toLowerCase();
        if (!normalizedExpectedName) {
            return [];
        }

        return (rows || []).filter(row => String(row.nombre || '').trim().toLowerCase() === normalizedExpectedName);
    }

    return [];
}

function applyFinalViewPermissions() {
    const allowedTabs = getAllowedFinalTabsForSession();
    const canMutate = isAdminSession();

    document.querySelectorAll('.final-tab-btn').forEach(btn => {
        const tabName = btn.dataset.tab;
        btn.style.display = allowedTabs.includes(tabName) ? 'inline-block' : 'none';
    });

    document.querySelectorAll('.final-tab-panel').forEach(panel => {
        const panelId = panel.id || '';
        const tabName = panelId.replace('final-tab-', '');
        panel.style.display = allowedTabs.includes(tabName) ? '' : 'none';
    });

    document.querySelectorAll('.final-tab-toolbar [data-table]').forEach(addBtn => {
        addBtn.style.display = canMutate ? 'inline-block' : 'none';
    });

    const activeTabBtn = document.querySelector('.final-tab-btn.active');
    const activeTabName = activeTabBtn?.dataset?.tab;
    if (activeTabName && !allowedTabs.includes(activeTabName)) {
        const firstAllowed = allowedTabs[0];
        if (firstAllowed) {
            document.querySelectorAll('.final-tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === firstAllowed);
            });
            document.querySelectorAll('.final-tab-panel').forEach(panel => {
                panel.classList.toggle('active', panel.id === `final-tab-${firstAllowed}`);
            });
        }
    }
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
async function openFinalView() {
    const overlay = document.getElementById('final-view-overlay');
    const container = document.querySelector('.container');
    const toastContainer = document.getElementById('toast-container');
    
    if (overlay) {
        await ensureSessionProfileAccessResolved();
        applyFinalViewPermissions();

        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Ocultar la interfaz anterior
        if (container) container.style.display = 'none';
        if (toastContainer) toastContainer.style.display = 'none';
        
        const allowedTabs = getAllowedFinalTabsForSession();
        const initialTab = allowedTabs[0] || 'alumnos';

        if (allowedTabs.length === 0) {
            showToast('Tu usuario no tiene perfil de alumno ni de instructor para consultar', 'info');
            closeFinalView();
            return;
        }

        document.querySelectorAll('.final-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === initialTab);
        });

        document.querySelectorAll('.final-tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `final-tab-${initialTab}`);
        });

        // Cargar datos de la primera pestaña permitida
        loadFinalTabData(initialTab);
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

    if (!isFinalTabAllowedForSession(tabName)) {
        showToast('No tienes permisos para esa seccion', 'info');
        return;
    }

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
const initialFinalViewSortPreferences = loadFinalViewSortPreferences();

const finalViewState = {
    sortPreferences: initialFinalViewSortPreferences,
    currentTable: null,
    currentColumns: [],
    currentData: [],
    tableSort: initialFinalViewSortPreferences.tables || {},
    editingRowId: null,
    editingMode: false,
    selectedStudent: null,
    selectedInstructor: null,
    selectedStyle: null,
    selectedForm: null,
    selectedGrade: null,
    studentForms: {
        forms: [],
        links: [],
        columns: [],
        loaded: false,
        selectorOpen: false,
        sortKey: initialFinalViewSortPreferences.studentForms.sortKey,
        sortDirection: initialFinalViewSortPreferences.studentForms.sortDirection,
    },
    formStudents: {
        links: [],
        students: [],
        loaded: false,
        sortKey: initialFinalViewSortPreferences.formStudents.sortKey,
        sortDirection: initialFinalViewSortPreferences.formStudents.sortDirection,
    },
    gradeStudents: {
        students: [],
        loaded: false,
        sortKey: initialFinalViewSortPreferences.gradeStudents.sortKey,
        sortDirection: initialFinalViewSortPreferences.gradeStudents.sortDirection,
    },
    gradeForms: {
        forms: [],
        links: [],
        columns: [],
        loaded: false,
        selectorOpen: false,
        sortKey: initialFinalViewSortPreferences.gradeForms.sortKey,
        sortDirection: initialFinalViewSortPreferences.gradeForms.sortDirection,
    },
    instructorForms: {
        forms: [],
        links: [],
        columns: [],
        loaded: false,
        selectorOpen: false,
        relationMode: 'unknown',
        sortKey: initialFinalViewSortPreferences.instructorForms.sortKey,
        sortDirection: initialFinalViewSortPreferences.instructorForms.sortDirection,
    },
    instructorCourses: {
        courses: [],
        links: [],
        columns: [],
        loaded: false,
        selectorOpen: false,
        sortKey: initialFinalViewSortPreferences.instructorCourses.sortKey,
        sortDirection: initialFinalViewSortPreferences.instructorCourses.sortDirection,
    },
    styleInstructors: {
        instructors: [],
        links: [],
        loaded: false,
        sortKey: initialFinalViewSortPreferences.styleInstructors.sortKey,
        sortDirection: initialFinalViewSortPreferences.styleInstructors.sortDirection,
    },
};

function normalizeSortableValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).toLowerCase();
}

function compareSortableValues(a, b) {
    const valueA = normalizeSortableValue(a);
    const valueB = normalizeSortableValue(b);

    const numA = Number(valueA);
    const numB = Number(valueB);
    const bothNumeric = Number.isFinite(numA) && Number.isFinite(numB) && valueA !== '' && valueB !== '';

    if (bothNumeric) {
        return numA - numB;
    }

    return valueA.localeCompare(valueB, 'es', { numeric: true, sensitivity: 'base' });
}

function getSortIndicator(direction) {
    return direction === 'desc' ? ' ↓' : ' ↑';
}

function sortListByDirection(list, direction, selector) {
    const sortedList = [...(list || [])].sort((left, right) => compareSortableValues(selector(left), selector(right)));
    return direction === 'desc' ? sortedList.reverse() : sortedList;
}

function updateListSortPreference(sectionKey, sortKey, sortDirection) {
    if (!finalViewState.sortPreferences[sectionKey]) {
        finalViewState.sortPreferences[sectionKey] = {};
    }

    finalViewState.sortPreferences[sectionKey] = {
        sortKey,
        sortDirection,
    };

    persistFinalViewSortPreferences();
}

function toggleTableSort(tableName, columnName) {
    const currentSort = finalViewState.tableSort[tableName] || { column: null, direction: 'asc' };
    const nextDirection = currentSort.column === columnName && currentSort.direction === 'asc' ? 'desc' : 'asc';
    finalViewState.tableSort[tableName] = { column: columnName, direction: nextDirection };
    finalViewState.sortPreferences.tables = {
        ...(finalViewState.sortPreferences.tables || {}),
        [tableName]: { column: columnName, direction: nextDirection },
    };
    persistFinalViewSortPreferences();
    loadFinalTabData(tableName);
}

function getPrimaryKeyFields(columns) {
    return (columns || []).filter(col => col.primaryKey).map(col => col.name);
}

function getPrimaryKeyField(columns) {
    const pkFields = getPrimaryKeyFields(columns);
    return pkFields[0] || 'id';
}

function buildCompositeRowId(row, pkFields) {
    if (!row || !pkFields || pkFields.length === 0) {
        return row?.id ?? '';
    }

    const values = pkFields.map(field => row[field]);
    if (values.some(value => value === undefined || value === null)) {
        return row?.id ?? '';
    }

    return values.map(value => String(value)).join(',');
}

async function loadFinalTabData(tableName) {
    if (!isFinalTabAllowedForSession(tableName)) {
        const tableContainer = document.getElementById(`final-table-${tableName}`);
        if (tableContainer) {
            tableContainer.innerHTML = '<div class="final-table-empty"><p>No tienes permisos para ver esta seccion</p></div>';
        }
        return;
    }

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
        const scopedRows = getSessionScopedRows(tableName, rows || []);
        finalViewState.currentData = scopedRows;
        
        renderFinalTable(tableName, columns, scopedRows);
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
    const pkFields = getPrimaryKeyFields(columns);
    const tableSort = finalViewState.tableSort[tableName] || { column: null, direction: 'asc' };
    const sortedRows = [...rows];

    if (tableSort.column) {
        sortedRows.sort((leftRow, rightRow) => {
            const leftValue = leftRow[tableSort.column];
            const rightValue = rightRow[tableSort.column];
            return compareSortableValues(leftValue, rightValue);
        });

        if (tableSort.direction === 'desc') {
            sortedRows.reverse();
        }
    }
    
    const canMutate = isAdminSession();

    let html = '<table class="final-data-table"><thead><tr>';
    displayColumns.forEach(col => {
        const isActiveSort = tableSort.column === col.name;
        const sortIndicator = isActiveSort ? getSortIndicator(tableSort.direction) : '';
        html += `<th class="final-sortable-header" data-sort-column="${col.name}" title="Ordenar por ${col.name}">${col.name}${sortIndicator}</th>`;
    });
    if (canMutate) {
        html += '<th>Acciones</th>';
    }
    html += '</tr></thead><tbody>';
    
    sortedRows.forEach(row => {
        const rowId = buildCompositeRowId(row, pkFields) || row[pkField];
        const isProfileClickableTable = tableName === 'alumnos' || tableName === 'instructores' || tableName === 'estilos' || tableName === 'formas' || tableName === 'grados';
        const rowClass = isProfileClickableTable ? ' class="final-row-clickable"' : '';
        const rowDataAttr = isProfileClickableTable ? ` data-row-id="${rowId}"` : '';

        html += `<tr${rowClass}${rowDataAttr}>`;
        displayColumns.forEach(col => {
            const value = row[col.name];
            const displayValue = getForeignKeyDisplayValue(tableName, col.name, value);
            html += `<td>${displayValue}</td>`;
        });
        if (canMutate) {
            html += `<td class="final-table-actions">
                        <button class="final-btn-edit" data-row-id="${rowId}" title="Editar">✏️</button>
                        <button class="final-btn-delete" data-row-id="${rowId}" title="Eliminar">🗑️</button>
                    </td>`;
        }
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    tableContainer.innerHTML = html;
    
    // Agregar event listeners a los botones
    if (canMutate) {
        tableContainer.querySelectorAll('.final-btn-edit').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const rowId = btn.dataset.rowId;
                const row = sortedRows.find(r => {
                    const currentRowId = buildCompositeRowId(r, pkFields) || r[pkField];
                    return String(currentRowId) === String(rowId);
                });
                if (row) {
                    await openFinalEditDialog(tableName, row);
                }
            });
        });
        
        tableContainer.querySelectorAll('.final-btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const rowId = btn.dataset.rowId;
                if (confirm(`¿Estás seguro de que deseas eliminar este registro?`)) {
                    await deleteFinalRow(tableName, rowId, pkField);
                }
            });
        });
    }

    if (tableName === 'alumnos' || tableName === 'instructores' || tableName === 'estilos' || tableName === 'formas' || tableName === 'grados') {
        tableContainer.querySelectorAll('tbody tr.final-row-clickable').forEach(tr => {
            tr.addEventListener('click', async () => {
                const rowId = tr.dataset.rowId;
                const selectedRow = sortedRows.find(r => {
                    const currentRowId = buildCompositeRowId(r, pkFields) || r[pkField];
                    return String(currentRowId) === String(rowId);
                });

                if (!selectedRow) {
                    return;
                }

                if (tableName === 'alumnos') {
                    await openStudentProfileModal(selectedRow);
                    return;
                }

                if (tableName === 'instructores') {
                    await openInstructorProfileModal(selectedRow);
                    return;
                }

                if (tableName === 'estilos') {
                    await openStyleProfileModal(selectedRow);
                    return;
                }

                if (tableName === 'formas') {
                    await openFormProfileModal(selectedRow);
                    return;
                }

                if (tableName === 'grados') {
                    await openGradeProfileModal(selectedRow);
                    return;
                }
            });
        });
    }

    tableContainer.querySelectorAll('th.final-sortable-header').forEach(th => {
        th.addEventListener('click', () => {
            const columnName = th.dataset.sortColumn;
            if (!columnName) return;
            toggleTableSort(tableName, columnName);
        });
    });
}

async function openStyleProfileModal(styleRow) {
    const modal = document.getElementById('style-profile-modal');
    if (!modal) return;

    finalViewState.selectedStyle = styleRow;
    finalViewState.styleInstructors = {
        instructors: [],
        links: [],
        loaded: false,
        sortKey: finalViewState.sortPreferences.styleInstructors.sortKey,
        sortDirection: finalViewState.sortPreferences.styleInstructors.sortDirection,
    };

    const styleName = styleRow.nombre || `Estilo ${styleRow.id_estilo}`;
    document.getElementById('style-profile-title').textContent = styleName;
    document.getElementById('style-profile-subtitle').textContent = `ID: ${styleRow.id_estilo} · Detalles e instructores que lo enseñan`;

    const editBtn = document.getElementById('style-edit-btn');
    if (editBtn) {
        editBtn.style.display = isAdminSession() ? 'inline-block' : 'none';
    }

    renderStyleInfoPanel(styleRow);
    switchStyleProfilePanel('info');
    modal.style.display = 'flex';
}

function closeStyleProfileModal() {
    const modal = document.getElementById('style-profile-modal');
    if (!modal) return;

    modal.style.display = 'none';
    finalViewState.selectedStyle = null;
    finalViewState.styleInstructors = {
        instructors: [],
        links: [],
        loaded: false,
        sortKey: finalViewState.sortPreferences.styleInstructors.sortKey,
        sortDirection: finalViewState.sortPreferences.styleInstructors.sortDirection,
    };

    const instructorsList = document.getElementById('style-instructors-list');
    if (instructorsList) {
        instructorsList.innerHTML = '';
    }
}

function renderStyleInfoPanel(styleRow) {
    const panel = document.getElementById('style-panel-info');
    if (!panel) return;

    const labels = {
        id_estilo: 'ID Estilo',
        nombre: 'Nombre',
        descripcion: 'Descripcion',
    };

    const entries = Object.entries(styleRow || {});
    panel.innerHTML = `
        <div class="style-profile-info-grid">
            ${entries.map(([field, value]) => {
                const label = labels[field] || field;
                const normalizedValue = value === null || value === undefined || value === '' ? '—' : String(value);
                return `
                    <div class="style-profile-info-item">
                        <span class="style-profile-info-label">${label}</span>
                        <span class="style-profile-info-value">${normalizedValue}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function switchStyleProfilePanel(panelName) {
    document.querySelectorAll('.style-profile-menu-btn').forEach(btn => {
        if (btn.dataset.panel === panelName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.style-profile-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    const panel = document.getElementById(`style-panel-${panelName}`);
    if (panel) {
        panel.classList.add('active');
    }
}

async function loadStyleInstructorsPanel() {
    const loading = document.getElementById('style-instructors-loading');
    const listContainer = document.getElementById('style-instructors-list');
    const selectedStyle = finalViewState.selectedStyle;

    if (!listContainer || !selectedStyle) return;
    if (finalViewState.styleInstructors.loaded) return;

    try {
        loading.style.display = 'flex';
        listContainer.innerHTML = '';

        const [instructorsRows, instructorEstiloRows] = await Promise.all([
            apiCall('/api/database/tables/instructores/rows?limit=3000'),
            apiCall('/api/database/tables/instructor_estilo/rows?limit=3000'),
        ]);

        finalViewState.styleInstructors = {
            instructors: instructorsRows || [],
            links: (instructorEstiloRows || []).filter(link => String(link.id_estilo) === String(selectedStyle.id_estilo)),
            loaded: true,
            sortKey: finalViewState.styleInstructors.sortKey || finalViewState.sortPreferences.styleInstructors.sortKey,
            sortDirection: finalViewState.styleInstructors.sortDirection || finalViewState.sortPreferences.styleInstructors.sortDirection,
        };

        renderStyleInstructorsList();
    } catch (error) {
        listContainer.innerHTML = '<p class="text-muted">No se pudo cargar la lista de instructores.</p>';
        showToast('No se pudieron cargar los instructores de este estilo', 'error');
    } finally {
        loading.style.display = 'none';
    }
}

function renderStyleInstructorsList() {
    const listContainer = document.getElementById('style-instructors-list');
    const styleInstructorsState = finalViewState.styleInstructors;

    if (!listContainer) return;

    const instructorsById = {};
    (styleInstructorsState.instructors || []).forEach(instructor => {
        instructorsById[String(instructor.id_instructor)] = instructor;
    });

    const instructorItems = (styleInstructorsState.links || []).map(link => {
        const instructor = instructorsById[String(link.id_instructor)];
        const name = instructor?.nombre || `Instructor ${link.id_instructor}`;
        const specialty = instructor?.especialidad || 'Sin especialidad';

        return {
            id_instructor: link.id_instructor,
            nombre: name,
            especialidad: specialty,
        };
    });

    const sortKey = styleInstructorsState.sortKey || 'name';
    const sortDirection = styleInstructorsState.sortDirection || 'asc';
    const sortedInstructors = sortListByDirection(instructorItems, sortDirection, item => {
        if (sortKey === 'specialty') return item.especialidad;
        return item.nombre;
    });

    const nameLabel = `Instructor${sortKey === 'name' ? getSortIndicator(sortDirection) : ''}`;
    const specialtyLabel = `Especialidad${sortKey === 'specialty' ? getSortIndicator(sortDirection) : ''}`;

    listContainer.innerHTML = `
        <div class="form-students-summary">
            Instructores que enseñan este estilo: <strong>${instructorItems.length}</strong>
        </div>
        <div class="list-sort-bar" id="style-instructors-sort-bar">
            <button type="button" class="list-sort-btn" data-style-instructors-sort="name">${nameLabel}</button>
            <button type="button" class="list-sort-btn" data-style-instructors-sort="specialty">${specialtyLabel}</button>
        </div>
        <div class="form-known-students">
            ${sortedInstructors.length === 0
                ? '<p class="text-muted">Aun no hay instructores asignados a este estilo.</p>'
                : sortedInstructors.map(item => {
                    return `
                        <div class="form-known-student-item">
                            <span class="form-known-student-name">${item.nombre}</span>
                            <span class="form-known-student-date">${item.especialidad}</span>
                        </div>
                    `;
                }).join('')
            }
        </div>
    `;

    listContainer.querySelectorAll('[data-style-instructors-sort]').forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedKey = btn.dataset.styleInstructorsSort;
            if (!selectedKey) return;

            const isSameKey = finalViewState.styleInstructors.sortKey === selectedKey;
            finalViewState.styleInstructors.sortDirection = isSameKey && finalViewState.styleInstructors.sortDirection === 'asc' ? 'desc' : 'asc';
            finalViewState.styleInstructors.sortKey = selectedKey;
            updateListSortPreference('styleInstructors', finalViewState.styleInstructors.sortKey, finalViewState.styleInstructors.sortDirection);
            renderStyleInstructorsList();
        });
    });
}

function setupStyleProfileEventListeners() {
    const modal = document.getElementById('style-profile-modal');
    const closeBtn = document.getElementById('style-profile-close-btn');
    const closeFooterBtn = document.getElementById('style-close-btn');
    const editBtn = document.getElementById('style-edit-btn');
    const menuInfoBtn = document.getElementById('style-menu-info');
    const menuInstructorsBtn = document.getElementById('style-menu-instructors');

    if (!modal) return;

    if (closeBtn) {
        closeBtn.addEventListener('click', closeStyleProfileModal);
    }

    if (closeFooterBtn) {
        closeFooterBtn.addEventListener('click', closeStyleProfileModal);
    }

    modal.addEventListener('click', (e) => {
        if (e.target.id === 'style-profile-modal') {
            closeStyleProfileModal();
        }
    });

    if (menuInfoBtn) {
        menuInfoBtn.addEventListener('click', () => {
            switchStyleProfilePanel('info');
        });
    }

    if (menuInstructorsBtn) {
        menuInstructorsBtn.addEventListener('click', async () => {
            switchStyleProfilePanel('instructors');
            await loadStyleInstructorsPanel();
        });
    }

    if (editBtn) {
        editBtn.addEventListener('click', async () => {
            if (!isAdminSession()) {
                showToast('Solo administradores pueden editar estilos', 'error');
                return;
            }

            const selectedStyle = finalViewState.selectedStyle;
            if (!selectedStyle) {
                showToast('No hay estilo seleccionado', 'error');
                return;
            }

            closeStyleProfileModal();
            await openFinalEditDialog('estilos', selectedStyle);
        });
    }
}

async function openGradeProfileModal(gradeRow) {
    const modal = document.getElementById('grade-profile-modal');
    if (!modal) return;

    finalViewState.selectedGrade = gradeRow;
    finalViewState.gradeStudents = {
        students: [],
        loaded: false,
        sortKey: finalViewState.sortPreferences.gradeStudents.sortKey,
        sortDirection: finalViewState.sortPreferences.gradeStudents.sortDirection,
    };
    finalViewState.gradeForms = {
        forms: [],
        links: [],
        columns: [],
        loaded: false,
        selectorOpen: false,
        sortKey: finalViewState.sortPreferences.gradeForms.sortKey,
        sortDirection: finalViewState.sortPreferences.gradeForms.sortDirection,
    };

    const gradeName = gradeRow.nombre || `Grado ${gradeRow.id_grado}`;
    document.getElementById('grade-profile-title').textContent = gradeName;
    document.getElementById('grade-profile-subtitle').textContent = `ID: ${gradeRow.id_grado} · Consulta y edita este grado`;

    const canManage = isAdminSession();
    const editBtn = document.getElementById('grade-edit-btn');
    const manageFormsBtn = document.getElementById('grade-manage-forms-btn');
    const saveFormsBtn = document.getElementById('grade-save-forms-btn');
    const cancelFormsBtn = document.getElementById('grade-cancel-forms-btn');

    if (editBtn) editBtn.style.display = canManage ? 'inline-block' : 'none';
    if (manageFormsBtn) manageFormsBtn.style.display = canManage ? 'inline-block' : 'none';
    if (!canManage) {
        if (saveFormsBtn) saveFormsBtn.style.display = 'none';
        if (cancelFormsBtn) cancelFormsBtn.style.display = 'none';
    }

    renderGradeInfoPanel(gradeRow);
    switchGradeProfilePanel('info');
    modal.style.display = 'flex';
}

function closeGradeProfileModal() {
    const modal = document.getElementById('grade-profile-modal');
    if (!modal) return;

    modal.style.display = 'none';
    finalViewState.selectedGrade = null;
    finalViewState.gradeStudents = {
        students: [],
        loaded: false,
        sortKey: finalViewState.sortPreferences.gradeStudents.sortKey,
        sortDirection: finalViewState.sortPreferences.gradeStudents.sortDirection,
    };
    finalViewState.gradeForms = {
        forms: [],
        links: [],
        columns: [],
        loaded: false,
        selectorOpen: false,
        sortKey: finalViewState.sortPreferences.gradeForms.sortKey,
        sortDirection: finalViewState.sortPreferences.gradeForms.sortDirection,
    };

    const studentsList = document.getElementById('grade-students-list');
    if (studentsList) {
        studentsList.innerHTML = '';
    }

    const formsList = document.getElementById('grade-forms-list');
    if (formsList) {
        formsList.innerHTML = '';
    }
}

function renderGradeInfoPanel(gradeRow) {
    const panel = document.getElementById('grade-panel-info');
    if (!panel) return;

    const labels = {
        id_grado: 'ID Grado',
        nombre: 'Nombre',
        descripcion: 'Descripcion',
    };

    const entries = Object.entries(gradeRow || {});
    panel.innerHTML = `
        <div class="grade-profile-info-grid">
            ${entries.map(([field, value]) => {
                const label = labels[field] || field;
                const normalizedValue = value === null || value === undefined || value === '' ? '—' : String(value);
                return `
                    <div class="grade-profile-info-item">
                        <span class="grade-profile-info-label">${label}</span>
                        <span class="grade-profile-info-value">${normalizedValue}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function switchGradeProfilePanel(panelName) {
    document.querySelectorAll('.grade-profile-menu-btn').forEach(btn => {
        if (btn.dataset.panel === panelName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.grade-profile-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    const panel = document.getElementById(`grade-panel-${panelName}`);
    if (panel) {
        panel.classList.add('active');
    }

    const manageBtn = document.getElementById('grade-manage-forms-btn');
    const saveBtn = document.getElementById('grade-save-forms-btn');
    const cancelBtn = document.getElementById('grade-cancel-forms-btn');
    const canManage = isAdminSession();

    if (manageBtn) {
        manageBtn.style.display = canManage && panelName === 'forms' ? 'inline-block' : 'none';
    }
    if (saveBtn) {
        saveBtn.style.display = canManage && panelName === 'forms' && finalViewState.gradeForms.selectorOpen ? 'inline-block' : 'none';
    }
    if (cancelBtn) {
        cancelBtn.style.display = canManage && panelName === 'forms' && finalViewState.gradeForms.selectorOpen ? 'inline-block' : 'none';
    }
}

async function loadGradeStudentsPanel() {
    const loading = document.getElementById('grade-students-loading');
    const listContainer = document.getElementById('grade-students-list');
    const selectedGrade = finalViewState.selectedGrade;

    if (!listContainer || !selectedGrade) return;
    if (finalViewState.gradeStudents.loaded) return;

    try {
        loading.style.display = 'flex';
        listContainer.innerHTML = '';

        const studentsRows = await apiCall('/api/database/tables/alumnos/rows?limit=3000');

        finalViewState.gradeStudents = {
            students: (studentsRows || []).filter(student => String(student.id_grado) === String(selectedGrade.id_grado)),
            loaded: true,
            sortKey: finalViewState.gradeStudents.sortKey || 'name',
            sortDirection: finalViewState.gradeStudents.sortDirection || 'asc',
        };

        renderGradeStudentsList();
    } catch (error) {
        listContainer.innerHTML = '<p class="text-muted">No se pudo cargar la lista de alumnos.</p>';
        showToast('No se pudieron cargar los alumnos de este grado', 'error');
    } finally {
        loading.style.display = 'none';
    }
}

function renderGradeStudentsList() {
    const listContainer = document.getElementById('grade-students-list');
    const gradeStudentsState = finalViewState.gradeStudents;

    if (!listContainer) return;

    const students = gradeStudentsState.students || [];
    const gradeSortKey = gradeStudentsState.sortKey || 'name';
    const gradeSortDirection = gradeStudentsState.sortDirection || 'asc';

    const sortedStudents = sortListByDirection(students, gradeSortDirection, student => {
        if (gradeSortKey === 'matricula') return student.numero_matricula || '';
        return [student.nombre, student.apellido].filter(Boolean).join(' ').trim() || student.numero_matricula || student.id_alumno;
    });

    const nameLabel = `Alumno${gradeSortKey === 'name' ? getSortIndicator(gradeSortDirection) : ''}`;
    const matriculaLabel = `Matricula${gradeSortKey === 'matricula' ? getSortIndicator(gradeSortDirection) : ''}`;

    listContainer.innerHTML = `
        <div class="grade-students-summary">
            Alumnos en este grado: <strong>${students.length}</strong>
        </div>
        <div class="list-sort-bar" id="grade-students-sort-bar">
            <button type="button" class="list-sort-btn" data-grade-sort="name">${nameLabel}</button>
            <button type="button" class="list-sort-btn" data-grade-sort="matricula">${matriculaLabel}</button>
        </div>
        <div class="grade-known-students">
            ${sortedStudents.length === 0
                ? '<p class="text-muted">Aun no hay alumnos registrados en este grado.</p>'
                : sortedStudents.map(student => {
                    const studentName = [student.nombre, student.apellido].filter(Boolean).join(' ').trim() || student.numero_matricula || `Alumno ${student.id_alumno}`;
                    const matricula = student.numero_matricula || 'Sin matricula';

                    return `
                        <div class="grade-known-student-item">
                            <span class="grade-known-student-name">${studentName}</span>
                            <span class="grade-known-student-extra">${matricula}</span>
                        </div>
                    `;
                }).join('')
            }
        </div>
    `;

    listContainer.querySelectorAll('[data-grade-sort]').forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedKey = btn.dataset.gradeSort;
            if (!selectedKey) return;

            const isSameKey = finalViewState.gradeStudents.sortKey === selectedKey;
            finalViewState.gradeStudents.sortDirection = isSameKey && finalViewState.gradeStudents.sortDirection === 'asc' ? 'desc' : 'asc';
            finalViewState.gradeStudents.sortKey = selectedKey;
            updateListSortPreference('gradeStudents', finalViewState.gradeStudents.sortKey, finalViewState.gradeStudents.sortDirection);
            renderGradeStudentsList();
        });
    });
}

async function loadGradeFormsPanel() {
    const loading = document.getElementById('grade-forms-loading');
    const listContainer = document.getElementById('grade-forms-list');
    const selectedGrade = finalViewState.selectedGrade;

    if (!listContainer || !selectedGrade) return;
    if (finalViewState.gradeForms.loaded) return;

    try {
        loading.style.display = 'flex';
        listContainer.innerHTML = '';

        const [formsRows, gradoFormaRows, gradoFormaColumns] = await Promise.all([
            apiCall('/api/database/tables/formas/rows?limit=2000'),
            apiCall('/api/database/tables/grado_forma/rows?limit=4000'),
            apiCall('/api/database/tables/grado_forma/columns'),
        ]);

        finalViewState.gradeForms = {
            forms: formsRows || [],
            links: (gradoFormaRows || []).filter(link => String(link.id_grado) === String(selectedGrade.id_grado)),
            columns: gradoFormaColumns || [],
            loaded: true,
            selectorOpen: false,
            sortKey: finalViewState.gradeForms.sortKey || finalViewState.sortPreferences.gradeForms.sortKey,
            sortDirection: finalViewState.gradeForms.sortDirection || finalViewState.sortPreferences.gradeForms.sortDirection,
        };

        renderGradeFormsList();
    } catch (error) {
        listContainer.innerHTML = '<p class="text-muted">No se pudieron cargar las formas del grado.</p>';
        showToast('No se pudieron cargar las formas requeridas del grado', 'error');
    } finally {
        loading.style.display = 'none';
    }
}

function renderGradeFormsList() {
    const listContainer = document.getElementById('grade-forms-list');
    const gradeFormsState = finalViewState.gradeForms;

    if (!listContainer) return;

    if (!gradeFormsState.forms || gradeFormsState.forms.length === 0) {
        listContainer.innerHTML = '<p class="text-muted">No hay formas disponibles.</p>';
        return;
    }

    const assignedByFormaId = {};
    (gradeFormsState.links || []).forEach(link => {
        assignedByFormaId[String(link.id_forma)] = link;
    });

    const assignedForms = (gradeFormsState.forms || []).filter(forma => Boolean(assignedByFormaId[String(forma.id_forma)]));

    const formsSortKey = gradeFormsState.sortKey || 'name';
    const formsSortDirection = gradeFormsState.sortDirection || 'asc';
    const sortedAssignedForms = sortListByDirection(assignedForms, formsSortDirection, forma => {
        if (formsSortKey === 'id') return forma.id_forma;
        return forma.nombre || forma.id_forma;
    });

    const nameLabel = `Forma${formsSortKey === 'name' ? getSortIndicator(formsSortDirection) : ''}`;
    const idLabel = `ID${formsSortKey === 'id' ? getSortIndicator(formsSortDirection) : ''}`;

    listContainer.innerHTML = `
        <div class="grade-students-summary">
            Formas requeridas: <strong>${assignedForms.length}</strong> de ${gradeFormsState.forms.length}
        </div>
        <div class="list-sort-bar" id="grade-forms-sort-bar">
            <button type="button" class="list-sort-btn" data-grade-forms-sort="name">${nameLabel}</button>
            <button type="button" class="list-sort-btn" data-grade-forms-sort="id">${idLabel}</button>
        </div>
        <div class="grade-known-forms">
            ${sortedAssignedForms.length === 0
                ? '<p class="text-muted">Este grado aun no tiene formas requeridas.</p>'
                : sortedAssignedForms.map(forma => {
                    const formaNombre = forma.nombre || `Forma ${forma.id_forma}`;

                    return `
                        <div class="grade-known-form-item">
                            <span class="grade-known-form-name">${formaNombre}</span>
                            <span class="grade-known-form-extra">ID ${forma.id_forma}</span>
                        </div>
                    `;
                }).join('')
            }
        </div>
        <div id="grade-forms-selector-container" style="display: none;"></div>
    `;

    listContainer.querySelectorAll('[data-grade-forms-sort]').forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedKey = btn.dataset.gradeFormsSort;
            if (!selectedKey) return;

            const isSameKey = finalViewState.gradeForms.sortKey === selectedKey;
            finalViewState.gradeForms.sortDirection = isSameKey && finalViewState.gradeForms.sortDirection === 'asc' ? 'desc' : 'asc';
            finalViewState.gradeForms.sortKey = selectedKey;
            updateListSortPreference('gradeForms', finalViewState.gradeForms.sortKey, finalViewState.gradeForms.sortDirection);
            renderGradeFormsList();
        });
    });

    if (gradeFormsState.selectorOpen) {
        renderGradeFormsSelector();
    }
}

function renderGradeFormsSelector() {
    const selectorContainer = document.getElementById('grade-forms-selector-container');
    const gradeFormsState = finalViewState.gradeForms;

    if (!selectorContainer) return;

    const assignedFormIds = new Set((gradeFormsState.links || []).map(link => String(link.id_forma)));
    const formsSortKey = gradeFormsState.sortKey || 'name';
    const formsSortDirection = gradeFormsState.sortDirection || 'asc';
    const sortedForms = sortListByDirection(gradeFormsState.forms || [], formsSortDirection, forma => {
        if (formsSortKey === 'id') return forma.id_forma;
        return forma.nombre || forma.id_forma;
    });

    selectorContainer.style.display = 'block';
    selectorContainer.innerHTML = `
        <div class="student-forms-selector-title">Selecciona las formas requeridas para este grado</div>
        <div class="student-forms-grid">
            ${sortedForms.map(forma => {
                const formaId = String(forma.id_forma);
                const checked = assignedFormIds.has(formaId) ? 'checked' : '';
                const formaNombre = forma.nombre || `Forma ${forma.id_forma}`;

                return `
                    <label class="student-form-item student-form-item-checkbox-only">
                        <div class="student-form-main">
                            <input type="checkbox" class="grade-form-checkbox" data-grade-forma-id="${formaId}" ${checked}>
                            <span class="student-form-name">${formaNombre}</span>
                        </div>
                    </label>
                `;
            }).join('')}
        </div>
    `;
}

function openGradeFormsSelector() {
    finalViewState.gradeForms.selectorOpen = true;
    renderGradeFormsList();
    switchGradeProfilePanel('forms');
}

function cancelGradeFormsSelection() {
    finalViewState.gradeForms.selectorOpen = false;
    renderGradeFormsList();
    switchGradeProfilePanel('forms');
}

async function saveGradeForms() {
    return runProtectedSaveAction('grade-forms-save', 'grade-save-forms-btn', async () => {
        if (!isAdminSession()) {
            showToast('Solo administradores pueden modificar formas requeridas del grado', 'error');
            return;
        }

        const selectedGrade = finalViewState.selectedGrade;
        const gradeFormsState = finalViewState.gradeForms;

        if (!selectedGrade || !gradeFormsState.loaded) {
            showToast('No hay datos de formas para guardar', 'error');
            return;
        }

        if (!gradeFormsState.selectorOpen) {
            showToast('Primero entra a Agregar/Quitar formas para guardar cambios', 'info');
            return;
        }

        const checkboxes = Array.from(document.querySelectorAll('.grade-form-checkbox'));
        const selectedFormaIds = checkboxes
            .filter(checkbox => checkbox.checked)
            .map(checkbox => String(checkbox.dataset.gradeFormaId));

        const existingByFormaId = {};
        (gradeFormsState.links || []).forEach(link => {
            existingByFormaId[String(link.id_forma)] = link;
        });

        const existingFormaIds = Object.keys(existingByFormaId);
        const toAdd = selectedFormaIds.filter(id => !existingFormaIds.includes(id));
        const toRemove = existingFormaIds.filter(id => !selectedFormaIds.includes(id));

        if (toAdd.length === 0 && toRemove.length === 0) {
            showToast('No hay cambios en las formas requeridas', 'info');
            return;
        }

        try {
            for (const formaId of toAdd) {
                await apiCall('/api/database/tables/grado_forma/rows', {
                    method: 'POST',
                    body: JSON.stringify({
                        id_grado: selectedGrade.id_grado,
                        id_forma: Number(formaId),
                    }),
                });
            }

            const pkFields = getPrimaryKeyFields(gradeFormsState.columns);
            for (const formaId of toRemove) {
                const linkRow = existingByFormaId[formaId];
                const rowId = buildCompositeRowId(linkRow, pkFields);

                if (!rowId) {
                    throw new Error('No se pudo determinar la llave de una relacion grado-forma');
                }

                await apiCall(`/api/database/tables/grado_forma/rows/${encodeURIComponent(rowId)}`, {
                    method: 'DELETE',
                });
            }

            showToast('Formas requeridas del grado actualizadas', 'success');
            finalViewState.gradeForms.loaded = false;
            finalViewState.gradeForms.selectorOpen = false;
            await loadGradeFormsPanel();
            switchGradeProfilePanel('forms');
            await loadFinalTabData('grados');
        } catch (error) {
            console.error('Error actualizando formas requeridas del grado:', error);
            showToast(`Error al actualizar formas requeridas: ${error.message || 'Intenta nuevamente'}`, 'error');
        }
    });
}

function setupGradeProfileEventListeners() {
    const modal = document.getElementById('grade-profile-modal');
    const closeBtn = document.getElementById('grade-profile-close-btn');
    const closeFooterBtn = document.getElementById('grade-close-btn');
    const editBtn = document.getElementById('grade-edit-btn');
    const manageFormsBtn = document.getElementById('grade-manage-forms-btn');
    const saveFormsBtn = document.getElementById('grade-save-forms-btn');
    const cancelFormsBtn = document.getElementById('grade-cancel-forms-btn');
    const menuInfoBtn = document.getElementById('grade-menu-info');
    const menuStudentsBtn = document.getElementById('grade-menu-students');
    const menuFormsBtn = document.getElementById('grade-menu-forms');

    if (!modal) return;

    if (closeBtn) {
        closeBtn.addEventListener('click', closeGradeProfileModal);
    }

    if (closeFooterBtn) {
        closeFooterBtn.addEventListener('click', closeGradeProfileModal);
    }

    modal.addEventListener('click', (e) => {
        if (e.target.id === 'grade-profile-modal') {
            closeGradeProfileModal();
        }
    });

    if (menuInfoBtn) {
        menuInfoBtn.addEventListener('click', () => {
            switchGradeProfilePanel('info');
        });
    }

    if (menuStudentsBtn) {
        menuStudentsBtn.addEventListener('click', async () => {
            switchGradeProfilePanel('students');
            await loadGradeStudentsPanel();
        });
    }

    if (menuFormsBtn) {
        menuFormsBtn.addEventListener('click', async () => {
            switchGradeProfilePanel('forms');
            await loadGradeFormsPanel();
        });
    }

    if (manageFormsBtn) {
        manageFormsBtn.addEventListener('click', async () => {
            if (!isAdminSession()) {
                showToast('Solo administradores pueden modificar formas requeridas del grado', 'error');
                return;
            }
            switchGradeProfilePanel('forms');
            await loadGradeFormsPanel();
            openGradeFormsSelector();
        });
    }

    if (saveFormsBtn) {
        saveFormsBtn.addEventListener('click', saveGradeForms);
    }

    if (cancelFormsBtn) {
        cancelFormsBtn.addEventListener('click', cancelGradeFormsSelection);
    }

    if (editBtn) {
        editBtn.addEventListener('click', async () => {
            if (!isAdminSession()) {
                showToast('Solo administradores pueden editar grados', 'error');
                return;
            }

            const selectedGrade = finalViewState.selectedGrade;
            if (!selectedGrade) {
                showToast('No hay grado seleccionado', 'error');
                return;
            }

            closeGradeProfileModal();
            await openFinalEditDialog('grados', selectedGrade);
        });
    }
}

async function openFormProfileModal(formRow) {
    const modal = document.getElementById('form-profile-modal');
    if (!modal) return;

    finalViewState.selectedForm = formRow;
    finalViewState.formStudents = {
        links: [],
        students: [],
        loaded: false,
        sortKey: finalViewState.sortPreferences.formStudents.sortKey,
        sortDirection: finalViewState.sortPreferences.formStudents.sortDirection,
    };

    const formName = formRow.nombre || `Forma ${formRow.id_forma}`;
    document.getElementById('form-profile-title').textContent = formName;
    document.getElementById('form-profile-subtitle').textContent = `ID: ${formRow.id_forma} · Consulta y edita esta forma`;

    const editBtn = document.getElementById('form-edit-btn');
    if (editBtn) {
        editBtn.style.display = isAdminSession() ? 'inline-block' : 'none';
    }

    renderFormInfoPanel(formRow);
    switchFormProfilePanel('info');
    modal.style.display = 'flex';
}

function closeFormProfileModal() {
    const modal = document.getElementById('form-profile-modal');
    if (!modal) return;

    modal.style.display = 'none';
    finalViewState.selectedForm = null;
    finalViewState.formStudents = {
        links: [],
        students: [],
        loaded: false,
        sortKey: finalViewState.sortPreferences.formStudents.sortKey,
        sortDirection: finalViewState.sortPreferences.formStudents.sortDirection,
    };

    const studentsList = document.getElementById('form-students-list');
    if (studentsList) {
        studentsList.innerHTML = '';
    }
}

function renderFormInfoPanel(formRow) {
    const panel = document.getElementById('form-panel-info');
    if (!panel) return;

    const labels = {
        id_forma: 'ID Forma',
        nombre: 'Nombre',
        descripcion: 'Descripcion',
        id_estilo: 'ID Estilo',
    };

    const entries = Object.entries(formRow || {});
    panel.innerHTML = `
        <div class="form-profile-info-grid">
            ${entries.map(([field, value]) => {
                const label = labels[field] || field;
                const normalizedValue = value === null || value === undefined || value === '' ? '—' : String(value);
                return `
                    <div class="form-profile-info-item">
                        <span class="form-profile-info-label">${label}</span>
                        <span class="form-profile-info-value">${normalizedValue}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function switchFormProfilePanel(panelName) {
    document.querySelectorAll('.form-profile-menu-btn').forEach(btn => {
        if (btn.dataset.panel === panelName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.form-profile-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    const panel = document.getElementById(`form-panel-${panelName}`);
    if (panel) {
        panel.classList.add('active');
    }
}

async function loadFormStudentsPanel() {
    const loading = document.getElementById('form-students-loading');
    const listContainer = document.getElementById('form-students-list');
    const selectedForm = finalViewState.selectedForm;

    if (!listContainer || !selectedForm) return;
    if (finalViewState.formStudents.loaded) return;

    try {
        loading.style.display = 'flex';
        listContainer.innerHTML = '';

        const [studentsRows, alumnoFormaRows] = await Promise.all([
            apiCall('/api/database/tables/alumnos/rows?limit=3000'),
            apiCall('/api/database/tables/alumno_forma/rows?limit=3000'),
        ]);

        finalViewState.formStudents = {
            links: (alumnoFormaRows || []).filter(link => String(link.id_forma) === String(selectedForm.id_forma)),
            students: studentsRows || [],
            loaded: true,
            sortKey: finalViewState.formStudents.sortKey || 'name',
            sortDirection: finalViewState.formStudents.sortDirection || 'asc',
        };

        renderFormStudentsList();
    } catch (error) {
        listContainer.innerHTML = '<p class="text-muted">No se pudo cargar la lista de alumnos.</p>';
        showToast('No se pudieron cargar los alumnos de esta forma', 'error');
    } finally {
        loading.style.display = 'none';
    }
}

function renderFormStudentsList() {
    const listContainer = document.getElementById('form-students-list');
    const formStudentsState = finalViewState.formStudents;

    if (!listContainer) return;

    const studentsById = {};
    (formStudentsState.students || []).forEach(student => {
        studentsById[String(student.id_alumno)] = student;
    });

    const knownByLinks = (formStudentsState.links || []).map(link => {
        const student = studentsById[String(link.id_alumno)];
        const studentName = student
            ? [student.nombre, student.apellido].filter(Boolean).join(' ').trim() || student.numero_matricula || `Alumno ${student.id_alumno}`
            : `Alumno ${link.id_alumno}`;
        const fechaAprendida = link.fecha_aprendida ? String(link.fecha_aprendida).slice(0, 10) : 'Sin fecha';

        return {
            id_alumno: link.id_alumno,
            nombre: studentName,
            fecha_aprendida: fechaAprendida,
        };
    });

    const formSortKey = formStudentsState.sortKey || 'name';
    const formSortDirection = formStudentsState.sortDirection || 'asc';
    const sortedKnownByLinks = sortListByDirection(knownByLinks, formSortDirection, item => {
        if (formSortKey === 'date') return item.fecha_aprendida === 'Sin fecha' ? '9999-12-31' : item.fecha_aprendida;
        return item.nombre;
    });

    const nameLabel = `Alumno${formSortKey === 'name' ? getSortIndicator(formSortDirection) : ''}`;
    const dateLabel = `Fecha aprendida${formSortKey === 'date' ? getSortIndicator(formSortDirection) : ''}`;

    listContainer.innerHTML = `
        <div class="form-students-summary">
            Alumnos que saben esta forma: <strong>${knownByLinks.length}</strong>
        </div>
        <div class="list-sort-bar" id="form-students-sort-bar">
            <button type="button" class="list-sort-btn" data-form-sort="name">${nameLabel}</button>
            <button type="button" class="list-sort-btn" data-form-sort="date">${dateLabel}</button>
        </div>
        <div class="form-known-students">
            ${sortedKnownByLinks.length === 0
                ? '<p class="text-muted">Aun no hay alumnos registrados para esta forma.</p>'
                : sortedKnownByLinks.map(item => {
                    return `
                        <div class="form-known-student-item">
                            <span class="form-known-student-name">${item.nombre}</span>
                            <span class="form-known-student-date">${item.fecha_aprendida}</span>
                        </div>
                    `;
                }).join('')
            }
        </div>
    `;

    listContainer.querySelectorAll('[data-form-sort]').forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedKey = btn.dataset.formSort;
            if (!selectedKey) return;

            const isSameKey = finalViewState.formStudents.sortKey === selectedKey;
            finalViewState.formStudents.sortDirection = isSameKey && finalViewState.formStudents.sortDirection === 'asc' ? 'desc' : 'asc';
            finalViewState.formStudents.sortKey = selectedKey;
            updateListSortPreference('formStudents', finalViewState.formStudents.sortKey, finalViewState.formStudents.sortDirection);
            renderFormStudentsList();
        });
    });
}

function setupFormProfileEventListeners() {
    const modal = document.getElementById('form-profile-modal');
    const closeBtn = document.getElementById('form-profile-close-btn');
    const closeFooterBtn = document.getElementById('form-close-btn');
    const editBtn = document.getElementById('form-edit-btn');
    const menuInfoBtn = document.getElementById('form-menu-info');
    const menuStudentsBtn = document.getElementById('form-menu-students');

    if (!modal) return;

    if (closeBtn) {
        closeBtn.addEventListener('click', closeFormProfileModal);
    }

    if (closeFooterBtn) {
        closeFooterBtn.addEventListener('click', closeFormProfileModal);
    }

    modal.addEventListener('click', (e) => {
        if (e.target.id === 'form-profile-modal') {
            closeFormProfileModal();
        }
    });

    if (menuInfoBtn) {
        menuInfoBtn.addEventListener('click', () => {
            switchFormProfilePanel('info');
        });
    }

    if (menuStudentsBtn) {
        menuStudentsBtn.addEventListener('click', async () => {
            switchFormProfilePanel('students');
            await loadFormStudentsPanel();
        });
    }

    if (editBtn) {
        editBtn.addEventListener('click', async () => {
            if (!isAdminSession()) {
                showToast('Solo administradores pueden editar formas', 'error');
                return;
            }

            const selectedForm = finalViewState.selectedForm;
            if (!selectedForm) {
                showToast('No hay forma seleccionada', 'error');
                return;
            }

            closeFormProfileModal();
            await openFinalEditDialog('formas', selectedForm);
        });
    }
}

async function openStudentProfileModal(studentRow) {
    const modal = document.getElementById('student-profile-modal');
    if (!modal) return;

    finalViewState.selectedStudent = studentRow;
    finalViewState.studentForms = {
        forms: [],
        links: [],
        columns: [],
        loaded: false,
        selectorOpen: false,
        sortKey: finalViewState.sortPreferences.studentForms.sortKey,
        sortDirection: finalViewState.sortPreferences.studentForms.sortDirection,
    };

    const studentName = studentRow.nombre || studentRow.numero_matricula || `Alumno ${studentRow.id_alumno}`;
    document.getElementById('student-profile-title').textContent = studentName;
    document.getElementById('student-profile-subtitle').textContent = `ID: ${studentRow.id_alumno} · Gestiona su informacion y sus formas`;

    const canManage = isAdminSession();
    const editBtn = document.getElementById('student-edit-btn');
    const manageFormsBtn = document.getElementById('student-manage-forms-btn');
    const saveFormsBtn = document.getElementById('student-save-forms-btn');
    const cancelFormsBtn = document.getElementById('student-cancel-forms-btn');

    if (editBtn) {
        editBtn.style.display = canManage ? 'inline-block' : 'none';
    }
    if (manageFormsBtn) {
        manageFormsBtn.style.display = canManage ? 'inline-block' : 'none';
    }
    if (!canManage) {
        if (saveFormsBtn) saveFormsBtn.style.display = 'none';
        if (cancelFormsBtn) cancelFormsBtn.style.display = 'none';
    }

    renderStudentInfoPanel(studentRow);
    switchStudentProfilePanel('info');
    modal.style.display = 'flex';
}

function closeStudentProfileModal() {
    const modal = document.getElementById('student-profile-modal');
    if (!modal) return;

    modal.style.display = 'none';
    finalViewState.selectedStudent = null;
    finalViewState.studentForms = {
        forms: [],
        links: [],
        columns: [],
        loaded: false,
        selectorOpen: false,
        sortKey: finalViewState.sortPreferences.studentForms.sortKey,
        sortDirection: finalViewState.sortPreferences.studentForms.sortDirection,
    };

    const formsList = document.getElementById('student-forms-list');
    if (formsList) {
        formsList.innerHTML = '';
    }
}

function renderStudentInfoPanel(studentRow) {
    const panel = document.getElementById('student-panel-info');
    if (!panel) return;

    const labels = {
        id_alumno: 'ID Alumno',
        nombre: 'Nombre',
        apellido: 'Apellido',
        numero_matricula: 'Matricula',
        correo_electronico: 'Correo',
        telefono: 'Telefono',
        fecha_nacimiento: 'Fecha de nacimiento',
        id_grado: 'ID Grado',
        fecha_inscripcion: 'Fecha de inscripcion',
        estado: 'Estado',
    };

    const entries = Object.entries(studentRow || {});
    panel.innerHTML = `
        <div class="student-profile-info-grid">
            ${entries.map(([field, value]) => {
                const label = labels[field] || field;
                const normalizedValue = value === null || value === undefined || value === '' ? '—' : String(value);
                return `
                    <div class="student-profile-info-item">
                        <span class="student-profile-info-label">${label}</span>
                        <span class="student-profile-info-value">${normalizedValue}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function switchStudentProfilePanel(panelName) {
    document.querySelectorAll('.student-profile-menu-btn').forEach(btn => {
        if (btn.dataset.panel === panelName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.student-profile-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    const panel = document.getElementById(`student-panel-${panelName}`);
    if (panel) {
        panel.classList.add('active');
    }

    const saveBtn = document.getElementById('student-save-forms-btn');
    const cancelBtn = document.getElementById('student-cancel-forms-btn');
    const canManage = isAdminSession();
    if (saveBtn) {
        const shouldShowSave = canManage && panelName === 'forms' && finalViewState.studentForms.selectorOpen;
        saveBtn.style.display = shouldShowSave ? 'inline-block' : 'none';
    }
    if (cancelBtn) {
        const shouldShowCancel = canManage && panelName === 'forms' && finalViewState.studentForms.selectorOpen;
        cancelBtn.style.display = shouldShowCancel ? 'inline-block' : 'none';
    }
}

async function loadStudentFormsPanel() {
    const loading = document.getElementById('student-forms-loading');
    const listContainer = document.getElementById('student-forms-list');
    const student = finalViewState.selectedStudent;

    if (!listContainer || !student) return;
    if (finalViewState.studentForms.loaded) return;

    try {
        loading.style.display = 'flex';
        listContainer.innerHTML = '';

        const [formsRows, alumnoFormaRows, alumnoFormaColumns] = await Promise.all([
            apiCall('/api/database/tables/formas/rows?limit=1000'),
            apiCall('/api/database/tables/alumno_forma/rows?limit=3000'),
            apiCall('/api/database/tables/alumno_forma/columns'),
        ]);

        finalViewState.studentForms = {
            forms: formsRows || [],
            links: (alumnoFormaRows || []).filter(link => String(link.id_alumno) === String(student.id_alumno)),
            columns: alumnoFormaColumns || [],
            loaded: true,
            selectorOpen: false,
            sortKey: finalViewState.studentForms.sortKey || 'name',
            sortDirection: finalViewState.studentForms.sortDirection || 'asc',
        };

        renderStudentFormsList();
    } catch (error) {
        listContainer.innerHTML = '<p class="text-muted">No se pudieron cargar las formas.</p>';
        showToast('No se pudieron cargar las formas del alumno', 'error');
    } finally {
        loading.style.display = 'none';
    }
}

function renderStudentFormsList() {
    const listContainer = document.getElementById('student-forms-list');
    const studentFormsState = finalViewState.studentForms;

    if (!listContainer) return;

    if (!studentFormsState.forms || studentFormsState.forms.length === 0) {
        listContainer.innerHTML = '<p class="text-muted">No hay formas disponibles.</p>';
        return;
    }

    const assignedByFormaId = {};
    (studentFormsState.links || []).forEach(link => {
        assignedByFormaId[String(link.id_forma)] = link;
    });

    const assignedForms = (studentFormsState.forms || []).filter(forma => {
        return Boolean(assignedByFormaId[String(forma.id_forma)]);
    });

    const studentSortKey = studentFormsState.sortKey || 'name';
    const studentSortDirection = studentFormsState.sortDirection || 'asc';
    const sortedAssignedForms = sortListByDirection(assignedForms, studentSortDirection, forma => {
        if (studentSortKey === 'date') {
            const linked = assignedByFormaId[String(forma.id_forma)];
            return linked?.fecha_aprendida ? String(linked.fecha_aprendida).slice(0, 10) : '9999-12-31';
        }
        return forma.nombre || forma.id_forma;
    });

    const nameLabel = `Forma${studentSortKey === 'name' ? getSortIndicator(studentSortDirection) : ''}`;
    const dateLabel = `Fecha aprendida${studentSortKey === 'date' ? getSortIndicator(studentSortDirection) : ''}`;

    listContainer.innerHTML = `
        <div class="student-forms-summary">
            Formas asignadas: <strong>${Object.keys(assignedByFormaId).length}</strong> de ${studentFormsState.forms.length}
        </div>
        <div class="list-sort-bar" id="student-forms-sort-bar">
            <button type="button" class="list-sort-btn" data-student-form-sort="name">${nameLabel}</button>
            <button type="button" class="list-sort-btn" data-student-form-sort="date">${dateLabel}</button>
        </div>
        <div class="student-known-forms">
            ${sortedAssignedForms.length === 0
                ? '<p class="text-muted">Este alumno aun no tiene formas registradas.</p>'
                : sortedAssignedForms.map(forma => {
                    const formaId = String(forma.id_forma);
                    const assigned = assignedByFormaId[formaId];
                    const fechaAprendida = assigned?.fecha_aprendida ? String(assigned.fecha_aprendida).slice(0, 10) : 'Sin fecha';
                    const formaNombre = forma.nombre || `Forma ${forma.id_forma}`;

                    return `
                        <div class="student-known-form-item">
                            <span class="student-known-form-name">${formaNombre}</span>
                            <span class="student-known-form-date">${fechaAprendida}</span>
                        </div>
                    `;
                }).join('')
            }
        </div>
        <div id="student-forms-selector-container" style="display: none;"></div>
    `;

    listContainer.querySelectorAll('[data-student-form-sort]').forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedKey = btn.dataset.studentFormSort;
            if (!selectedKey) return;

            const isSameKey = finalViewState.studentForms.sortKey === selectedKey;
            finalViewState.studentForms.sortDirection = isSameKey && finalViewState.studentForms.sortDirection === 'asc' ? 'desc' : 'asc';
            finalViewState.studentForms.sortKey = selectedKey;
            updateListSortPreference('studentForms', finalViewState.studentForms.sortKey, finalViewState.studentForms.sortDirection);
            renderStudentFormsList();
        });
    });

    if (studentFormsState.selectorOpen) {
        renderStudentFormsSelector();
    }
}

function renderStudentFormsSelector() {
    const selectorContainer = document.getElementById('student-forms-selector-container');
    const studentFormsState = finalViewState.studentForms;

    if (!selectorContainer) return;

    const assignedFormIds = new Set((studentFormsState.links || []).map(link => String(link.id_forma)));
    const studentSortKey = studentFormsState.sortKey || 'name';
    const studentSortDirection = studentFormsState.sortDirection || 'asc';
    const sortedForms = sortListByDirection(studentFormsState.forms || [], studentSortDirection, forma => {
        if (studentSortKey === 'date') {
            const assignedLink = (studentFormsState.links || []).find(link => String(link.id_forma) === String(forma.id_forma));
            return assignedLink?.fecha_aprendida ? String(assignedLink.fecha_aprendida).slice(0, 10) : '9999-12-31';
        }
        return forma.nombre || forma.id_forma;
    });

    selectorContainer.style.display = 'block';
    selectorContainer.innerHTML = `
        <div class="student-forms-selector-title">Selecciona las formas que sabe el alumno</div>
        <div class="student-forms-grid">
            ${sortedForms.map(forma => {
                const formaId = String(forma.id_forma);
                const checked = assignedFormIds.has(formaId) ? 'checked' : '';
                const formaNombre = forma.nombre || `Forma ${forma.id_forma}`;
                const assignedLink = (studentFormsState.links || []).find(link => String(link.id_forma) === formaId);
                const fechaAprendida = assignedLink?.fecha_aprendida ? String(assignedLink.fecha_aprendida).slice(0, 10) : '';

                return `
                    <label class="student-form-item student-form-item-checkbox-only">
                        <div class="student-form-main">
                            <input type="checkbox" class="student-form-checkbox" data-forma-id="${formaId}" ${checked}>
                            <span class="student-form-name">${formaNombre}</span>
                        </div>
                        <input type="date" class="student-form-date" data-forma-date="${formaId}" value="${fechaAprendida}" title="Fecha aprendida (opcional)">
                    </label>
                `;
            }).join('')}
        </div>
        <p class="text-muted">La fecha es opcional al agregar una forma nueva; si la dejas vacia se usara la fecha actual.</p>
    `;
}

function openStudentFormsSelector() {
    finalViewState.studentForms.selectorOpen = true;
    renderStudentFormsList();

    const saveBtn = document.getElementById('student-save-forms-btn');
    const cancelBtn = document.getElementById('student-cancel-forms-btn');
    if (saveBtn) {
        saveBtn.style.display = 'inline-block';
    }
    if (cancelBtn) {
        cancelBtn.style.display = 'inline-block';
    }
}

function cancelStudentFormsSelection() {
    finalViewState.studentForms.selectorOpen = false;
    renderStudentFormsList();
    switchStudentProfilePanel('forms');
}

function getTodayDateInputValue() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function saveStudentForms() {
    return runProtectedSaveAction('student-forms-save', 'student-save-forms-btn', async () => {
        if (!isAdminSession()) {
            showToast('Solo administradores pueden modificar formas', 'error');
            return;
        }

        const student = finalViewState.selectedStudent;
        const formsState = finalViewState.studentForms;

        if (!student || !formsState.loaded) {
            showToast('No hay datos de formas para guardar', 'error');
            return;
        }

        if (!formsState.selectorOpen) {
            showToast('Primero entra a Agregar/Quitar formas para guardar cambios', 'info');
            return;
        }

        const checkboxes = Array.from(document.querySelectorAll('.student-form-checkbox'));
        const selectedFormaIds = checkboxes
            .filter(checkbox => checkbox.checked)
            .map(checkbox => String(checkbox.dataset.formaId));

        const existingByFormaId = {};
        (formsState.links || []).forEach(link => {
            existingByFormaId[String(link.id_forma)] = link;
        });

        const existingFormaIds = Object.keys(existingByFormaId);
        const toAdd = selectedFormaIds.filter(id => !existingFormaIds.includes(id));
        const toRemove = existingFormaIds.filter(id => !selectedFormaIds.includes(id));

        if (toAdd.length === 0 && toRemove.length === 0) {
            showToast('No hay cambios en las formas del alumno', 'info');
            return;
        }

        try {
            for (const formaId of toAdd) {
                const dateInput = document.querySelector(`[data-forma-date="${formaId}"]`);
                const fechaAprendida = dateInput?.value?.trim() || getTodayDateInputValue();

                await apiCall('/api/database/tables/alumno_forma/rows', {
                    method: 'POST',
                    body: JSON.stringify({
                        id_alumno: student.id_alumno,
                        id_forma: Number(formaId),
                        fecha_aprendida: fechaAprendida,
                    }),
                });
            }

            const pkFields = getPrimaryKeyFields(formsState.columns);
            for (const formaId of toRemove) {
                const linkRow = existingByFormaId[formaId];
                const rowId = buildCompositeRowId(linkRow, pkFields);

                if (!rowId) {
                    throw new Error('No se pudo determinar la llave de una relacion alumno-forma');
                }

                await apiCall(`/api/database/tables/alumno_forma/rows/${encodeURIComponent(rowId)}`, {
                    method: 'DELETE',
                });
            }

            showToast('Formas del alumno actualizadas', 'success');
            finalViewState.studentForms.loaded = false;
            finalViewState.studentForms.selectorOpen = false;
            await loadStudentFormsPanel();
            switchStudentProfilePanel('forms');
            await loadFinalTabData('alumnos');
        } catch (error) {
            console.error('Error actualizando formas de alumno:', error);
            showToast(`Error al actualizar formas: ${error.message || 'Intenta nuevamente'}`, 'error');
        }
    });
}

function setupStudentProfileEventListeners() {
    const modal = document.getElementById('student-profile-modal');
    const closeBtn = document.getElementById('student-profile-close-btn');
    const closeFooterBtn = document.getElementById('student-close-btn');
    const editBtn = document.getElementById('student-edit-btn');
    const manageFormsBtn = document.getElementById('student-manage-forms-btn');
    const saveFormsBtn = document.getElementById('student-save-forms-btn');
    const cancelFormsBtn = document.getElementById('student-cancel-forms-btn');
    const menuInfoBtn = document.getElementById('student-menu-info');
    const menuFormsBtn = document.getElementById('student-menu-forms');

    if (!modal) return;

    if (closeBtn) {
        closeBtn.addEventListener('click', closeStudentProfileModal);
    }

    if (closeFooterBtn) {
        closeFooterBtn.addEventListener('click', closeStudentProfileModal);
    }

    modal.addEventListener('click', (e) => {
        if (e.target.id === 'student-profile-modal') {
            closeStudentProfileModal();
        }
    });

    if (menuInfoBtn) {
        menuInfoBtn.addEventListener('click', () => {
            switchStudentProfilePanel('info');
        });
    }

    if (menuFormsBtn) {
        menuFormsBtn.addEventListener('click', async () => {
            switchStudentProfilePanel('forms');
            await loadStudentFormsPanel();
        });
    }

    if (manageFormsBtn) {
        manageFormsBtn.addEventListener('click', async () => {
            if (!isAdminSession()) {
                showToast('Solo administradores pueden modificar formas de alumno', 'error');
                return;
            }
            switchStudentProfilePanel('forms');
            await loadStudentFormsPanel();
            openStudentFormsSelector();
        });
    }

    if (editBtn) {
        editBtn.addEventListener('click', async () => {
            if (!isAdminSession()) {
                showToast('Solo administradores pueden editar alumnos', 'error');
                return;
            }

            const student = finalViewState.selectedStudent;
            if (!student) {
                showToast('No hay alumno seleccionado', 'error');
                return;
            }

            closeStudentProfileModal();
            await openFinalEditDialog('alumnos', student);
        });
    }

    if (saveFormsBtn) {
        saveFormsBtn.addEventListener('click', saveStudentForms);
    }

    if (cancelFormsBtn) {
        cancelFormsBtn.addEventListener('click', cancelStudentFormsSelection);
    }
}

async function openInstructorProfileModal(instructorRow) {
    const modal = document.getElementById('instructor-profile-modal');
    if (!modal) return;

    finalViewState.selectedInstructor = instructorRow;
    finalViewState.instructorForms = {
        forms: [],
        links: [],
        columns: [],
        loaded: false,
        selectorOpen: false,
        relationMode: 'unknown',
        sortKey: finalViewState.sortPreferences.instructorForms.sortKey,
        sortDirection: finalViewState.sortPreferences.instructorForms.sortDirection,
    };
    finalViewState.instructorCourses = {
        courses: [],
        links: [],
        columns: [],
        loaded: false,
        selectorOpen: false,
        sortKey: finalViewState.sortPreferences.instructorCourses.sortKey,
        sortDirection: finalViewState.sortPreferences.instructorCourses.sortDirection,
    };

    const instructorName = instructorRow.nombre || `Instructor ${instructorRow.id_instructor}`;
    document.getElementById('instructor-profile-title').textContent = instructorName;
    document.getElementById('instructor-profile-subtitle').textContent = `ID: ${instructorRow.id_instructor} · Gestiona sus formas y cursos`;

    const canManage = isAdminSession();
    const editBtn = document.getElementById('instructor-edit-btn');
    const manageFormsBtn = document.getElementById('instructor-manage-forms-btn');
    const saveFormsBtn = document.getElementById('instructor-save-forms-btn');
    const cancelFormsBtn = document.getElementById('instructor-cancel-forms-btn');
    const manageCoursesBtn = document.getElementById('instructor-manage-courses-btn');
    const saveCoursesBtn = document.getElementById('instructor-save-courses-btn');
    const cancelCoursesBtn = document.getElementById('instructor-cancel-courses-btn');

    if (editBtn) editBtn.style.display = canManage ? 'inline-block' : 'none';
    if (manageFormsBtn) manageFormsBtn.style.display = canManage ? 'inline-block' : 'none';
    if (manageCoursesBtn) manageCoursesBtn.style.display = canManage ? 'inline-block' : 'none';
    if (!canManage) {
        if (saveFormsBtn) saveFormsBtn.style.display = 'none';
        if (cancelFormsBtn) cancelFormsBtn.style.display = 'none';
        if (saveCoursesBtn) saveCoursesBtn.style.display = 'none';
        if (cancelCoursesBtn) cancelCoursesBtn.style.display = 'none';
    }

    renderInstructorInfoPanel(instructorRow);
    switchInstructorProfilePanel('info');
    modal.style.display = 'flex';
}

function closeInstructorProfileModal() {
    const modal = document.getElementById('instructor-profile-modal');
    if (!modal) return;

    modal.style.display = 'none';
    finalViewState.selectedInstructor = null;
    finalViewState.instructorForms = {
        forms: [],
        links: [],
        columns: [],
        loaded: false,
        selectorOpen: false,
        relationMode: 'unknown',
        sortKey: finalViewState.sortPreferences.instructorForms.sortKey,
        sortDirection: finalViewState.sortPreferences.instructorForms.sortDirection,
    };
    finalViewState.instructorCourses = {
        courses: [],
        links: [],
        columns: [],
        loaded: false,
        selectorOpen: false,
        sortKey: finalViewState.sortPreferences.instructorCourses.sortKey,
        sortDirection: finalViewState.sortPreferences.instructorCourses.sortDirection,
    };

    const formsList = document.getElementById('instructor-forms-list');
    if (formsList) {
        formsList.innerHTML = '';
    }

    const coursesList = document.getElementById('instructor-courses-list');
    if (coursesList) {
        coursesList.innerHTML = '';
    }
}

function renderInstructorInfoPanel(instructorRow) {
    const panel = document.getElementById('instructor-panel-info');
    if (!panel) return;

    const labels = {
        id_instructor: 'ID Instructor',
        nombre: 'Nombre',
        especialidad: 'Especialidad',
        fecha_contratacion: 'Fecha de contratacion',
        activo: 'Activo',
    };

    const entries = Object.entries(instructorRow || {});
    panel.innerHTML = `
        <div class="instructor-profile-info-grid">
            ${entries.map(([field, value]) => {
                const label = labels[field] || field;
                const normalizedValue = value === null || value === undefined || value === '' ? '—' : String(value);
                return `
                    <div class="instructor-profile-info-item">
                        <span class="instructor-profile-info-label">${label}</span>
                        <span class="instructor-profile-info-value">${normalizedValue}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function switchInstructorProfilePanel(panelName) {
    document.querySelectorAll('.instructor-profile-menu-btn').forEach(btn => {
        if (btn.dataset.panel === panelName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.instructor-profile-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    const panel = document.getElementById(`instructor-panel-${panelName}`);
    if (panel) {
        panel.classList.add('active');
    }

    const manageFormsBtn = document.getElementById('instructor-manage-forms-btn');
    const saveFormsBtn = document.getElementById('instructor-save-forms-btn');
    const cancelFormsBtn = document.getElementById('instructor-cancel-forms-btn');
    const manageCoursesBtn = document.getElementById('instructor-manage-courses-btn');
    const saveCoursesBtn = document.getElementById('instructor-save-courses-btn');
    const cancelCoursesBtn = document.getElementById('instructor-cancel-courses-btn');

    const isFormsPanel = panelName === 'forms';
    const isCoursesPanel = panelName === 'courses';
    const canManage = isAdminSession();

    if (manageFormsBtn) {
        manageFormsBtn.style.display = canManage && isFormsPanel ? 'inline-block' : 'none';
    }
    if (saveFormsBtn) {
        saveFormsBtn.style.display = canManage && isFormsPanel && finalViewState.instructorForms.selectorOpen ? 'inline-block' : 'none';
    }
    if (cancelFormsBtn) {
        cancelFormsBtn.style.display = canManage && isFormsPanel && finalViewState.instructorForms.selectorOpen ? 'inline-block' : 'none';
    }

    if (manageCoursesBtn) {
        manageCoursesBtn.style.display = canManage && isCoursesPanel ? 'inline-block' : 'none';
    }
    if (saveCoursesBtn) {
        saveCoursesBtn.style.display = canManage && isCoursesPanel && finalViewState.instructorCourses.selectorOpen ? 'inline-block' : 'none';
    }
    if (cancelCoursesBtn) {
        cancelCoursesBtn.style.display = canManage && isCoursesPanel && finalViewState.instructorCourses.selectorOpen ? 'inline-block' : 'none';
    }
}

async function loadInstructorFormsPanel() {
    const loading = document.getElementById('instructor-forms-loading');
    const listContainer = document.getElementById('instructor-forms-list');
    const instructor = finalViewState.selectedInstructor;

    if (!listContainer || !instructor) return;
    if (finalViewState.instructorForms.loaded) return;

    try {
        loading.style.display = 'flex';
        listContainer.innerHTML = '';

        try {
            const [formsRows, instructorFormaRows, instructorFormaColumns] = await Promise.all([
                apiCall('/api/database/tables/formas/rows?limit=2000'),
                apiCall('/api/database/tables/instructor_forma/rows?limit=4000'),
                apiCall('/api/database/tables/instructor_forma/columns'),
            ]);

            finalViewState.instructorForms = {
                forms: formsRows || [],
                links: (instructorFormaRows || []).filter(link => String(link.id_instructor) === String(instructor.id_instructor)),
                columns: instructorFormaColumns || [],
                loaded: true,
                selectorOpen: false,
                relationMode: 'direct',
                sortKey: finalViewState.instructorForms.sortKey || finalViewState.sortPreferences.instructorForms.sortKey,
                sortDirection: finalViewState.instructorForms.sortDirection || finalViewState.sortPreferences.instructorForms.sortDirection,
            };
        } catch (directError) {
            const [formsRows, instructorEstiloRows, instructorEstiloColumns] = await Promise.all([
                apiCall('/api/database/tables/formas/rows?limit=2000'),
                apiCall('/api/database/tables/instructor_estilo/rows?limit=4000'),
                apiCall('/api/database/tables/instructor_estilo/columns'),
            ]);

            finalViewState.instructorForms = {
                forms: formsRows || [],
                links: (instructorEstiloRows || []).filter(link => String(link.id_instructor) === String(instructor.id_instructor)),
                columns: instructorEstiloColumns || [],
                loaded: true,
                selectorOpen: false,
                relationMode: 'byStyle',
                sortKey: finalViewState.instructorForms.sortKey || finalViewState.sortPreferences.instructorForms.sortKey,
                sortDirection: finalViewState.instructorForms.sortDirection || finalViewState.sortPreferences.instructorForms.sortDirection,
            };
        }

        renderInstructorFormsList();
    } catch (error) {
        listContainer.innerHTML = '<p class="text-muted">No se pudieron cargar las formas del instructor.</p>';
        showToast('No se pudieron cargar las formas del instructor', 'error');
    } finally {
        loading.style.display = 'none';
    }
}

function renderInstructorFormsList() {
    const listContainer = document.getElementById('instructor-forms-list');
    const instructorFormsState = finalViewState.instructorForms;

    if (!listContainer) return;

    if (!instructorFormsState.forms || instructorFormsState.forms.length === 0) {
        listContainer.innerHTML = '<p class="text-muted">No hay formas disponibles.</p>';
        return;
    }

    const relationMode = instructorFormsState.relationMode;
    const assignedByFormaId = {};
    const assignedStyleIds = new Set();

    if (relationMode === 'direct') {
        (instructorFormsState.links || []).forEach(link => {
            assignedByFormaId[String(link.id_forma)] = link;
        });
    } else {
        (instructorFormsState.links || []).forEach(link => {
            assignedStyleIds.add(String(link.id_estilo));
        });
    }

    const assignedForms = (instructorFormsState.forms || []).filter(forma => {
        if (relationMode === 'direct') {
            return Boolean(assignedByFormaId[String(forma.id_forma)]);
        }
        return assignedStyleIds.has(String(forma.id_estilo));
    });

    const formsSortKey = instructorFormsState.sortKey || 'name';
    const formsSortDirection = instructorFormsState.sortDirection || 'asc';
    const sortedAssignedForms = sortListByDirection(assignedForms, formsSortDirection, forma => {
        if (formsSortKey === 'style') return forma.id_estilo;
        return forma.nombre || forma.id_forma;
    });

    const nameLabel = `Forma${formsSortKey === 'name' ? getSortIndicator(formsSortDirection) : ''}`;
    const styleLabel = `Estilo${formsSortKey === 'style' ? getSortIndicator(formsSortDirection) : ''}`;

    listContainer.innerHTML = `
        <div class="grade-students-summary">
            Formas asignadas: <strong>${assignedForms.length}</strong> de ${instructorFormsState.forms.length}
        </div>
        ${relationMode === 'byStyle' ? '<p class="text-muted">Tu base de datos asigna formas por estilo (`instructor_estilo`). Al seleccionar una forma se asigna su estilo completo.</p>' : ''}
        <div class="list-sort-bar" id="instructor-forms-sort-bar">
            <button type="button" class="list-sort-btn" data-instructor-forms-sort="name">${nameLabel}</button>
            <button type="button" class="list-sort-btn" data-instructor-forms-sort="style">${styleLabel}</button>
        </div>
        <div class="grade-known-forms">
            ${sortedAssignedForms.length === 0
                ? '<p class="text-muted">Este instructor aun no tiene formas asignadas.</p>'
                : sortedAssignedForms.map(forma => {
                    const formaNombre = forma.nombre || `Forma ${forma.id_forma}`;
                    return `
                        <div class="grade-known-form-item">
                            <span class="grade-known-form-name">${formaNombre}</span>
                            <span class="grade-known-form-extra">Estilo ${forma.id_estilo}</span>
                        </div>
                    `;
                }).join('')
            }
        </div>
        <div id="instructor-forms-selector-container" style="display: none;"></div>
    `;

    listContainer.querySelectorAll('[data-instructor-forms-sort]').forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedKey = btn.dataset.instructorFormsSort;
            if (!selectedKey) return;

            const isSameKey = finalViewState.instructorForms.sortKey === selectedKey;
            finalViewState.instructorForms.sortDirection = isSameKey && finalViewState.instructorForms.sortDirection === 'asc' ? 'desc' : 'asc';
            finalViewState.instructorForms.sortKey = selectedKey;
            updateListSortPreference('instructorForms', finalViewState.instructorForms.sortKey, finalViewState.instructorForms.sortDirection);
            renderInstructorFormsList();
        });
    });

    if (instructorFormsState.selectorOpen) {
        renderInstructorFormsSelector();
    }
}

function renderInstructorFormsSelector() {
    const selectorContainer = document.getElementById('instructor-forms-selector-container');
    const instructorFormsState = finalViewState.instructorForms;

    if (!selectorContainer) return;

    const relationMode = instructorFormsState.relationMode;
    const assignedFormIds = new Set();
    const assignedStyleIds = new Set();

    if (relationMode === 'direct') {
        (instructorFormsState.links || []).forEach(link => assignedFormIds.add(String(link.id_forma)));
    } else {
        (instructorFormsState.links || []).forEach(link => assignedStyleIds.add(String(link.id_estilo)));
    }

    const formsSortKey = instructorFormsState.sortKey || 'name';
    const formsSortDirection = instructorFormsState.sortDirection || 'asc';
    const sortedForms = sortListByDirection(instructorFormsState.forms || [], formsSortDirection, forma => {
        if (formsSortKey === 'style') return forma.id_estilo;
        return forma.nombre || forma.id_forma;
    });

    selectorContainer.style.display = 'block';
    selectorContainer.innerHTML = `
        <div class="student-forms-selector-title">Selecciona las formas que puede impartir</div>
        <div class="student-forms-grid">
            ${sortedForms.map(forma => {
                const formaId = String(forma.id_forma);
                const checked = relationMode === 'direct'
                    ? assignedFormIds.has(formaId)
                    : assignedStyleIds.has(String(forma.id_estilo));
                const formaNombre = forma.nombre || `Forma ${forma.id_forma}`;

                return `
                    <label class="student-form-item student-form-item-checkbox-only">
                        <div class="student-form-main">
                            <input type="checkbox" class="instructor-form-checkbox" data-instructor-forma-id="${formaId}" ${checked ? 'checked' : ''}>
                            <span class="student-form-name">${formaNombre}</span>
                        </div>
                    </label>
                `;
            }).join('')}
        </div>
    `;
}

function openInstructorFormsSelector() {
    finalViewState.instructorForms.selectorOpen = true;
    renderInstructorFormsList();
    switchInstructorProfilePanel('forms');
}

function cancelInstructorFormsSelection() {
    finalViewState.instructorForms.selectorOpen = false;
    renderInstructorFormsList();
    switchInstructorProfilePanel('forms');
}

function getCurrentDateTimeInputValue() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

async function saveInstructorForms() {
    return runProtectedSaveAction('instructor-forms-save', 'instructor-save-forms-btn', async () => {
        if (!isAdminSession()) {
            showToast('Solo administradores pueden modificar formas del instructor', 'error');
            return;
        }

        const instructor = finalViewState.selectedInstructor;
        const formsState = finalViewState.instructorForms;

        if (!instructor || !formsState.loaded) {
            showToast('No hay datos de formas para guardar', 'error');
            return;
        }

        if (!formsState.selectorOpen) {
            showToast('Primero entra a Agregar/Quitar formas para guardar cambios', 'info');
            return;
        }

        const checkboxes = Array.from(document.querySelectorAll('.instructor-form-checkbox'));
        const selectedFormaIds = checkboxes
            .filter(checkbox => checkbox.checked)
            .map(checkbox => String(checkbox.dataset.instructorFormaId));

        const formsById = {};
        (formsState.forms || []).forEach(forma => {
            formsById[String(forma.id_forma)] = forma;
        });

        try {
            if (formsState.relationMode === 'direct') {
                const existingByFormaId = {};
                (formsState.links || []).forEach(link => {
                    existingByFormaId[String(link.id_forma)] = link;
                });

                const existingFormaIds = Object.keys(existingByFormaId);
                const toAdd = selectedFormaIds.filter(id => !existingFormaIds.includes(id));
                const toRemove = existingFormaIds.filter(id => !selectedFormaIds.includes(id));

                if (toAdd.length === 0 && toRemove.length === 0) {
                    showToast('No hay cambios en las formas del instructor', 'info');
                    return;
                }

                for (const formaId of toAdd) {
                    await apiCall('/api/database/tables/instructor_forma/rows', {
                        method: 'POST',
                        body: JSON.stringify({
                            id_instructor: instructor.id_instructor,
                            id_forma: Number(formaId),
                        }),
                    });
                }

                const pkFields = getPrimaryKeyFields(formsState.columns);
                for (const formaId of toRemove) {
                    const linkRow = existingByFormaId[formaId];
                    const rowId = buildCompositeRowId(linkRow, pkFields);

                    if (!rowId) {
                        throw new Error('No se pudo determinar la llave de una relacion instructor-forma');
                    }

                    await apiCall(`/api/database/tables/instructor_forma/rows/${encodeURIComponent(rowId)}`, {
                        method: 'DELETE',
                    });
                }
            } else {
                const selectedStyleIds = new Set(
                    selectedFormaIds
                        .map(formaId => formsById[formaId]?.id_estilo)
                        .filter(styleId => styleId !== undefined && styleId !== null)
                        .map(styleId => String(styleId))
                );

                const existingByStyleId = {};
                (formsState.links || []).forEach(link => {
                    existingByStyleId[String(link.id_estilo)] = link;
                });

                const existingStyleIds = Object.keys(existingByStyleId);
                const selectedStyleIdsList = Array.from(selectedStyleIds);
                const toAdd = selectedStyleIdsList.filter(id => !existingStyleIds.includes(id));
                const toRemove = existingStyleIds.filter(id => !selectedStyleIdsList.includes(id));

                if (toAdd.length === 0 && toRemove.length === 0) {
                    showToast('No hay cambios en las formas del instructor', 'info');
                    return;
                }

                for (const styleId of toAdd) {
                    await apiCall('/api/database/tables/instructor_estilo/rows', {
                        method: 'POST',
                        body: JSON.stringify({
                            id_instructor: instructor.id_instructor,
                            id_estilo: Number(styleId),
                        }),
                    });
                }

                const pkFields = getPrimaryKeyFields(formsState.columns);
                for (const styleId of toRemove) {
                    const linkRow = existingByStyleId[styleId];
                    const rowId = buildCompositeRowId(linkRow, pkFields);

                    if (!rowId) {
                        throw new Error('No se pudo determinar la llave de una relacion instructor-estilo');
                    }

                    await apiCall(`/api/database/tables/instructor_estilo/rows/${encodeURIComponent(rowId)}`, {
                        method: 'DELETE',
                    });
                }
            }

            showToast('Formas del instructor actualizadas', 'success');
            finalViewState.instructorForms.loaded = false;
            finalViewState.instructorForms.selectorOpen = false;
            await loadInstructorFormsPanel();
            switchInstructorProfilePanel('forms');
            await loadFinalTabData('instructores');
        } catch (error) {
            console.error('Error actualizando formas de instructor:', error);
            showToast(`Error al actualizar formas: ${error.message || 'Intenta nuevamente'}`, 'error');
        }
    });
}

async function loadInstructorCoursesPanel() {
    const loading = document.getElementById('instructor-courses-loading');
    const listContainer = document.getElementById('instructor-courses-list');
    const instructor = finalViewState.selectedInstructor;

    if (!listContainer || !instructor) return;
    if (finalViewState.instructorCourses.loaded) return;

    try {
        loading.style.display = 'flex';
        listContainer.innerHTML = '';

        const [coursesRows, scheduledRows, scheduledColumns] = await Promise.all([
            apiCall('/api/database/tables/cursos/rows?limit=2000'),
            apiCall('/api/database/tables/cursos_agendados/rows?limit=6000'),
            apiCall('/api/database/tables/cursos_agendados/columns'),
        ]);

        finalViewState.instructorCourses = {
            courses: coursesRows || [],
            links: (scheduledRows || []).filter(link => String(link.id_instructor) === String(instructor.id_instructor)),
            columns: scheduledColumns || [],
            loaded: true,
            selectorOpen: false,
            sortKey: finalViewState.instructorCourses.sortKey || finalViewState.sortPreferences.instructorCourses.sortKey,
            sortDirection: finalViewState.instructorCourses.sortDirection || finalViewState.sortPreferences.instructorCourses.sortDirection,
        };

        renderInstructorCoursesList();
    } catch (error) {
        listContainer.innerHTML = '<p class="text-muted">No se pudieron cargar los cursos del instructor.</p>';
        showToast('No se pudieron cargar los cursos del instructor', 'error');
    } finally {
        loading.style.display = 'none';
    }
}

function buildInstructorCourseAssignments(coursesState) {
    const linksByCourseId = {};
    (coursesState.links || []).forEach(link => {
        const key = String(link.id_curso);
        if (!linksByCourseId[key]) {
            linksByCourseId[key] = [];
        }
        linksByCourseId[key].push(link);
    });

    return (coursesState.courses || []).map(course => {
        const courseId = String(course.id_curso);
        const links = linksByCourseId[courseId] || [];
        const referenceLink = links[0] || null;
        return {
            id_curso: course.id_curso,
            nombre: course.nombre || `Curso ${course.id_curso}`,
            tema: course.tema || '',
            assigned: links.length > 0,
            links,
            fecha_hora: referenceLink?.fecha_hora ? String(referenceLink.fecha_hora).slice(0, 16) : '',
        };
    });
}

function renderInstructorCoursesList() {
    const listContainer = document.getElementById('instructor-courses-list');
    const coursesState = finalViewState.instructorCourses;

    if (!listContainer) return;

    if (!coursesState.courses || coursesState.courses.length === 0) {
        listContainer.innerHTML = '<p class="text-muted">No hay cursos disponibles.</p>';
        return;
    }

    const assignments = buildInstructorCourseAssignments(coursesState).filter(item => item.assigned);
    const sortKey = coursesState.sortKey || 'name';
    const sortDirection = coursesState.sortDirection || 'asc';

    const sortedAssignments = sortListByDirection(assignments, sortDirection, assignment => {
        if (sortKey === 'date') return assignment.fecha_hora || '9999-12-31T23:59';
        return assignment.nombre;
    });

    const nameLabel = `Curso${sortKey === 'name' ? getSortIndicator(sortDirection) : ''}`;
    const dateLabel = `Fecha${sortKey === 'date' ? getSortIndicator(sortDirection) : ''}`;

    listContainer.innerHTML = `
        <div class="grade-students-summary">
            Cursos asignados: <strong>${assignments.length}</strong> de ${coursesState.courses.length}
        </div>
        <div class="list-sort-bar" id="instructor-courses-sort-bar">
            <button type="button" class="list-sort-btn" data-instructor-courses-sort="name">${nameLabel}</button>
            <button type="button" class="list-sort-btn" data-instructor-courses-sort="date">${dateLabel}</button>
        </div>
        <div class="grade-known-forms">
            ${sortedAssignments.length === 0
                ? '<p class="text-muted">Este instructor aun no tiene cursos asignados.</p>'
                : sortedAssignments.map(item => {
                    const dateText = item.fecha_hora ? item.fecha_hora.replace('T', ' ') : 'Sin fecha';
                    const labelText = item.tema ? `${item.nombre} · ${item.tema}` : item.nombre;
                    return `
                        <div class="grade-known-form-item">
                            <span class="grade-known-form-name">${labelText}</span>
                            <span class="grade-known-form-extra">${dateText}</span>
                        </div>
                    `;
                }).join('')
            }
        </div>
        <div id="instructor-courses-selector-container" style="display: none;"></div>
    `;

    listContainer.querySelectorAll('[data-instructor-courses-sort]').forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedKey = btn.dataset.instructorCoursesSort;
            if (!selectedKey) return;

            const isSameKey = finalViewState.instructorCourses.sortKey === selectedKey;
            finalViewState.instructorCourses.sortDirection = isSameKey && finalViewState.instructorCourses.sortDirection === 'asc' ? 'desc' : 'asc';
            finalViewState.instructorCourses.sortKey = selectedKey;
            updateListSortPreference('instructorCourses', finalViewState.instructorCourses.sortKey, finalViewState.instructorCourses.sortDirection);
            renderInstructorCoursesList();
        });
    });

    if (coursesState.selectorOpen) {
        renderInstructorCoursesSelector();
    }
}

function renderInstructorCoursesSelector() {
    const selectorContainer = document.getElementById('instructor-courses-selector-container');
    const coursesState = finalViewState.instructorCourses;

    if (!selectorContainer) return;

    const assignments = buildInstructorCourseAssignments(coursesState);
    const assignmentsByCourseId = {};
    assignments.forEach(item => {
        assignmentsByCourseId[String(item.id_curso)] = item;
    });

    const sortKey = coursesState.sortKey || 'name';
    const sortDirection = coursesState.sortDirection || 'asc';
    const sortedCourses = sortListByDirection(coursesState.courses || [], sortDirection, course => {
        if (sortKey === 'date') {
            const assignment = assignmentsByCourseId[String(course.id_curso)];
            return assignment?.fecha_hora || '9999-12-31T23:59';
        }
        return course.nombre || course.id_curso;
    });

    selectorContainer.style.display = 'block';
    selectorContainer.innerHTML = `
        <div class="student-forms-selector-title">Selecciona los cursos que puede impartir el instructor</div>
        <div class="student-forms-grid">
            ${sortedCourses.map(course => {
                const courseId = String(course.id_curso);
                const assignment = assignmentsByCourseId[courseId];
                const checked = assignment?.assigned ? 'checked' : '';
                const courseName = course.nombre || `Curso ${course.id_curso}`;
                const dateValue = assignment?.fecha_hora || '';

                return `
                    <label class="student-form-item student-form-item-checkbox-only">
                        <div class="student-form-main">
                            <input type="checkbox" class="instructor-course-checkbox" data-instructor-course-id="${courseId}" ${checked}>
                            <span class="student-form-name">${courseName}</span>
                        </div>
                        <input type="datetime-local" class="student-form-date" data-instructor-course-datetime="${courseId}" value="${dateValue}" title="Fecha y hora (opcional)">
                    </label>
                `;
            }).join('')}
        </div>
        <p class="text-muted">La fecha y hora es opcional; si la dejas vacia se usara la fecha y hora actual.</p>
    `;
}

function openInstructorCoursesSelector() {
    finalViewState.instructorCourses.selectorOpen = true;
    renderInstructorCoursesList();
    switchInstructorProfilePanel('courses');
}

function cancelInstructorCoursesSelection() {
    finalViewState.instructorCourses.selectorOpen = false;
    renderInstructorCoursesList();
    switchInstructorProfilePanel('courses');
}

async function saveInstructorCourses() {
    return runProtectedSaveAction('instructor-courses-save', 'instructor-save-courses-btn', async () => {
        if (!isAdminSession()) {
            showToast('Solo administradores pueden modificar cursos del instructor', 'error');
            return;
        }

        const instructor = finalViewState.selectedInstructor;
        const coursesState = finalViewState.instructorCourses;

        if (!instructor || !coursesState.loaded) {
            showToast('No hay datos de cursos para guardar', 'error');
            return;
        }

        if (!coursesState.selectorOpen) {
            showToast('Primero entra a Agregar/Quitar cursos para guardar cambios', 'info');
            return;
        }

        const checkboxes = Array.from(document.querySelectorAll('.instructor-course-checkbox'));
        const selectedCourseIds = checkboxes
            .filter(checkbox => checkbox.checked)
            .map(checkbox => String(checkbox.dataset.instructorCourseId));

        const linksByCourseId = {};
        (coursesState.links || []).forEach(link => {
            const key = String(link.id_curso);
            if (!linksByCourseId[key]) {
                linksByCourseId[key] = [];
            }
            linksByCourseId[key].push(link);
        });

        const existingCourseIds = Object.keys(linksByCourseId);
        const toAdd = selectedCourseIds.filter(id => !existingCourseIds.includes(id));
        const toRemove = existingCourseIds.filter(id => !selectedCourseIds.includes(id));

        if (toAdd.length === 0 && toRemove.length === 0) {
            showToast('No hay cambios en los cursos del instructor', 'info');
            return;
        }

        try {
            for (const courseId of toAdd) {
                const dateInput = document.querySelector(`[data-instructor-course-datetime="${courseId}"]`);
                const fechaHora = dateInput?.value?.trim() || getCurrentDateTimeInputValue();

                await apiCall('/api/database/tables/cursos_agendados/rows', {
                    method: 'POST',
                    body: JSON.stringify({
                        id_curso: Number(courseId),
                        id_instructor: instructor.id_instructor,
                        fecha_hora: fechaHora,
                        activo: true,
                    }),
                });
            }

            const pkFields = getPrimaryKeyFields(coursesState.columns);
            for (const courseId of toRemove) {
                const links = linksByCourseId[courseId] || [];
                for (const linkRow of links) {
                    const rowId = buildCompositeRowId(linkRow, pkFields);

                    if (!rowId) {
                        throw new Error('No se pudo determinar la llave de un curso asignado');
                    }

                    await apiCall(`/api/database/tables/cursos_agendados/rows/${encodeURIComponent(rowId)}`, {
                        method: 'DELETE',
                    });
                }
            }

            showToast('Cursos del instructor actualizados', 'success');
            finalViewState.instructorCourses.loaded = false;
            finalViewState.instructorCourses.selectorOpen = false;
            await loadInstructorCoursesPanel();
            switchInstructorProfilePanel('courses');
            await loadFinalTabData('instructores');
        } catch (error) {
            console.error('Error actualizando cursos de instructor:', error);
            showToast(`Error al actualizar cursos: ${error.message || 'Intenta nuevamente'}`, 'error');
        }
    });
}

function setupInstructorProfileEventListeners() {
    const modal = document.getElementById('instructor-profile-modal');
    const closeBtn = document.getElementById('instructor-profile-close-btn');
    const closeFooterBtn = document.getElementById('instructor-close-btn');
    const editBtn = document.getElementById('instructor-edit-btn');
    const manageFormsBtn = document.getElementById('instructor-manage-forms-btn');
    const saveFormsBtn = document.getElementById('instructor-save-forms-btn');
    const cancelFormsBtn = document.getElementById('instructor-cancel-forms-btn');
    const manageCoursesBtn = document.getElementById('instructor-manage-courses-btn');
    const saveCoursesBtn = document.getElementById('instructor-save-courses-btn');
    const cancelCoursesBtn = document.getElementById('instructor-cancel-courses-btn');
    const menuInfoBtn = document.getElementById('instructor-menu-info');
    const menuFormsBtn = document.getElementById('instructor-menu-forms');
    const menuCoursesBtn = document.getElementById('instructor-menu-courses');

    if (!modal) return;

    if (closeBtn) {
        closeBtn.addEventListener('click', closeInstructorProfileModal);
    }

    if (closeFooterBtn) {
        closeFooterBtn.addEventListener('click', closeInstructorProfileModal);
    }

    modal.addEventListener('click', (e) => {
        if (e.target.id === 'instructor-profile-modal') {
            closeInstructorProfileModal();
        }
    });

    if (menuInfoBtn) {
        menuInfoBtn.addEventListener('click', () => {
            switchInstructorProfilePanel('info');
        });
    }

    if (menuFormsBtn) {
        menuFormsBtn.addEventListener('click', async () => {
            switchInstructorProfilePanel('forms');
            await loadInstructorFormsPanel();
        });
    }

    if (menuCoursesBtn) {
        menuCoursesBtn.addEventListener('click', async () => {
            switchInstructorProfilePanel('courses');
            await loadInstructorCoursesPanel();
        });
    }

    if (manageFormsBtn) {
        manageFormsBtn.addEventListener('click', async () => {
            if (!isAdminSession()) {
                showToast('Solo administradores pueden modificar formas de instructor', 'error');
                return;
            }
            switchInstructorProfilePanel('forms');
            await loadInstructorFormsPanel();
            openInstructorFormsSelector();
        });
    }

    if (saveFormsBtn) {
        saveFormsBtn.addEventListener('click', saveInstructorForms);
    }

    if (cancelFormsBtn) {
        cancelFormsBtn.addEventListener('click', cancelInstructorFormsSelection);
    }

    if (manageCoursesBtn) {
        manageCoursesBtn.addEventListener('click', async () => {
            if (!isAdminSession()) {
                showToast('Solo administradores pueden modificar cursos de instructor', 'error');
                return;
            }
            switchInstructorProfilePanel('courses');
            await loadInstructorCoursesPanel();
            openInstructorCoursesSelector();
        });
    }

    if (saveCoursesBtn) {
        saveCoursesBtn.addEventListener('click', saveInstructorCourses);
    }

    if (cancelCoursesBtn) {
        cancelCoursesBtn.addEventListener('click', cancelInstructorCoursesSelection);
    }

    if (editBtn) {
        editBtn.addEventListener('click', async () => {
            if (!isAdminSession()) {
                showToast('Solo administradores pueden editar instructores', 'error');
                return;
            }

            const instructor = finalViewState.selectedInstructor;
            if (!instructor) {
                showToast('No hay instructor seleccionado', 'error');
                return;
            }

            closeInstructorProfileModal();
            await openFinalEditDialog('instructores', instructor);
        });
    }
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
    if (!isAdminSession()) {
        showToast('Solo administradores pueden eliminar registros', 'error');
        return;
    }

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
            const normalizedColumnName = String(col.name || '').toLowerCase();
            const isPasswordField = normalizedColumnName.includes('password') || normalizedColumnName.includes('contrasena') || normalizedColumnName.includes('clave');
            const inputType = isPasswordField ? 'password' : 'text';
            return `
                <div class="form-group">
                    <label for="field-${col.name}">${col.name}${requiredLabel}</label>
                    <input type="${inputType}" id="field-${col.name}" class="form-input" data-column="${col.name}" value="${value}" ${requiredAttr}>
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

    if (finalViewState.currentTable === 'instructores' && !finalViewState.editingMode) {
        form.insertAdjacentHTML('beforeend', `
            <div class="form-group" style="margin-top: 8px;">
                <small class="text-muted">Si el instructor no está vinculado a un alumno, debe capturarse correo_electronico y password_hash para que pueda iniciar sesión.</small>
            </div>
        `);
    }

    if (finalViewState.currentTable === 'alumnos' && !finalViewState.editingMode) {
        form.insertAdjacentHTML('beforeend', `
            <div class="form-group" style="margin-top: 8px; padding-top: 12px; border-top: 1px dashed var(--gray-300);">
                <label class="checkbox-label" for="create-instructor-from-student">
                    <input type="checkbox" id="create-instructor-from-student" class="form-checkbox">
                    Registrar también como instructor
                </label>
                <small class="text-muted">Activa esta opción para capturar datos adicionales del instructor.</small>
            </div>
            <div id="instructor-from-student-section" style="display: none; border: 1px solid var(--gray-200); border-radius: 10px; padding: 12px; background: #fafafa;">
                <div class="form-group">
                    <div id="instructor-name-manual-group">
                        <label for="instructor-field-nombre">Nombre de instructor <span class="required-indicator">*</span></label>
                        <input type="text" id="instructor-field-nombre" class="form-input" placeholder="Nombre para el perfil de instructor">
                    </div>
                    <small id="instructor-name-sync-hint" class="text-muted" style="display: none;">Se usara automaticamente el nombre del alumno.</small>
                    <label class="checkbox-label" for="instructor-name-sync" style="margin-top: 8px;">
                        <input type="checkbox" id="instructor-name-sync" class="form-checkbox" checked>
                        Usar el mismo nombre del alumno
                    </label>
                </div>
                <div class="form-group">
                    <label for="instructor-field-especialidad">Especialidad</label>
                    <input type="text" id="instructor-field-especialidad" class="form-input" placeholder="Ej. Ving Tsun, combate, niños...">
                </div>
                <div class="form-group">
                    <label for="instructor-field-fecha_contratacion">Fecha de contratación</label>
                    <input type="date" id="instructor-field-fecha_contratacion" class="form-input">
                </div>
                <div class="form-group">
                    <label class="checkbox-label" for="instructor-field-activo">
                        <input type="checkbox" id="instructor-field-activo" class="form-checkbox" checked>
                        Instructor activo
                    </label>
                </div>
            </div>
        `);

        const createInstructorCheckbox = document.getElementById('create-instructor-from-student');
        const instructorSection = document.getElementById('instructor-from-student-section');
        const studentNameInput = document.getElementById('field-nombre');
        const instructorNameInput = document.getElementById('instructor-field-nombre');
        const instructorNameSyncCheckbox = document.getElementById('instructor-name-sync');
        const instructorNameManualGroup = document.getElementById('instructor-name-manual-group');
        const instructorNameSyncHint = document.getElementById('instructor-name-sync-hint');

        const syncInstructorNameState = () => {
            if (!instructorNameInput || !instructorNameSyncCheckbox) {
                return;
            }

            const shouldSync = instructorNameSyncCheckbox.checked;
            instructorNameInput.disabled = shouldSync;

            if (instructorNameManualGroup) {
                instructorNameManualGroup.style.display = shouldSync ? 'none' : 'block';
            }

            if (instructorNameSyncHint) {
                instructorNameSyncHint.style.display = shouldSync ? 'block' : 'none';
            }

            if (shouldSync && studentNameInput) {
                instructorNameInput.value = studentNameInput.value || '';
            }
        };

        if (studentNameInput && instructorNameInput && !instructorNameInput.value.trim()) {
            instructorNameInput.value = studentNameInput.value || '';
        }

        if (studentNameInput && instructorNameInput) {
            studentNameInput.addEventListener('input', () => {
                if (instructorNameSyncCheckbox && instructorNameSyncCheckbox.checked) {
                    instructorNameInput.value = studentNameInput.value || '';
                } else if (!instructorNameInput.value.trim()) {
                    instructorNameInput.value = studentNameInput.value || '';
                }
            });
        }

        if (instructorNameSyncCheckbox) {
            instructorNameSyncCheckbox.addEventListener('change', syncInstructorNameState);
            syncInstructorNameState();
        }

        if (createInstructorCheckbox && instructorSection) {
            createInstructorCheckbox.addEventListener('change', () => {
                instructorSection.style.display = createInstructorCheckbox.checked ? 'block' : 'none';
                if (createInstructorCheckbox.checked) {
                    syncInstructorNameState();
                    if (instructorNameInput && !instructorNameInput.value.trim() && studentNameInput) {
                        instructorNameInput.value = studentNameInput.value || '';
                    }
                }
            });
        }
    }
}

function closeFinalAddDialog() {
    const modal = document.getElementById('final-add-modal');
    modal.style.display = 'none';
    document.getElementById('final-add-form').innerHTML = '';
    finalViewState.currentTable = null;
    finalViewState.editingMode = false;
    finalViewState.editingRowId = null;
}

async function resolveCreatedAlumnoId(createdRow, alumnoPayload) {
    if (createdRow?.id_alumno !== undefined && createdRow?.id_alumno !== null) {
        return Number(createdRow.id_alumno);
    }

    if (createdRow?.id !== undefined && createdRow?.id !== null) {
        return Number(createdRow.id);
    }

    const numeroMatricula = alumnoPayload?.numero_matricula;
    const correo = alumnoPayload?.correo_electronico;
    const alumnos = await apiCall('/api/database/tables/alumnos/rows?limit=5000');
    const found = (alumnos || []).find(row => {
        if (numeroMatricula && String(row.numero_matricula) === String(numeroMatricula)) {
            return true;
        }
        if (correo && row.correo_electronico && String(row.correo_electronico) === String(correo)) {
            return true;
        }
        return false;
    });

    if (!found || found.id_alumno === undefined || found.id_alumno === null) {
        throw new Error('No se pudo determinar el ID del alumno recién creado');
    }

    return Number(found.id_alumno);
}

function getInstructorPayloadFromAddStudentForm(alumnoPayload) {
    const createInstructorCheckbox = document.getElementById('create-instructor-from-student');
    if (!createInstructorCheckbox || !createInstructorCheckbox.checked) {
        return null;
    }

    const nombreInput = document.getElementById('instructor-field-nombre');
    const especialidadInput = document.getElementById('instructor-field-especialidad');
    const fechaContratacionInput = document.getElementById('instructor-field-fecha_contratacion');
    const activoInput = document.getElementById('instructor-field-activo');

    const nombreInstructor = nombreInput?.value?.trim() || alumnoPayload?.nombre || '';
    if (!nombreInstructor) {
        throw new Error('El nombre del instructor es obligatorio');
    }

    return {
        nombre: nombreInstructor,
        especialidad: especialidadInput?.value?.trim() || null,
        correo_electronico: alumnoPayload?.correo_electronico || null,
        fecha_contratacion: fechaContratacionInput?.value?.trim() || null,
        activo: activoInput ? Boolean(activoInput.checked) : true,
    };
}

async function validateStandaloneInstructorCredentials(payload) {
    if (!payload) {
        return;
    }

    const instructorId = payload.id_instructor;
    const email = String(payload.correo_electronico || '').trim();
    const password = String(payload.password_hash || '').trim();

    const alumnos = await apiCall('/api/database/tables/alumnos/rows?limit=5000');
    const linkedById = Number.isFinite(Number(instructorId))
        ? (alumnos || []).some(row => Number(row.id_alumno) === Number(instructorId))
        : false;
    const linkedByEmail = email
        ? (alumnos || []).some(row => String(row.correo_electronico || '').trim().toLowerCase() === email.toLowerCase())
        : false;

    const isStandaloneInstructor = !linkedById && !linkedByEmail;
    if (!isStandaloneInstructor) {
        return;
    }

    if (!email) {
        throw new Error('El instructor que no es alumno debe tener correo_electronico para iniciar sesión');
    }

    if (!password) {
        throw new Error('El instructor que no es alumno debe tener contraseña');
    }

    if (password.length <= 6) {
        throw new Error('La contraseña del instructor debe tener más de 6 caracteres');
    }
}

async function saveFinalAddForm() {
    return runProtectedSaveAction('final-add-save', 'final-add-save-btn', async () => {
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

        let instructorPayload = null;
        if (tableName === 'alumnos' && !finalViewState.editingMode) {
            instructorPayload = getInstructorPayloadFromAddStudentForm(rowData);
        }

        if (tableName === 'instructores') {
            await validateStandaloneInstructorCredentials(rowData);
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

                if (tableName === 'alumnos' && instructorPayload) {
                    const alumnoId = await resolveCreatedAlumnoId(response, rowData);
                    const instructorBody = {
                        id_instructor: alumnoId,
                        nombre: instructorPayload.nombre,
                        correo_electronico: instructorPayload.correo_electronico,
                        fecha_contratacion: instructorPayload.fecha_contratacion,
                        activo: instructorPayload.activo,
                        especialidad: instructorPayload.especialidad,
                    };

                    await apiCall('/api/database/tables/instructores/rows', {
                        method: 'POST',
                        body: JSON.stringify(instructorBody)
                    });
                    successMsg += ' e instructor vinculado';
                }
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
    });
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
    runProtectedSaveAction('settings-save', 'save-settings-btn', async () => {
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
    });
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
