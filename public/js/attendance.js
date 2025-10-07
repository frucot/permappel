// ===== GESTION DES APPELS =====

// Fonction pour créer un nouvel appel
function createNewCall() {
    const formData = new FormData(document.getElementById('newCallForm'));
    const callData = {
        date: formData.get('callDate'),
        creneauId: formData.get('callSchedule'),
        groups: getSelectedGroups(),
        classes: getSelectedClasses(),
        isRecurring: formData.get('recurringCall') === 'on',
        recurrenceType: formData.get('recurrenceType'),
        recurrenceEndDate: formData.get('recurrenceEndDate'),
        recurrenceCount: formData.get('recurrenceCount')
    };
    
    if (!callData.date || !callData.creneauId) {
        showError('Date et créneau sont requis');
        return;
    }
    
    if (callData.groups.length === 0 && callData.classes.length === 0) {
        showError('Veuillez sélectionner au moins un groupe ou une classe');
        return;
    }
    
    fetch(getApiUrl('/attendance'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(callData)
    })
    .then(response => {
        console.log('📊 Réponse création feuille d\'appel:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('📊 Données récupérées:', data);
        if (data.success) {
            showSuccess(data.message || 'Feuille d\'appel créée avec succès');
            hideModal('newCallModal');
            loadAttendances();
            
            if (data.attendanceId) {
                console.log('📊 Ouverture fenêtre:', data.attendanceId);
                const newWindow = openAttendanceWindow(`attendance.html?id=${data.attendanceId}`);
                if (!newWindow) {
                    showError('Impossible d\'ouvrir la fenêtre, vérifiez les paramètres du blocage de pop-ups');
                }
            } else {
                showError('ID de feuille d\'appel non retourné');
            }
        } else {
            showError(data.message || 'Erreur lors de la création de la feuille d\'appel');
        }
    })
    .catch(error => {
        console.error('Erreur:', error);
        showError('Erreur lors de la création de la feuille d\'appel');
    });
}

// Fonction pour obtenir les groupes sélectionnés
function getSelectedGroups() {
    const checkboxes = document.querySelectorAll('#newCallGroupsOptions input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Fonction pour obtenir les classes sélectionnées
function getSelectedClasses() {
    const checkboxes = document.querySelectorAll('#newCallClassesOptions input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Fonction pour charger les groupes
async function loadGroups() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl('/students/groups/list'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            populateGroupCheckboxesForNewCall(data.groups);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des groupes:', error);
    }
}

// Remplir le composant multiselect des groupes pour le nouvel appel
function populateGroupCheckboxesForNewCall(groups) {
    const dropdown = document.getElementById('newCallGroupsDropdown');
    const selectedElement = document.getElementById('newCallGroupsSelected');
    const optionsElement = document.getElementById('newCallGroupsOptions');
    
    if (!dropdown || !selectedElement || !optionsElement) return;
    
    optionsElement.innerHTML = '';
    
    groups.forEach(groupName => {
        const option = document.createElement('div');
        option.className = 'multiselect-option';
        
        option.innerHTML = `
            <input type="checkbox" id="newcall-group-${groupName}" value="${groupName}">
            <label for="newcall-group-${groupName}">${groupName}</label>
        `;
        
        optionsElement.appendChild(option);
        
        const checkbox = option.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => {
            updateSelectedGroupsDisplayForNewCall();
        });
    });
    
    updateSelectedGroupsDisplayForNewCall();
    
    selectedElement.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });
    
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });
}

