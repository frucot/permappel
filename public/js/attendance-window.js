// Configuration
const api = getApiUrl('');
let socket;
let currentAttendance = null;
let currentUser = null;
let isConnected = false;
let refreshInterval = null;
let connectedUsers = new Map();
let isReadOnlyMode = false;
let isSocketAuthenticated = false;
let hasJoinedCurrentAttendance = false;

// Détection du navigateur
function detectBrowser() {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Edg/')) {
        return 'edge';
    } else if (userAgent.includes('Chrome/')) {
        return 'chrome';
    } else if (userAgent.includes('Firefox/')) {
        return 'firefox';
    } else if (userAgent.includes('Safari/')) {
        return 'safari';
    }
    return 'unknown';
}

const currentBrowser = detectBrowser();
console.log('🌐 Navigateur détecté:', currentBrowser);

// Éléments DOM
const elements = {
    attendanceTitle: document.getElementById('attendanceTitle'),
    attendanceDate: document.getElementById('attendanceDate'),
    attendanceTime: document.getElementById('attendanceTime'),
    syncStatus: document.getElementById('syncStatus'),
    attendanceTableContainer: document.getElementById('attendanceTableContainer'),
    presentCount: document.getElementById('presentCount'),
    absentCount: document.getElementById('absentCount'),
    cdiCount: document.getElementById('cdiCount'),
    excusedCount: document.getElementById('excusedCount'),
    unattendedCount: document.getElementById('unattendedCount'),
    totalCount: document.getElementById('totalCount'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    errorMessage: document.getElementById('errorMessage'),
    errorText: document.getElementById('errorText'),
    userCount: document.getElementById('userCount'),
    userList: document.getElementById('userList')
};

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Initialisation de l'application
async function initializeApp() {
    const urlParams = new URLSearchParams(window.location.search);
    const attendanceId = urlParams.get('id');
    const mode = urlParams.get('mode');
    
    if (!attendanceId) {
        showError('ID de feuille d\'appel manquant');
        return;
    }
    
    // Déterminer le mode d'ouverture
    isReadOnlyMode = mode === 'readonly';
    
    if (isReadOnlyMode) {
        console.log('📖 Mode lecture seule activé');
        enableReadOnlyMode();
    }
    
    // Configuration Socket.IO avec détection automatique de l'URL
    const socketUrl = getSocketUrl();
    console.log('🔌 Connexion Socket.IO à:', socketUrl);
    socket = io(socketUrl);
    setupSocketListeners();
    
    // Charger les informations utilisateur et ensuite la feuille
    await checkAuthStatus();
    await loadAttendance(attendanceId);
    
    // Ajouter les événements pour les utilisateurs connectés et le chat
    setupConnectedUsersEvents();
    setupChatInputEvents();
    joinAttendanceIfReady();
}

// Configuration des listeners Socket.IO
function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connecté au serveur Socket.IO');
        isConnected = true;
        updateSyncStatus(true);
        
        // Authentifier le socket avec le token
        const token = localStorage.getItem('token');
        if (token) {
            console.log('🔐 Authentification Socket.IO...');
            socket.emit('authenticate', { token: token });
        } else {
            console.error('❌ Pas de token pour l\'authentification Socket.IO');
        }
    });
    
    // Gérer l'authentification réussie
    socket.on('authenticated', (data) => {
        console.log('✅ Socket.IO authentifié:', data.user);
        isSocketAuthenticated = true;
        joinAttendanceIfReady();
    });
    
    // Gérer les erreurs d'authentification
    socket.on('auth_error', (data) => {
        console.error('❌ Erreur d\'authentification Socket.IO:', data.message);
    });
    
    socket.on('disconnect', () => {
        console.log('Déconnecté du serveur');
        isConnected = false;
        isSocketAuthenticated = false;
        hasJoinedCurrentAttendance = false;
        updateSyncStatus(false);
        
        // Nettoyer la liste des utilisateurs connectés en cas de déconnexion
        connectedUsers.clear();
        updateConnectedUsersDisplay();
    });
    
    socket.on('student-status-updated', (data) => {
        if (!data.attendanceId || data.attendanceId === currentAttendance?.id) {
            updateStudentStatusFromSocket(data);
            refreshAttendanceData();
        }
    });

    socket.on('cdi-checkin-updated', (data) => {
        if (data.attendanceId === currentAttendance?.id) {
            updateStudentStatusLocal(data.studentId, 'Présent_CDI');
            updateAttendanceStats(currentAttendance);
            showNotification(`Nouvelle inscription CDI (${data.activity || 'activité non précisée'})`, 'info');
            refreshAttendanceData();
        }
    });

    socket.on('attendance-students-updated', (data) => {
        if (data.attendanceId === currentAttendance?.id) {
            console.log('🔄 Événement attendance-students-updated reçu:', data);
            refreshAttendanceData();
        }
    });
    
    socket.on('user-joined-attendance', (data) => {
        console.log('🔗 Événement user-joined-attendance reçu:', data);
        addConnectedUser(data.userId, data.userName);
        if (data.userId !== currentUser?.id) {
            showNotification(`${data.userName} a rejoint la feuille d'appel`);
        }
    });
    
    socket.on('user-left-attendance', (data) => {
        console.log('🔗 Événement user-left-attendance reçu:', data);
        removeConnectedUser(data.userId);
        if (data.userId !== currentUser?.id) {
            showNotification(`${data.userName} a quitté la feuille d'appel`);
        }
    });
    
    socket.on('attendance-users-updated', (data) => {
        console.log('🔗 Événement attendance-users-updated reçu:', data);
        // Synchroniser la liste des utilisateurs connectés
        connectedUsers.clear();
        if (data.users && Array.isArray(data.users)) {
            data.users.forEach(user => {
                connectedUsers.set(user.userId || user.id, {
                    id: user.userId || user.id,
                    name: user.userName || user.name,
                    joinedAt: user.connectedAt ? new Date(user.connectedAt) : new Date()
                });
            });
        }
        updateConnectedUsersDisplay();
        console.log(`🔗 Liste synchronisée: ${connectedUsers.size} utilisateurs connectés`);
    });
    
    // Écouter les messages de chat
    socket.on('attendance-chat-message', (data) => {
        console.log('💬 Message de chat reçu:', data);
        if (data.attendanceId === currentAttendance?.id) {
            displayChatMessage(data);
        }
    });
}

function joinAttendanceIfReady() {
    if (!socket || !isConnected || !isSocketAuthenticated || !currentAttendance || !currentUser?.id || hasJoinedCurrentAttendance) {
        return;
    }

    const userName = `${currentUser.prenom || currentUser.firstName || ''} ${currentUser.nom || currentUser.lastName || ''}`.trim() || 'Utilisateur';
    console.log('🔗 Rejoindre la feuille d\'appel:', { attendanceId: currentAttendance.id, userId: currentUser.id, userName });

    socket.emit('join-attendance', {
        attendanceId: currentAttendance.id,
        userId: currentUser.id,
        userName
    });

    // Ajout local immediat pour eviter d'attendre le broadcast serveur
    addConnectedUser(currentUser.id, userName);
    hasJoinedCurrentAttendance = true;
}

