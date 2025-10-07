// ===== APPLICATION PRINCIPALE =====

// Variables globales
window.currentUser = null;
window.selectedFile = null;
let mainRefreshInterval = null;
let currentPage = null;

// Navigation entre les pages
function switchPage(pageName) {
    const navBtns = document.querySelectorAll('.nav-btn');
    const pageContents = document.querySelectorAll('.page-content');
    
    // Mettre à jour les boutons de navigation
    navBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page === pageName) {
            btn.classList.add('active');
        }
    });
    
    // Afficher la page correspondante
    pageContents.forEach(page => {
        page.classList.remove('active');
        if (page.id === `${pageName}Page`) {
            page.classList.add('active');
        }
    });

    // Mettre à jour la page courante
    currentPage = pageName;

    // Charger les données spécifiques à la page
    if (pageName === 'dashboard') {
        // Vérifier si les données du dashboard sont déjà chargées
        const currentScheduleCard = document.getElementById('currentScheduleCard');
        const dailyStatsCard = document.getElementById('dailyStatsCard');
        
        const needsLoading = !currentScheduleCard || 
                           currentScheduleCard.innerHTML.includes('Chargement') ||
                           currentScheduleCard.innerHTML.includes('Aucun élève importé');
        
        if (needsLoading) {
            console.log('🔄 Rechargement des données du dashboard...');
            loadDashboardData();
        } else {
            console.log('✅ Les données du dashboard sont déjà chargées');
        }
    } else if (pageName === 'students') {
        loadStudents();
    } else if (pageName === 'attendance') {
        loadAttendances();
        loadSchedulesForFilter();
    } else if (pageName === 'admin') {
        loadSchedulesList();
        loadUsers();
    }
    
    // Démarrer le rafraîchissement automatique pour cette page
    startMainAutoRefresh();
}

// Configuration des événements
function setupEventListeners() {
    // Éléments DOM
    const elements = {
        loginForm: document.getElementById('loginForm'),
        logoutBtn: document.getElementById('logoutBtn'),
        navBtns: document.querySelectorAll('.nav-btn'),
        csvFileInput: document.getElementById('csvFileInput'),
        downloadTemplateBtn: document.getElementById('downloadTemplateBtn'),
        downloadTemplateBtn2: document.getElementById('downloadTemplateBtn2'),
        studentSearch: document.getElementById('studentSearch'),
        studentClassFilter: document.getElementById('studentClassFilter'),
        studentGroupFilter: document.getElementById('studentGroupFilter'),
        studentSort: document.getElementById('studentSort'),
        applyFiltersBtn: document.getElementById('applyFiltersBtn')
    };
    
    // Connexion
    if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', handleLogin);
    }
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Navigation
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.dataset.page));
    });
    
    // Import CSV
    if (elements.csvFileInput) {
        elements.csvFileInput.addEventListener('change', handleFileSelect);
    }
    if (elements.downloadTemplateBtn) {
        elements.downloadTemplateBtn.addEventListener('click', downloadTemplate);
    }
    if (elements.downloadTemplateBtn2) {
        elements.downloadTemplateBtn2.addEventListener('click', downloadTemplate);
    }
    
    // Filtres et tri
    if (elements.studentSearch) {
        elements.studentSearch.addEventListener('input', applyFiltersAndSort);
    }
    if (elements.studentClassFilter) {
        elements.studentClassFilter.addEventListener('change', applyFiltersAndSort);
    }
    if (elements.studentGroupFilter) {
        elements.studentGroupFilter.addEventListener('change', applyFiltersAndSort);
    }
    if (elements.studentSort) {
        elements.studentSort.addEventListener('change', applyFiltersAndSort);
    }
    if (elements.applyFiltersBtn) {
        elements.applyFiltersBtn.addEventListener('click', applyFiltersAndSort);
    }
}

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initialisation de l\'application PERMAPPEL');
    
    // Détecter l'environnement de connexion
    if (typeof detectConnectionEnvironment === 'function') {
        detectConnectionEnvironment();
    }
    
    // Configuration des événements
    setupEventListeners();
    
    // Configuration des modales
    setupModalHandlers();
    
    // Vérifier l'authentification
    checkAuthStatus();
    
    // Initialiser les gestionnaires de formulaires
    initStudentFormHandlers();
    initAttendanceHandlers();
    initScheduleFormHandler();
    initUserFormHandler();
    initGroupsManagement();
    
    console.log('✅ Application initialisée avec succès');
});

// ===== RAFRAÎCHISSEMENT AUTOMATIQUE =====

// Démarrer le rafraîchissement automatique de l'interface principale
function startMainAutoRefresh() {
    // Arrêter l'intervalle précédent s'il existe
    if (mainRefreshInterval) {
        clearInterval(mainRefreshInterval);
    }
    
    // Démarrer le rafraîchissement toutes les minutes
    mainRefreshInterval = setInterval(() => {
        refreshCurrentPage();
    }, 60000);
    
    console.log(`🔄 Rafraîchissement automatique activé pour la page: ${currentPage}`);
}

// Arrêter le rafraîchissement automatique
function stopMainAutoRefresh() {
    if (mainRefreshInterval) {
        clearInterval(mainRefreshInterval);
        mainRefreshInterval = null;
        console.log('⏹️ Rafraîchissement automatique arrêté');
    }
}

// Rafraîchir la page courante
function refreshCurrentPage() {
    if (!currentPage) return;
    
    console.log(`🔄 Rafraîchissement automatique de la page: ${currentPage}`);
    
    // Afficher un indicateur visuel de rafraîchissement
    showRefreshIndicator();
    
    try {
        switch (currentPage) {
            case 'dashboard':
                refreshDashboard();
                break;
            case 'attendance':
                refreshAttendance();
                break;
            case 'students':
                refreshStudents();
                break;
            case 'admin':
                refreshAdmin();
                break;
            default:
                console.log(`⚠️ Page non gérée pour le rafraîchissement: ${currentPage}`);
        }
    } catch (error) {
        console.error('❌ Erreur lors du rafraîchissement automatique:', error);
    }
}

// Afficher un indicateur visuel de rafraîchissement
function showRefreshIndicator() {
    // Créer ou mettre à jour l'indicateur de rafraîchissement
    let indicator = document.getElementById('autoRefreshIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'autoRefreshIndicator';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 123, 255, 0.9);
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        indicator.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Actualisation...';
        document.body.appendChild(indicator);
    }
    
    // Afficher l'indicateur
    indicator.style.opacity = '1';
    
    // Masquer l'indicateur après 2 secondes
    setTimeout(() => {
        if (indicator) {
            indicator.style.opacity = '0';
        }
    }, 2000);
}

// Rafraîchir le dashboard
function refreshDashboard() {
    if (typeof loadDashboardData === 'function') {
        loadDashboardData();
    }
}

// Rafraîchir la page des appels
function refreshAttendance() {
    if (typeof loadAttendances === 'function') {
        loadAttendances();
    }
}

// Rafraîchir la page des élèves
function refreshStudents() {
    if (typeof loadStudents === 'function') {
        loadStudents();
    }
}

// Rafraîchir la page d'administration
function refreshAdmin() {
    if (typeof loadSchedulesList === 'function') {
        loadSchedulesList();
    }
    if (typeof loadUsers === 'function') {
        loadUsers();
    }
}

// Arrêter le rafraîchissement lors de la déconnexion
function stopAutoRefreshOnLogout() {
    stopMainAutoRefresh();
    currentPage = null;
}