// Mettre à jour l'affichage des groupes sélectionnés pour le nouvel appel
function updateSelectedGroupsDisplayForNewCall() {
    const selectedElement = document.getElementById('newCallGroupsSelected');
    const checkboxes = document.querySelectorAll('#newCallGroupsOptions input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
        selectedElement.innerHTML = `
            <span class="placeholder">Sélectionner des groupes...</span>
            <i class="fas fa-chevron-down"></i>
        `;
    } else {
        const selectedItems = Array.from(checkboxes).map(checkbox => {
            const groupName = checkbox.value;
            return `
                <div class="selected-item">
                    <span>${groupName}</span>
                    <span class="remove" data-group="${groupName}">&times;</span>
                </div>
            `;
        }).join('');
        
        selectedElement.innerHTML = `
            <div class="selected-items">${selectedItems}</div>
            <i class="fas fa-chevron-down"></i>
        `;
        
        selectedElement.querySelectorAll('.remove').forEach(removeBtn => {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const groupName = e.target.getAttribute('data-group');
                const checkbox = document.querySelector(`#newCallGroupsOptions input[value="${groupName}"]`);
                if (checkbox) {
                    checkbox.checked = false;
                    updateSelectedGroupsDisplayForNewCall();
                }
            });
        });
    }
}

// Fonction pour charger les classes
async function loadClasses() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl('/students/classes/list'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            populateClassCheckboxesForNewCall(data.classes);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des classes:', error);
    }
}

// Remplir le composant multiselect des classes pour le nouvel appel
function populateClassCheckboxesForNewCall(classes) {
    const dropdown = document.getElementById('newCallClassesDropdown');
    const selectedElement = document.getElementById('newCallClassesSelected');
    const optionsElement = document.getElementById('newCallClassesOptions');
    
    if (!dropdown || !selectedElement || !optionsElement) return;
    
    optionsElement.innerHTML = '';
    
    classes.forEach(className => {
        const option = document.createElement('div');
        option.className = 'multiselect-option';
        
        option.innerHTML = `
            <input type="checkbox" id="newcall-class-${className}" value="${className}">
            <label for="newcall-class-${className}">${className}</label>
        `;
        
        optionsElement.appendChild(option);
        
        const checkbox = option.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => {
            updateSelectedClassesDisplayForNewCall();
        });
    });
    
    updateSelectedClassesDisplayForNewCall();
    
    selectedElement.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });
    
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });
}

// Mettre à jour l'affichage des classes sélectionnées pour le nouvel appel
function updateSelectedClassesDisplayForNewCall() {
    const selectedElement = document.getElementById('newCallClassesSelected');
    const checkboxes = document.querySelectorAll('#newCallClassesOptions input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
        selectedElement.innerHTML = `
            <span class="placeholder">Sélectionner des classes...</span>
            <i class="fas fa-chevron-down"></i>
        `;
    } else {
        const selectedItems = Array.from(checkboxes).map(checkbox => {
            const className = checkbox.value;
            return `
                <div class="selected-item">
                    <span>${className}</span>
                    <span class="remove" data-class="${className}">&times;</span>
                </div>
            `;
        }).join('');
        
        selectedElement.innerHTML = `
            <div class="selected-items">${selectedItems}</div>
            <i class="fas fa-chevron-down"></i>
        `;
        
        selectedElement.querySelectorAll('.remove').forEach(removeBtn => {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const className = e.target.getAttribute('data-class');
                const checkbox = document.querySelector(`#newCallClassesOptions input[value="${className}"]`);
                if (checkbox) {
                    checkbox.checked = false;
                    updateSelectedClassesDisplayForNewCall();
                }
            });
        });
    }
}