// Gérer l'envoi de message avec Enter
function setupChatInputEvents() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || chatInput.dataset.enterHandlerAttached === 'true') return;
    
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    chatInput.dataset.enterHandlerAttached = 'true';
}

// Vérifier le statut d'authentification
async function checkAuthStatus() {
    const token = localStorage.getItem('token');
    if (!token) {
        showError('Non authentifié');
        return;
    }
    
    try {
        const response = await fetch(`${api}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            localStorage.removeItem('token');
            showError('Session expirée');
            return;
        }
        
        const data = await response.json();
        currentUser = data.user;
    } catch (error) {
        console.error('Erreur de vérification d\'authentification:', error);
        showError('Erreur de connexion');
    }
}

// Charger la feuille d'appel
async function loadAttendance(attendanceId) {
    try {
        showLoading(true);
        
        const token = localStorage.getItem('token');
        
        // 1. Synchroniser automatiquement les élèves (ajouter les nouveaux et supprimer ceux qui ne correspondent plus)
        try {
            const syncResponse = await fetch(`${api}/attendance/${attendanceId}/sync-students`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (syncResponse.ok) {
                const syncData = await syncResponse.json();
                if (syncData.success) {
                    if (syncData.addedCount > 0 || syncData.removedCount > 0) {
                        console.log(`🔄 Synchronisation automatique: ${syncData.addedCount} élève(s) ajouté(s), ${syncData.removedCount} élève(s) supprimé(s)`);
                    } else {
                        console.log('🔄 Synchronisation automatique: Aucune modification nécessaire');
                    }
                }
            }
        } catch (syncError) {
            // Ne pas bloquer le chargement si la synchronisation échoue
            console.warn('⚠️ Erreur lors de la synchronisation des élèves (non bloquant):', syncError);
        }
        
        // 2. Charger la feuille d'appel avec les élèves à jour
        const response = await fetch(`${api}/attendance/${attendanceId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const previousAttendanceId = currentAttendance?.id;
        const data = await response.json();
        currentAttendance = data.attendance;
        const nextAttendanceId = currentAttendance?.id;
        if (previousAttendanceId !== nextAttendanceId) {
            hasJoinedCurrentAttendance = false;
        }
        
        displayAttendance(currentAttendance);
        showLoading(false);
        joinAttendanceIfReady();
        
        startAutoRefresh();
    } catch (error) {
        console.error('Erreur lors du chargement de la feuille d\'appel:', error);
        showError('Impossible de charger la feuille d\'appel');
        showLoading(false);
    }
}

// Afficher la feuille d'appel
function displayAttendance(attendance) {
    console.log('📊 Affichage de la feuille d\'appel:', attendance);
    
    // Vérifications défensives d'éléments DOM critiques
    if (!elements.attendanceTitle || !elements.attendanceDate || !elements.attendanceTableContainer) {
        console.error('❌ Erreur critique : Éléments DOM nécessaires introuvables');
        return;
    }
    
    elements.attendanceTitle.textContent = `Feuille d'appel - ${attendance.schedule?.name || 'N/A'}`;
    elements.attendanceDate.textContent = formatDate(attendance.date);
    
    // Les groupes et classes sont déjà des tableaux dans la réponse API
    const groupNames = Array.isArray(attendance.groups) ? attendance.groups : [];
    displayGroupsTags(groupNames);
    
    const classNames = Array.isArray(attendance.classes) ? attendance.classes : [];
    displayClassesTags(classNames);
    
    elements.attendanceTime.textContent = formatTime(attendance.schedule?.startTime || 'N/A');
    
    generateAttendanceTable(attendance);
    updateAttendanceStats(attendance);
    
    console.log(`✅ Table updated with ${attendance.students?.length || 0} students.`);
}

// Générer le tableau de présence
function generateAttendanceTable(attendance) {
    // Effacer complètement le container avant de reconstruire
    const container = elements.attendanceTableContainer;
    container.innerHTML = '';
    
    const table = document.createElement('table');
    table.className = 'attendance-table';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Classe</th>
            <th>Groupe</th>
            <th>Autorisations de sortie</th>
            <th>Statut</th>
            <th>Actions</th>
        </tr>
    `;
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    if (attendance.students && attendance.students.length > 0) {
        // Tri selon : Classe → Nom alphabétique → Prénom alphabétique
        console.log('🔄 Tri des élèves avant tri:', attendance.students.slice(0, 3).map(s => ({
            nom: s.lastName || s.nom,
            prenom: s.firstName || s.prenom,
            classe: s.class || s.classe
        })));
        
        const sortedStudents = attendance.students.sort((a, b) => {
            // 1. Par classe (utiliser la bonne propriété)
            const aClass = a.class || a.classe || '';
            const bClass = b.class || b.classe || '';
            const classComparison = aClass.localeCompare(bClass, 'fr', { numeric: true });
            if (classComparison !== 0) return classComparison;

            // 2. Par nom de famille alphabétique
            const aLastName = a.lastName || a.nom || '';
            const bLastName = b.lastName || b.nom || '';
            const lastNameComparison = aLastName.localeCompare(bLastName, 'fr', { numeric: true });
            if (lastNameComparison !== 0) return lastNameComparison;

            // 3. Par prénom alphabétique
            const aFirstName = a.firstName || a.prenom || '';
            const bFirstName = b.firstName || b.prenom || '';
            return aFirstName.localeCompare(bFirstName, 'fr', { numeric: true });
        });
        
        console.log('🔄 Tri des élèves après tri:', sortedStudents.slice(0, 3).map(s => ({
            nom: s.lastName || s.nom,
            prenom: s.firstName || s.prenom,
            classe: s.class || s.classe
        })));

        sortedStudents.forEach(studentData => {
            const student = studentData;
            const row = createStudentRow(student, attendance);
            tbody.appendChild(row);
        });
    } else {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                Aucun élève trouvé
            </td>
        `;
        tbody.appendChild(row);
    }
    
    table.appendChild(tbody);
    elements.attendanceTableContainer.appendChild(table);
    
    // Ajouter les event listeners pour les boutons de statut
    setupStatusButtonListeners();
    
    // Pour Edge : ajouter aussi une délégation d'événements au niveau du conteneur
    if (currentBrowser === 'edge') {
        setupEdgeEventDelegation();
    }
}

// Configurer les event listeners pour les boutons de statut
function setupStatusButtonListeners() {
    const statusButtons = document.querySelectorAll('.status-btn[data-student-id]');
    
    statusButtons.forEach(button => {
        // Supprimer les anciens event listeners pour éviter les doublons
        button.removeEventListener('click', handleStatusButtonClick);
        button.removeEventListener('mousedown', handleStatusButtonClick);
        button.removeEventListener('touchstart', handleStatusButtonClick);
        
        // Approche différente selon le navigateur
        if (currentBrowser === 'edge') {
            // Pour Edge : utiliser mousedown et touchstart
            button.addEventListener('mousedown', handleStatusButtonClick);
            button.addEventListener('touchstart', handleStatusButtonClick);
            button.addEventListener('click', handleStatusButtonClick);
            
            // S'assurer que le bouton est focusable et accessible
            button.setAttribute('tabindex', '0');
            button.setAttribute('role', 'button');
            button.setAttribute('aria-label', `Marquer comme ${button.getAttribute('data-status')}`);
            
            // Ajouter un style pour indiquer que c'est cliquable
            button.style.cursor = 'pointer';
            button.style.userSelect = 'none';
            
        } else {
            // Pour les autres navigateurs : approche standard
            button.addEventListener('click', handleStatusButtonClick);
        }
    });
    
    console.log(`✅ ${statusButtons.length} boutons de statut configurés pour ${currentBrowser}`);
}

// Délégation d'événements pour Edge (fallback)
function setupEdgeEventDelegation() {
    const container = elements.attendanceTableContainer;
    
    // Supprimer les anciens event listeners
    container.removeEventListener('click', handleEdgeEventDelegation);
    container.removeEventListener('mousedown', handleEdgeEventDelegation);
    
    // Ajouter les nouveaux event listeners
    container.addEventListener('click', handleEdgeEventDelegation, true);
    container.addEventListener('mousedown', handleEdgeEventDelegation, true);
    
    console.log('🔧 Délégation d\'événements Edge configurée');
}

// Gestionnaire de délégation d'événements pour Edge
function handleEdgeEventDelegation(e) {
    const target = e.target;
    
    // Vérifier si c'est un bouton de statut
    if (target.classList.contains('status-btn') && target.hasAttribute('data-student-id')) {
        console.log('🔧 Délégation Edge : bouton de statut détecté');
        handleStatusButtonClick(e);
    }
}

// Gestionnaire d'événement séparé pour les boutons de statut
function handleStatusButtonClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const button = e.currentTarget || e.target;
    const studentId = button.getAttribute('data-student-id');
    const status = button.getAttribute('data-status');
    
    console.log('🔄 Clic sur bouton de statut:', { studentId, status, button });
    
    if (studentId && status) {
        // Désactiver temporairement le bouton pour éviter les clics multiples
        button.disabled = true;
        button.style.opacity = '0.6';
        
        updateStudentStatus(studentId, status).finally(() => {
            // Réactiver le bouton après un délai
            setTimeout(() => {
                button.disabled = false;
                button.style.opacity = '1';
            }, 1000);
        });
    } else {
        console.error('❌ Données manquantes pour le bouton de statut:', { studentId, status });
    }
}

// Créer une ligne d'élève
function createStudentRow(student, attendance) {
    const row = document.createElement('tr');
    row.className = 'student-row';
    row.dataset.studentId = student._id || student.id;
    
    const status = student.status || 'NON_APPELE';
    const studentClass = student.class || student.classe || '';
    
    // Pour l'affichage du tableau, montrer seulement les groupes ajoutés à la feuille d'appel
    // au lieu de tous les groupes de l'élève  
    const attendanceGroups = attendance?.groups || [];
    const studentGroups = student.groups || [];
    
    // Si des groupes ont été spécifiquement ajoutés à la feuille d'appel, 
    // ne montrer que les groupes de l'élève qui correspondent à ceux ajoutés
    let displayedGroups = [];
    if (Array.isArray(attendanceGroups) && attendanceGroups.length > 0 && Array.isArray(studentGroups)) {
        displayedGroups = studentGroups.filter(group => attendanceGroups.includes(group));
    } else if (Array.isArray(studentGroups)) {
        // Pas de groupes spécifiés pour l'attendance, afficher tous les groupes de l'élève
        displayedGroups = studentGroups;
    }
    
    const groupNames = displayedGroups.length > 0 
        ? displayedGroups.join(', ')
        : '';
    
    row.innerHTML = `
        <td>${student.lastName || student.nom || ''}</td>
        <td>${student.firstName || student.prenom || ''}</td>
        <td>${studentClass}</td>
        <td>${groupNames}</td>
        <td>${student.exitPermissions || student.autorisationSortie || 'ND'}</td>
        <td>
            <span class="status-badge status-${status.toLowerCase().replace('_', '-')}">
                ${getStatusLabel(status)}
            </span>
        </td>
        <td>
            <div class="status-buttons">
                ${isReadOnlyMode ? `
                    <div class="readonly-status">
                        <i class="fas fa-lock"></i>
                        <span>Lecture seule</span>
                    </div>
                ` : `
                    <button class="status-btn present ${status === 'Présent' ? 'active' : ''}" 
                            data-student-id="${student._id || student.id}" 
                            data-status="Présent">
                        Présent
                    </button>
                    <button class="status-btn absent ${status === 'Absent' ? 'active' : ''}" 
                            data-student-id="${student._id || student.id}" 
                            data-status="Absent">
                        Absent
                    </button>
                    <button class="status-btn cdi ${status === 'Présent_CDI' ? 'active' : ''}" 
                            data-student-id="${student._id || student.id}" 
                            data-status="Présent_CDI">
                        CDI
                    </button>
                    <button class="status-btn excused ${status === 'Absence_prévue' ? 'active' : ''}" 
                            data-student-id="${student._id || student.id}" 
                            data-status="Absence_prévue">
                        Excusé
                    </button>
                `}
            </div>
        </td>
    `;
    
    return row;
}

// Mettre à jour le statut d'un élève
async function updateStudentStatus(studentId, status) {
    console.log('🔄 updateStudentStatus appelée:', { studentId, status, isReadOnlyMode, hasCurrentAttendance: !!currentAttendance, hasCurrentUser: !!currentUser });
    
    if (isReadOnlyMode) {
        showNotification('Mode lecture seule - Les modifications ne sont pas autorisées');
        return;
    }
    
    if (!currentAttendance || !currentUser) {
        console.error('❌ Données manquantes:', { currentAttendance: !!currentAttendance, currentUser: !!currentUser });
        showError('Données manquantes');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${api}/attendance/${currentAttendance.id}/student/${studentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: status })
        });
        
        if (response.ok) {
            updateStudentStatusLocal(studentId, status);
            updateAttendanceStats(currentAttendance);
            
            if (isConnected) {
                socket.emit('update-student-status', {
                    attendanceId: currentAttendance.id,
                    studentId: studentId,
                    status: status,
                    userId: currentUser.id,
                    userName: `${currentUser.prenom} ${currentUser.nom}`
                });
            }
            
            setTimeout(() => {
                refreshAttendanceData();
            }, 1000);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la mise à jour');
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour du statut:', error);
        showError('Impossible de mettre à jour le statut');
    }
}