// Fonction pour charger les appels
async function loadAttendances() {
    try {
        const token = localStorage.getItem('token');
        const attendanceDate = document.getElementById('attendanceDate');
        const attendanceSchedule = document.getElementById('attendanceSchedule');
        
        const date = attendanceDate?.value || new Date().toISOString().split('T')[0];
        const scheduleId = attendanceSchedule?.value || '';
        
        let url = `${getApiUrl('/attendance')}?date=${date}`;
        if (scheduleId) {
            url += `&scheduleId=${scheduleId}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayAttendances(data.attendances || []);
        } else {
            console.error('Erreur lors du chargement des appels');
            displayAttendances([]);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des appels:', error);
        displayAttendances([]);
    }
}

// Fonction pour afficher les appels
function displayAttendances(attendances) {
    const attendanceList = document.getElementById('attendanceList');
    if (!attendanceList) return;
    
    if (attendances.length === 0) {
        attendanceList.innerHTML = `
            <div class="no-attendances">
                <i class="fas fa-clipboard-list"></i>
                <h3>Aucun appel trouvé</h3>
                <p>Il n'y a pas d'appels pour cette date et ce créneau.</p>
            </div>
        `;
        return;
    }
    
    attendanceList.innerHTML = attendances.map(attendance => `
        <div class="attendance-card">
            <div class="attendance-card-header">
                <div class="attendance-card-info">
                    <h3>${attendance.schedule?.name || 'Appel'}</h3>
                    <div class="attendance-card-details">
                        <span><i class="fas fa-calendar"></i> ${formatDate(attendance.date)}</span>
                        <span><i class="fas fa-clock"></i> ${attendance.schedule?.startTime || ''} - ${attendance.schedule?.endTime || ''}</span>
                        <span><i class="fas fa-users"></i> ${attendance.students?.length || 0} élèves</span>
                    </div>
                </div>
                <div class="attendance-card-actions">
                    <button class="btn btn-primary" onclick="openAttendanceWithCheck('${attendance.id}')">
                        <i class="fas fa-eye"></i>
                        Ouvrir
                    </button>
                    <button class="btn btn-info" onclick="exportSingleAttendance('${attendance.id}')">
                        <i class="fas fa-file-pdf"></i>
                        PDF
                    </button>
                </div>
            </div>
            <div class="attendance-card-body">
                <div class="attendance-stats">
                    <div class="stat-card present">
                        <div class="stat-number">${attendance.stats?.present || 0}</div>
                        <div class="stat-label">Présents</div>
                    </div>
                    <div class="stat-card absent">
                        <div class="stat-number">${attendance.stats?.absent || 0}</div>
                        <div class="stat-label">Absents</div>
                    </div>
                    <div class="stat-card cdi">
                        <div class="stat-number">${attendance.stats?.cdi || 0}</div>
                        <div class="stat-label">CDI</div>
                    </div>
                    <div class="stat-card excused">
                        <div class="stat-number">${attendance.stats?.excused || 0}</div>
                        <div class="stat-label">Excusés</div>
                    </div>
                </div>
                <div class="attendance-groups">
                    ${(attendance.groups || []).map(group => `
                        <span class="group-tag">${group}</span>
                    `).join('')}
                    ${(attendance.classes || []).map(className => `
                        <span class="class-tag">${className}</span>
                    `).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

// Fonction pour ouvrir une feuille d'appel
function openAttendance(attendanceId) {
    openAttendanceWindow(`attendance.html?id=${attendanceId}`);
}

// Fonction pour vérifier si une feuille d'appel est passée
function isAttendancePast(attendance) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    
    // Vérifier si la date est antérieure à aujourd'hui
    if (attendance.date < today) {
        return true;
    }
    
    // Si c'est aujourd'hui, vérifier si l'heure actuelle dépasse l'heure de fin du créneau
    if (attendance.date === today && attendance.schedule?.endTime) {
        return currentTime > attendance.schedule.endTime;
    }
    
    // Si c'est aujourd'hui mais pas d'heure de fin définie, considérer comme passée après 18h
    if (attendance.date === today && !attendance.schedule?.endTime) {
        return currentTime > '18:00';
    }
    
    return false;
}

// Fonction pour ouvrir une feuille d'appel (remplace editAttendance)
function openAttendanceWithCheck(attendanceId) {
    // Récupérer les données de la feuille d'appel depuis l'API
    fetch(`${getApiUrl('/attendance')}/${attendanceId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.attendance) {
            const attendance = data.attendance;
            
            // Vérifier si la feuille d'appel est passée
            if (isAttendancePast(attendance)) {
                showPastAttendanceWarning(attendanceId, attendance);
            } else {
                // Ouvrir en mode modification normale
                openAttendance(attendanceId);
            }
        } else {
            showError('Impossible de récupérer les informations de la feuille d\'appel');
        }
    })
    .catch(error => {
        console.error('Erreur lors de la récupération de la feuille d\'appel:', error);
        showError('Erreur lors de la récupération de la feuille d\'appel');
    });
}

// Fonction pour afficher l'avertissement pour les feuilles d'appel passées
function showPastAttendanceWarning(attendanceId, attendance) {
    const scheduleName = attendance.schedule?.name || 'Appel';
    const scheduleTime = attendance.schedule?.endTime ? 
        ` (fin prévue à ${attendance.schedule.endTime})` : '';
    
    const message = `Cette feuille d'appel "${scheduleName}"${scheduleTime} est passée.\n\nQue souhaitez-vous faire ?`;
    
    // Créer une modale de confirmation personnalisée
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'pastAttendanceModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-exclamation-triangle"></i> Feuille d'appel passée</h3>
                <button class="modal-close" onclick="hideModal('pastAttendanceModal')">&times;</button>
            </div>
            <div class="modal-body">
                <p>${message}</p>
                <div class="warning-details">
                    <div class="warning-item">
                        <i class="fas fa-calendar"></i>
                        <span>Date : ${formatDate(attendance.date)}</span>
                    </div>
                    <div class="warning-item">
                        <i class="fas fa-clock"></i>
                        <span>Créneau : ${attendance.schedule?.startTime || ''} - ${attendance.schedule?.endTime || ''}</span>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="hideModal('pastAttendanceModal')">
                    <i class="fas fa-times"></i>
                    Fermer
                </button>
                <button type="button" class="btn btn-info" onclick="openAttendanceReadOnly('${attendanceId}')">
                    <i class="fas fa-eye"></i>
                    Consulter (lecture seule)
                </button>
                <button type="button" class="btn btn-warning" onclick="openAttendanceEdit('${attendanceId}')">
                    <i class="fas fa-edit"></i>
                    Modifier
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    showModal('pastAttendanceModal');
}

// Fonction pour ouvrir en mode lecture seule
function openAttendanceReadOnly(attendanceId) {
    hideModal('pastAttendanceModal');
    openAttendanceWindow(`attendance.html?id=${attendanceId}&mode=readonly`);
}

// Fonction pour ouvrir en mode modification (malgré l'avertissement)
function openAttendanceEdit(attendanceId) {
    hideModal('pastAttendanceModal');
    openAttendanceWindow(`attendance.html?id=${attendanceId}&mode=edit`);
}

// Initialiser les gestionnaires pour les appels
function initAttendanceHandlers() {
    // Gestion du formulaire de nouvel appel
    const newCallForm = document.getElementById('newCallForm');
    if (newCallForm) {
        newCallForm.addEventListener('submit', (e) => {
            e.preventDefault();
            createNewCall();
        });
    }

    // Gestion des filtres d'appels
    const filterAttendances = document.getElementById('filterAttendances');
    if (filterAttendances) {
        filterAttendances.addEventListener('click', loadAttendances);
    }

    // Définir la date du jour par défaut pour les filtres
    const attendanceDate = document.getElementById('attendanceDate');
    if (attendanceDate) {
        const today = new Date().toISOString().split('T')[0];
        attendanceDate.value = today;
    }

    // Bouton "Nouvel appel"
    const newCallBtn = document.getElementById('newCallBtn');
    if (newCallBtn) {
        newCallBtn.addEventListener('click', function() {
            const today = new Date().toISOString().split('T')[0];
            const callDate = document.getElementById('callDate');
            if (callDate) callDate.value = today;
            
            const newCallForm = document.getElementById('newCallForm');
            if (newCallForm) newCallForm.reset();
            
            updateSelectedGroupsDisplayForNewCall();
            updateSelectedClassesDisplayForNewCall();
            
            loadSchedules();
            loadGroups();
            loadClasses();
            
            showModal('newCallModal');
        });
    }
}