// Mettre à jour le statut localement
function updateStudentStatusLocal(studentId, status) {
    if (!currentAttendance || !currentAttendance.students) return;
    
    const studentData = currentAttendance.students.find(s => (s._id || s.id) == studentId);
    
    if (studentData) {
        studentData.status = status;
        studentData.statut = status;
        
        const row = document.querySelector(`tr[data-student-id="${studentId}"]`);
        if (row) {
            const statusBadge = row.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.className = `status-badge status-${status.toLowerCase().replace('_', '-')}`;
                statusBadge.textContent = getStatusLabel(status);
            }
            
            const buttons = row.querySelectorAll('.status-btn');
            buttons.forEach(btn => {
                btn.classList.remove('active');
                const buttonStatus = getButtonStatus(btn);
                if (buttonStatus === status) {
                    btn.classList.add('active');
                }
            });
        }
    }
}

// Obtenir le statut correspondant à un bouton
function getButtonStatus(button) {
    const text = button.textContent.trim();
    switch (text) {
        case 'Présent': return 'Présent';
        case 'Absent': return 'Absent';
        case 'CDI': return 'Présent_CDI';
        case 'Excusé': return 'Absence_prévue';
        default: return null;
    }
}

// Démarrer le rafraîchissement automatique
function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    refreshInterval = setInterval(() => {
        if (currentAttendance && isConnected) {
            refreshAttendanceData();
        }
    }, 5000);
}

// Rafraîchir les données de la feuille d'appel
async function refreshAttendanceData() {
    if (!currentAttendance) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${api}/attendance/${currentAttendance.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const newAttendanceData = data.attendance;
            const previousStudentIds = new Set((currentAttendance?.students || []).map(s => String(s._id || s.id)));
            const nextStudentIds = new Set((newAttendanceData?.students || []).map(s => String(s._id || s.id)));
            const studentsListChanged = previousStudentIds.size !== nextStudentIds.size ||
                Array.from(previousStudentIds).some(id => !nextStudentIds.has(id));
            
            // Mettre à jour les données sans régénérer l'interface complète
            const oldAttendance = currentAttendance;
            currentAttendance = newAttendanceData;
            
            // Synchroniser les statuts des étudiants existants
            if (oldAttendance && oldAttendance.students && currentAttendance.students) {
                updateStudentsFromNewData(oldAttendance.students, currentAttendance.students);
            }
            
            // Mettre à jour les statistiques
            updateAttendanceStats(currentAttendance);
            
            // Mettre à jour les groupes/classes si ils ont changé
            const newGroupNames = Array.isArray(currentAttendance.groups) ? currentAttendance.groups : [];
            displayGroupsTags(newGroupNames);
            
            const newClassNames = Array.isArray(currentAttendance.classes) ? currentAttendance.classes : [];
            displayClassesTags(newClassNames);

            // Si la liste d'élèves a changé (ajout/suppression), reconstruire la table.
            if (studentsListChanged) {
                displayAttendance(currentAttendance);
            }
        }
    } catch (error) {
        console.error('Erreur lors du rafraîchissement:', error);
    }
}

// Mettre à jour les étudiants avec les nouvelles données
function updateStudentsFromNewData(oldStudents, newStudents) {
    // Synchroniser les données back ends
    if (currentAttendance && currentAttendance.students) {
        // Mettre à jour chaque élève dans currentAttendance avec les nouvelles données
        currentAttendance.students.forEach(student => {
            const newStudentData = newStudents.find(s => (s._id || s.id) == (student._id || student.id));
            if (newStudentData) {
                // Synchroniser le statut seulement depuis la base de données
                const newStatus = newStudentData.statut || newStudentData.status || 'NON_APPELE';
                if (student.status !== newStatus || student.statut !== newStatus) {
                    updateStudentStatusLocal(student._id || student.id, newStatus);
                }
            }
        });
    }
    
    // Mettre à jour les éléments visuale s'ils ont changé
    const tableRows = document.querySelectorAll('.student-row');
    tableRows.forEach(row => {
        const studentId = row.dataset.studentId;
        const newStudentData = newStudents.find(s => (s._id || s.id) == studentId);
        
        if (newStudentData) {
            const newStatus = newStudentData.statut || newStudentData.status || 'NON_APPELE';
            const statusBadge = row.querySelector('.status-badge');
            
            if (statusBadge && statusBadge.textContent !== getStatusLabel(newStatus)) {
                updateStudentStatusLocal(studentId, newStatus);
            }
        }
    });
}

// Mettre à jour les statistiques
function updateAttendanceStats(attendance) {
    if (!attendance || !attendance.students) return;
    
    const stats = {
        present: 0,
        absent: 0,
        cdi: 0,
        excused: 0,
        unattended: 0,
        total: attendance.students.length
    };
    
    attendance.students.forEach(student => {
        const status = student.status || 'NON_APPELE';
        
        switch (status) {
            case 'Présent':
                stats.present++;
                break;
            case 'Absent':
                stats.absent++;
                break;
            case 'Présent_CDI':
                stats.cdi++;
                break;
            case 'Absence_prévue':
                stats.excused++;
                break;
            default:
                stats.unattended++;
        }
    });
    
    elements.presentCount.textContent = stats.present;
    elements.absentCount.textContent = stats.absent;
    elements.cdiCount.textContent = stats.cdi;
    elements.excusedCount.textContent = stats.excused;
    elements.unattendedCount.textContent = stats.unattended;
    elements.totalCount.textContent = stats.total;
}

// Mettre à jour depuis Socket.IO
function updateStudentStatusFromSocket(data) {
    updateStudentStatusLocal(data.studentId, data.status);
    updateAttendanceStats(currentAttendance);
    
    if (data.userId !== currentUser?.id) {
        showNotification(`${data.userName} a marqué un élève comme ${getStatusLabel(data.status)}`);
    }
}

// Gestion des utilisateurs connectés
function addConnectedUser(userId, userName) {
    console.log('🔗 Ajout d\'utilisateur connecté:', userId, userName);
    connectedUsers.set(userId, {
        id: userId,
        name: userName,
        joinedAt: new Date()
    });
    updateConnectedUsersDisplay();
}

function removeConnectedUser(userId) {
    console.log('🔗 Suppression d\'utilisateur connecté:', userId);
    connectedUsers.delete(userId);
    updateConnectedUsersDisplay();
}

// Variables pour le chat
let chatMessages = [];
let hasNewChatMessage = false;
let isChatOpen = false;

function setupConnectedUsersEvents() {
    const connectedUsersElement = document.getElementById('connectedUsers');
    const userListEl = document.getElementById('userList');
    if (connectedUsersElement) {
        connectedUsersElement.addEventListener('click', (e) => {
            // Ignorer les clics internes a la popup de chat
            if (e.target.closest('#chatPopup')) {
                return;
            }

            // Le bouton dédié ouvre/ferme le chat, ne pas toggler la liste utilisateurs
            if (e.target.closest('.chat-open-btn')) {
                return;
            }

            // Le bouton de fermeture du chat gere deja le toggle lui-meme
            if (e.target.closest('.chat-close-btn')) {
                return;
            }

            e.stopPropagation();

            // Restaurer le comportement d'origine: afficher/masquer la liste utilisateurs
            if (userListEl) {
                const isVisible = userListEl.style.display === 'block';
                userListEl.style.display = isVisible ? 'none' : 'block';
                if (!isVisible && elements.userList) {
                    updateConnectedUsersDisplay();
                }
            }
        });
    }

    // Fermer la liste en cliquant ailleurs
    document.addEventListener('click', (e) => {
        if (!userListEl || !connectedUsersElement) return;
        if (!connectedUsersElement.contains(e.target)) {
            userListEl.style.display = 'none';
        }
    });
}

// Toggle la popup de chat
function toggleChatPopup() {
    const chatPopup = document.getElementById('chatPopup');
    if (!chatPopup) return;
    
    isChatOpen = !isChatOpen;
    chatPopup.style.display = isChatOpen ? 'flex' : 'none';
    
    if (isChatOpen) {
        // Attendre le prochain frame pour garantir des dimensions calculees
        requestAnimationFrame(() => {
            if (isChatOpen) {
                positionChatPopup();
            }
        });
        // Réinitialiser la notification quand on ouvre le chat
        hasNewChatMessage = false;
        updateChatNotification();
        // Focus sur l'input
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            setTimeout(() => chatInput.focus(), 100);
        }
        // Scroll vers le bas
        scrollChatToBottom();
    }
}

function positionChatPopup() {
    const chatPopup = document.getElementById('chatPopup');
    const trigger = document.getElementById('connectedUsers');
    if (!chatPopup || !trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const popupRect = chatPopup.getBoundingClientRect();
    const computedStyles = window.getComputedStyle(chatPopup);
    let popupWidth = popupRect.width || chatPopup.offsetWidth || parseFloat(computedStyles.width) || 400;
    let popupHeight = popupRect.height || chatPopup.offsetHeight || parseFloat(computedStyles.height) || parseFloat(computedStyles.minHeight) || 300;
    const margin = 10;

    if (popupWidth <= 0 || popupHeight <= 0) {
        // Dernier filet de securite pour eviter un positionnement a (0, 0)
        popupWidth = 400;
        popupHeight = 300;
    }

    let left = triggerRect.right - popupWidth;
    left = Math.max(margin, Math.min(left, window.innerWidth - popupWidth - margin));

    let top = triggerRect.top - popupHeight - margin;
    if (top < margin) {
        top = Math.min(window.innerHeight - popupHeight - margin, triggerRect.bottom + margin);
    }

    chatPopup.style.left = `${left}px`;
    chatPopup.style.top = `${Math.max(margin, top)}px`;
}

window.addEventListener('resize', () => {
    if (isChatOpen) {
        positionChatPopup();
    }
});

// Envoyer un message de chat
function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || !socket || !currentAttendance || !currentUser) return;
    
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Construire le nom d'utilisateur avec fallback (même pattern que ligne 109)
    const userName = currentUser ? `${currentUser.prenom || currentUser.firstName || ''} ${currentUser.nom || currentUser.lastName || ''}`.trim() || 'Utilisateur' : 'Utilisateur';
    
    // Envoyer le message via Socket.IO
    socket.emit('attendance-chat-message', {
        attendanceId: currentAttendance.id,
        message: message,
        userId: currentUser.id,
        userName: userName
    });
    
    // Vider l'input
    chatInput.value = '';
}

// Afficher un message dans le chat
function displayChatMessage(data) {
    const chatMessagesContainer = document.getElementById('chatMessages');
    if (!chatMessagesContainer) return;
    
    const isOwnMessage = data.userId === currentUser?.id;
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isOwnMessage ? 'own-message' : 'other-message'}`;
    
    messageDiv.innerHTML = `
        <div class="chat-message-author">${escapeHtml(data.userName || 'Utilisateur')}</div>
        <div class="chat-message-text">${escapeHtml(data.message)}</div>
    `;
    
    chatMessagesContainer.appendChild(messageDiv);
    chatMessages.push(data);
    
    // Scroll automatique vers le bas
    scrollChatToBottom();
    
    // Si le chat n'est pas ouvert, afficher la notification
    if (!isChatOpen) {
        hasNewChatMessage = true;
        updateChatNotification();
    }
}

// Scroll automatique vers le bas du chat
function scrollChatToBottom() {
    const chatScrollableContainer = document.getElementById('chatPopupBody');
    if (chatScrollableContainer) {
        chatScrollableContainer.scrollTop = chatScrollableContainer.scrollHeight;
    }
}

// Mettre à jour la notification visuelle sur le bouton
function updateChatNotification() {
    const connectedUsersElement = document.getElementById('connectedUsers');
    if (!connectedUsersElement) return;
    
    if (hasNewChatMessage && !isChatOpen) {
        connectedUsersElement.classList.add('has-new-message');
    } else {
        connectedUsersElement.classList.remove('has-new-message');
    }
}

// Fonction utilitaire pour échapper le HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateConnectedUsersDisplay() {
    if (!elements.userCount || !elements.userList) {
        console.log('🔗 Éléments DOM manquants pour utilisateurs connectés');
        return;
    }
    
    const userCount = connectedUsers.size;
    console.log('🔗 Mise à jour affichage utilisateurs:', userCount, 'utilisateurs');
    
    elements.userCount.textContent = userCount;
    
    elements.userList.innerHTML = '';
    
    if (userCount === 0) {
        elements.userList.innerHTML = '<div class="user-item" style="color: var(--text-secondary); font-style: italic;">Aucun autre utilisateur</div>';
        return;
    }
    
    connectedUsers.forEach((user, userId) => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        
        if (userId === currentUser?.id) {
            userItem.classList.add('self');
        }
        
        userItem.innerHTML = `
            <i class="fas fa-circle" style="color: var(--success-color); font-size: 0.5rem;"></i>
            <span>${user.name}</span>
        `;
        
        elements.userList.appendChild(userItem);
    });
}

// Mettre à jour le statut de synchronisation
function updateSyncStatus(connected) {
    const statusElement = elements.syncStatus;
    const icon = statusElement.querySelector('i');
    const text = statusElement.querySelector('span');
    
    if (connected) {
        statusElement.className = 'sync-status connected';
        icon.className = 'fas fa-circle';
        text.textContent = 'Synchronisé';
    } else {
        statusElement.className = 'sync-status disconnected';
        icon.className = 'fas fa-circle';
        text.textContent = 'Hors ligne';
    }
}

// Afficher/masquer le chargement
function showLoading(show) {
    elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

// Afficher une erreur
function showError(message) {
    elements.errorText.textContent = message;
    elements.errorMessage.style.display = 'block';
    showLoading(false);
}

// Afficher une notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    // Couleurs selon le type
    const colors = {
        success: 'var(--success-color)',
        info: 'var(--primary-color)',
        warning: 'var(--warning-color)',
        error: 'var(--error-color)'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.success};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-lg);
        z-index: 1001;
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, type === 'info' ? 5000 : 3000); // Plus long pour les notifications info
}

// Exposer les fonctions globalement pour les boutons HTML
window.syncStudentsManually = syncStudentsManually;
window.toggleChatPopup = toggleChatPopup;
window.sendChatMessage = sendChatMessage;

// Activer le mode lecture seule
function enableReadOnlyMode() {
    // Ajouter une bannière de mode lecture seule
    const banner = document.createElement('div');
    banner.className = 'readonly-banner';
    banner.innerHTML = '<i class="fas fa-lock"></i> Mode lecture seule - Cette feuille d\'appel est passée';
    
    // Insérer la bannière au début du contenu
    const attendancePage = document.querySelector('.attendance-page');
    if (attendancePage) {
        attendancePage.insertBefore(banner, attendancePage.firstChild);
    }
    
    // Ajouter la classe readonly-mode au conteneur principal
    if (attendancePage) {
        attendancePage.classList.add('readonly-mode');
    }
    
    // Désactiver les boutons d'ajout et de synchronisation en mode lecture seule
    const addGroupsBtn = document.getElementById('addGroupsBtn');
    const addClassesBtn = document.getElementById('addClassesBtn');
    const syncStudentsBtn = document.getElementById('syncStudentsBtn');
    const checkBtn = document.querySelector('button[onclick="showAttendanceCheckModal()"]');
    
    if (addGroupsBtn) addGroupsBtn.style.display = 'none';
    if (addClassesBtn) addClassesBtn.style.display = 'none';
    if (syncStudentsBtn) syncStudentsBtn.style.display = 'none';
    if (checkBtn) checkBtn.style.display = 'none';
    
    console.log('📖 Mode lecture seule activé - Les modifications sont désactivées');
}

// Fonction pour synchroniser manuellement les élèves
async function syncStudentsManually() {
    if (!currentAttendance) {
        showError('Aucune feuille d\'appel chargée');
        return;
    }
    
    if (isReadOnlyMode) {
        showNotification('Mode lecture seule - La synchronisation n\'est pas autorisée', 'warning');
        return;
    }
    
    const syncBtn = document.getElementById('syncStudentsBtn');
    if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Synchronisation...';
    }
    
    try {
        const token = localStorage.getItem('token');
        const syncResponse = await fetch(`${api}/attendance/${currentAttendance.id}/sync-students`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (syncResponse.ok) {
            const syncData = await syncResponse.json();
            if (syncData.success) {
                // Toujours recharger pour garantir la cohérence de l'affichage local
                // même si le backend considère qu'il n'y a pas eu de delta.
                await loadAttendance(currentAttendance.id);
                if (syncData.addedCount > 0 || syncData.removedCount > 0) {
                    console.log(`🔄 Synchronisation manuelle: ${syncData.addedCount} élève(s) ajouté(s), ${syncData.removedCount} élève(s) supprimé(s)`);
                    showNotification(`Synchronisation réussie: ${syncData.addedCount} ajouté(s), ${syncData.removedCount} supprimé(s)`, 'success');
                } else {
                    console.log('🔄 Synchronisation manuelle: Aucune modification nécessaire');
                    showNotification('Aucune modification nécessaire - La liste est à jour', 'info');
                }
            } else {
                throw new Error(syncData.message || 'Erreur lors de la synchronisation');
            }
        } else {
            const errorData = await syncResponse.json();
            throw new Error(errorData.message || 'Erreur lors de la synchronisation');
        }
    } catch (error) {
        console.error('Erreur lors de la synchronisation manuelle:', error);
        showError('Erreur lors de la synchronisation: ' + error.message);
    } finally {
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Synchroniser les élèves';
        }
    }
}

// Fonction pour exporter en PDF (fonctionne en mode lecture seule)
function exportAttendancePDF() {
    if (!currentAttendance) {
        showError('Aucune feuille d\'appel à exporter');
        return;
    }
    
    // Appeler la fonction d'export depuis le fichier pdf-export.js
    if (typeof exportSingleAttendance === 'function') {
        exportSingleAttendance(currentAttendance.id);
    } else {
        showError('Fonction d\'export PDF non disponible');
    }
}

// Utilitaires
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatTime(dateString) {
    // Vérifier si c'est un format simple HH:MM (sans date)
    if (dateString && dateString.includes(':') && !dateString.includes('-') && !dateString.includes('/')) {
        // Format direct comme "08:00" ou "08:30"
        const parts = dateString.split(':');
        if (parts.length >= 2) {
            const hours = parts[0].padStart(2, '0');
            const minutes = parts[1].padStart(2, '0');
            const timeString = `${hours}:${minutes}`;
            return timeString;
        }
    }
    
    // Si c'est une date complète
    if (dateString && dateString !== 'N/A') {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                // Si ce n'est toujours pas valide, utiliser la chaîne directe
                return dateString;
            }
            return date.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return dateString;
        }
    }
    
    return 'N/A';
}

function getStatusLabel(status) {
    const labels = {
        'Présent': 'Présent',
        'Absent': 'Absent',
        'Présent_CDI': 'CDI',
        'Absence_prévue': 'Excusé',
        'NON_APPELE': 'Non appelé'
    };
    
    return labels[status] || 'Absent';
}

// Fonctions pour l'ajout de groupes et classes
function showAddGroupsModal() {
    const modal = document.getElementById('addGroupsModal');
    modal.style.display = 'flex';
    loadAvailableGroups();
}

function hideAddGroupsModal() {
    const modal = document.getElementById('addGroupsModal');
    modal.style.display = 'none';
}

function showAddClassesModal() {
    const modal = document.getElementById('addClassesModal');
    modal.style.display = 'flex';
    loadAvailableClasses();
}

function hideAddClassesModal() {
    const modal = document.getElementById('addClassesModal');
    modal.style.display = 'none';
}

async function loadAvailableGroups() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${api}/students/groups/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('📊 Groupes reçus:', data);
            displayAvailableGroups(data.groups || []);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des groupes:', error);
        showError('Erreur lors du chargement des groupes');
    }
}

async function loadAvailableClasses() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${api}/students/classes/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('📊 Classes reçues:', data);
            displayAvailableClasses(data.classes || []);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des classes:', error);
        showError('Erreur lors du chargement des classes');
    }
}

function displayAvailableGroups(groups) {
    const container = document.getElementById('availableGroupsList');
    container.innerHTML = '';
    
    if (!groups || groups.length === 0) {
        container.innerHTML = '<p>Aucun groupe disponible</p>';
        return;
    }
    
    const currentGroups = Array.isArray(currentAttendance?.groups) ? currentAttendance.groups : [];
    
    groups.forEach(group => {
        const groupName = typeof group === 'string' ? group : group.nom || group.name;
        const isAlreadyPresent = currentGroups.includes(groupName);
        
        const groupOption = document.createElement('div');
        groupOption.className = `group-option ${isAlreadyPresent ? 'disabled' : ''}`;
        
        groupOption.innerHTML = `
            <label>
                <input type="checkbox" 
                       value="${groupName}" 
                       data-group-name="${groupName}"
                       ${isAlreadyPresent ? 'disabled' : ''}>
                <span>${groupName}</span>
                ${isAlreadyPresent ? '<small>(déjà présent)</small>' : ''}
            </label>
        `;
        
        if (isAlreadyPresent) {
            groupOption.style.opacity = '0.5';
            groupOption.style.cursor = 'not-allowed';
        }
        
        container.appendChild(groupOption);
    });
}

function displayAvailableClasses(classes) {
    const container = document.getElementById('availableClassesList');
    container.innerHTML = '';
    
    if (!classes || classes.length === 0) {
        container.innerHTML = '<p>Aucune classe disponible</p>';
        return;
    }
    
    const currentClasses = Array.isArray(currentAttendance?.classes) ? currentAttendance.classes : [];
    
    classes.forEach(className => {
        const classNameValue = typeof className === 'string' ? className : className.nom || className.name;
        const isAlreadyPresent = currentClasses.includes(classNameValue);
        
        const classOption = document.createElement('div');
        classOption.className = `class-option ${isAlreadyPresent ? 'disabled' : ''}`;
        
        classOption.innerHTML = `
            <label>
                <input type="checkbox" 
                       value="${classNameValue}" 
                       data-class-name="${classNameValue}"
                       ${isAlreadyPresent ? 'disabled' : ''}>
                <span>${classNameValue}</span>
                ${isAlreadyPresent ? '<small>(déjà présente)</small>' : ''}
            </label>
        `;
        
        if (isAlreadyPresent) {
            classOption.style.opacity = '0.5';
            classOption.style.cursor = 'not-allowed';
        }
        
        container.appendChild(classOption);
    });
}

async function addSelectedGroups() {
    const selectedGroups = Array.from(document.querySelectorAll('#availableGroupsList input:checked:not([disabled])'))
        .map(input => input.getAttribute('data-group-name'));

    if (selectedGroups.length === 0) {
        showError('Veuillez sélectionner au moins un groupe');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${api}/attendance/${currentAttendance.id}/groups`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ groups: selectedGroups })
        });

        if (response.ok) {
            const data = await response.json();
            hideAddGroupsModal();
            showNotification(`${selectedGroups.length} groupe(s) ajouté(s) avec succès`);
            
            // Si l'API renvoie les données mises à jour, les utiliser
            if (data.attendance) {
                currentAttendance = {
                    ...currentAttendance,
                    classes: data.attendance.classes || data.attendance.classe || [],
                    groups: data.attendance.groups || data.attendance.groupes || [],
                    students: data.attendance.students || []
                };
                
                // Mettre à jour l'affichage avec les nouvelles données
                displayAttendance(currentAttendance);
                
                // Nettoyer l'affichage des groupes/classes
                displayGroupsTags(currentAttendance.groups || currentAttendance.groupes);
                displayClassesTags(currentAttendance.classes);
                
                // Forcer la mise à jour des statistiques
                updateAttendanceStats(currentAttendance);
                
                console.log('✅ Groupes mis à jour:', currentAttendance);
            } else {
                // Fallback si pas de données dans la réponse
                await refreshAttendanceData();
            }
        } else {
            const data = await response.json();
            showError(data.message || 'Erreur lors de l\'ajout des groupes');
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout des groupes:', error);
        showError('Erreur lors de l\'ajout des groupes');
    }
}

async function addSelectedClasses() {
    const selectedClasses = Array.from(document.querySelectorAll('#availableClassesList input:checked:not([disabled])'))
        .map(input => input.value);

    if (selectedClasses.length === 0) {
        showError('Veuillez sélectionner au moins une classe');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${api}/attendance/${currentAttendance.id}/classes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ classes: selectedClasses })
        });

        if (response.ok) {
            const data = await response.json();
            hideAddClassesModal();
            showNotification(`${selectedClasses.length} classe(s) ajoutée(s) avec succès`);
            
            // Si l'API renvoie les données mises à jour, les utiliser
            if (data.attendance) {
                currentAttendance = {
                    ...currentAttendance,
                    classes: data.attendance.classes || data.attendance.classe || [],
                    groups: data.attendance.groups || data.attendance.groupes || [],
                    students: data.attendance.students || []
                };
                
                // Mettre à jour l'affichage avec les nouvelles données
                displayAttendance(currentAttendance);
                
                // Nettoyer l'affichage des classes/groupes
                displayClassesTags(currentAttendance.classes);
                displayGroupsTags(currentAttendance.groups || currentAttendance.groupes);
                
                // Forcer la mise à jour des statistiques
                updateAttendanceStats(currentAttendance);
                
                console.log('✅ Classes mises à jour:', currentAttendance);
                
                // Debug : forcer total refresh si besoin 
                setTimeout(() => {
                    document.querySelector('#studentsContainer')?.offsetHeight; // Trigger reflow
                }, 50);
            } else {
                // Fallback si pas de données dans la réponse
                await refreshAttendanceData();
            }
        } else {
            const data = await response.json();
            showError(data.message || 'Erreur lors de l\'ajout des classes');
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout des classes:', error);
        showError('Erreur lors de l\'ajout des classes');
    }
}

function displayGroupsTags(groups) {
    const container = document.getElementById('groupsTags');
    container.innerHTML = '';
    
    if (!groups || groups.length === 0) {
        container.innerHTML = '<span style="color: var(--text-secondary); font-style: italic;">Aucun groupe</span>';
        return;
    }
    
    groups.forEach(group => {
        const tag = document.createElement('div');
        tag.className = 'group-tag';
        tag.innerHTML = `
            <span>${group}</span>
            <button class="remove-btn" onclick="removeGroup('${group}')" title="Supprimer ce groupe">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(tag);
    });
}

function displayClassesTags(classes) {
    const container = document.getElementById('classesTags');
    container.innerHTML = '';
    
    if (!classes || classes.length === 0) {
        container.innerHTML = '<span style="color: var(--text-secondary); font-style: italic;">Aucune classe</span>';
        return;
    }
    
    classes.forEach(className => {
        const tag = document.createElement('div');
        tag.className = 'class-tag';
        tag.innerHTML = `
            <span>${className}</span>
            <button class="remove-btn" onclick="removeClass('${className}')" title="Supprimer cette classe">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(tag);
    });
}

async function removeGroup(groupName) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${api}/attendance/${currentAttendance.id}/groups`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ groupName })
        });

        if (response.ok) {
            const data = await response.json();
            showNotification('Groupe supprimé avec succès');
            
            // Si des données d'attendance sont renvoyées, les utiliser directement
            // pour mettre à jour l'affichage sans aller refaire un fetch
            if (data.attendance) {
                currentAttendance = {
                    ...currentAttendance,
                    classes: data.attendance.classes || [],
                    groups: data.attendance.groups || data.attendance.groupes || [],
                    students: data.attendance.students || []
                };
                
                // Mettre à jour l'affichage avec les nouvelles données
                displayAttendance(currentAttendance);
                
                // Nettoyer l'affichage des groupes/classes
                displayGroupsTags(currentAttendance.groups || currentAttendance.groupes);
                displayClassesTags(currentAttendance.classes);
                
                // Forcer la mise à jour des statistiques
                updateAttendanceStats(currentAttendance);
                
                console.log('✅ Groupes supprimés:', currentAttendance);
                
                // Force refresh of the DOM after delete
                setTimeout(() => {
                    document.querySelector('#studentsContainer')?.offsetHeight;
                }, 50);
            } else {
                // Pas de données de retour, utiliser l'ancien comportement
                await refreshAttendanceData();
            }
        } else {
            const data = await response.json();
            showError(data.message || 'Erreur lors de la suppression du groupe');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression du groupe:', error);
        showError('Erreur lors de la suppression du groupe');
    }
}

async function removeClass(className) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${api}/attendance/${currentAttendance.id}/classes`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ className })
        });

        if (response.ok) {
            const data = await response.json();
            showNotification('Classe supprimée avec succès');
            
            // Si des données d'attendance sont renvoyées, les utiliser directement
            // pour mettre à jour l'affichage sans aller refaire un fetch
            if (data.attendance) {
                currentAttendance = {
                    ...currentAttendance,
                    classes: data.attendance.classes || [],
                    groups: data.attendance.groups || data.attendance.groupes || [],
                    students: data.attendance.students || []
                };
                
                // Mettre à jour l'affichage avec les nouvelles données
                displayAttendance(currentAttendance);
                
                // Nettoyer l'affichage des groupes/classes
                displayGroupsTags(currentAttendance.groups || currentAttendance.groupes);
                displayClassesTags(currentAttendance.classes);
                
                // Forcer la mise à jour des statistiques
                updateAttendanceStats(currentAttendance);
                
                console.log('✅ Classes supprimées:', currentAttendance);
                
                // Force refresh of the DOM after delete
                setTimeout(() => {
                    document.querySelector('#studentsContainer')?.offsetHeight;
                }, 50);
            } else {
                // Pas de données de retour, utiliser l'ancien comportement
                await refreshAttendanceData();
            }
        } else {
            const data = await response.json();
            showError(data.message || 'Erreur lors de la suppression de la classe');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression de la classe:', error);
        showError('Erreur lors de la suppression de la classe');
    }
}

function showAttendanceCheckModal() {
    const unattendedStudents = checkUnattendedStudents();
    
    if (unattendedStudents.length === 0) {
        showNotification('✅ Tous les élèves ont été appelés !');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'attendance-check-modal';
    modal.innerHTML = `
        <div class="attendance-check-content">
            <div class="attendance-check-header">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Vérification de l'appel</h3>
            </div>
            <div class="attendance-check-body">
                <p>L'appel n'a pas été fait pour ${unattendedStudents.length} élève(s) :</p>
                <ul class="unattended-list">
                    ${unattendedStudents.map(student => 
                        `<li><i class="fas fa-user"></i> ${student.name}</li>`
                    ).join('')}
                </ul>
                <p class="warning-text">
                    <i class="fas fa-info-circle"></i>
                    Voulez-vous vraiment fermer la feuille d'appel ?
                </p>
            </div>
            <div class="attendance-check-footer">
                <button class="btn btn-secondary" data-action="continue">
                    <i class="fas fa-times"></i> Fermer quand même
                </button>
                <button class="btn btn-primary" data-action="cancel">
                    <i class="fas fa-arrow-left"></i> Retour à l'appel
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const buttons = modal.querySelectorAll('button[data-action]');
    buttons.forEach(button => {
        button.addEventListener('click', (e) => {
            const action = e.target.getAttribute('data-action');
            
            if (action === 'continue') {
                modal.remove();
                forceClose = true; // Activer la fermeture forcée
                window.close();
            } else if (action === 'cancel') {
                modal.remove();
            }
        });
    });
}

function checkUnattendedStudents() {
    if (!currentAttendance || !currentAttendance.students) {
        return [];
    }
    
    const unattendedStudents = [];
    
    currentAttendance.students.forEach(student => {
        const status = student.status || 'NON_APPELE';
        
        if (status === 'NON_APPELE') {
            unattendedStudents.push({
                name: `${student.firstName || student.prenom} ${student.lastName || student.nom}`,
                studentId: student._id || student.id
            });
        }
    });
    
    return unattendedStudents;
}

// Variable pour contrôler la fermeture forcée
let forceClose = false;

// Gestion de la fermeture de la fenêtre
window.addEventListener('beforeunload', (e) => {
    // Si la fermeture est forcée, ne pas empêcher
    if (forceClose) {
        if (currentAttendance && isConnected) {
            socket.emit('leave-attendance', { attendanceId: currentAttendance.id });
        }
        // Nettoyer les messages de chat
        chatMessages = [];
        return;
    }
    
    const unattendedStudents = checkUnattendedStudents();
    
    if (unattendedStudents.length > 0) {
        e.preventDefault();
        e.returnValue = '';
        showAttendanceCheckModal();
        return false;
    }
    
    if (currentAttendance && isConnected) {
        socket.emit('leave-attendance', { attendanceId: currentAttendance.id });
    }
    
    // Nettoyer les messages de chat à la fermeture
    chatMessages = [];
});

// Ajouter les styles d'animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .status-badge {
        padding: 0.25rem 0.75rem;
        border-radius: var(--border-radius);
        font-size: 0.875rem;
        font-weight: 500;
    }
    
    .status-badge.status-présent {
        background-color: var(--success-color);
        color: white;
    }
    
    .status-badge.status-absent {
        background-color: var(--error-color);
        color: white;
    }
    
    .status-badge.status-présent-cdi {
        background-color: var(--warning-color);
        color: white;
    }
    
    .status-badge.status-absence-prévue {
        background-color: var(--secondary-color);
        color: white;
    }
    
    .status-badge.status-non-appelé {
        background-color: var(--warning-color);
        color: white;
    }
    
    .status-btn.active {
        box-shadow: 0 0 0 2px var(--primary-color);
        transform: scale(1.05);
    }
    
    .status-btn:not(.active) {
        opacity: 0.7;
    }
    
    .status-btn:not(.active):hover {
        opacity: 1;
    }
`;
document.head.appendChild(style);
