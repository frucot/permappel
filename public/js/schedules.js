// ===== GESTION DES CRÉNEAUX =====

// Fonction pour charger les créneaux
async function loadSchedules() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl('/schedules'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const scheduleSelect = document.getElementById('callSchedule');
            if (scheduleSelect) {
                scheduleSelect.innerHTML = '<option value="">Sélectionner un créneau</option>';
                data.schedules.forEach(schedule => {
                    const option = document.createElement('option');
                    option.value = schedule.id;
                    option.textContent = `${schedule.nom} (${schedule.heureDebut} - ${schedule.heureFin})`;
                    scheduleSelect.appendChild(option);
                });
            }
        }
        
        if (window.location.hash !== '#students' && window.location.hash !== '#attendance' && window.location.hash !== '#dashboard') {
            await loadSchedulesList();
        }
    } catch (error) {
        console.error('Erreur lors du chargement des créneaux:', error);
    }
}

// Fonction pour charger la liste complète des créneaux dans la page admin
async function loadSchedulesList() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl('/schedules'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const schedulesContainer = document.getElementById('schedulesList');
            if (schedulesContainer) {
                schedulesContainer.innerHTML = '';
                data.schedules.forEach(schedule => {
                    const scheduleCard = document.createElement('div');
                    scheduleCard.className = 'schedule-card';
                    scheduleCard.innerHTML = `
                        <div class="schedule-info">
                            <h4>${schedule.nom}</h4>
                            <p>${schedule.heureDebut} - ${schedule.heureFin}</p>
                            ${schedule.description ? `<p class="description">${schedule.description}</p>` : ''}
                        </div>
                        <div class="schedule-actions">
                            <button class="btn btn-secondary" onclick="editSchedule(${schedule.id})">
                                <i class="fas fa-edit"></i> Modifier
                            </button>
                            <button class="btn btn-error" onclick="deleteSchedule(${schedule.id})">
                                <i class="fas fa-trash"></i> Supprimer
                            </button>
                        </div>
                    `;
                    schedulesContainer.appendChild(scheduleCard);
                });
                
                if (data.schedules.length === 0) {
                    schedulesContainer.innerHTML = `
                        <div class="no-schedules">
                            <i class="fas fa-clock"></i>
                            <h3>Aucun créneau configuré</h3>
                            <p>Créez votre premier créneau pour commencer à organiser les appels.</p>
                        </div>
                    `;
                }
            }
        }
    } catch (error) {
        console.error('Erreur lors du chargement de la liste des créneaux:', error);
    }
}

// Afficher le modal pour créer un nouveau créneau
function showCreateScheduleModal() {
    document.getElementById('scheduleModalTitle').textContent = 'Nouveau créneau';
    document.getElementById('scheduleForm').reset();
    document.getElementById('scheduleId').value = '';
    document.getElementById('saveScheduleBtn').textContent = 'Enregistrer';
    document.getElementById('scheduleModal').style.display = 'flex';
}

// Éditer un créneau existant
async function editSchedule(scheduleId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${getApiUrl('/schedules')}/${scheduleId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const schedule = data.schedule;
            
            document.getElementById('scheduleModalTitle').textContent = 'Modifier le créneau';
            document.getElementById('scheduleId').value = scheduleId;
            document.getElementById('scheduleName').value = schedule.nom;
            document.getElementById('scheduleStartTime').value = schedule.heureDebut;
            document.getElementById('scheduleEndTime').value = schedule.heureFin;
            document.getElementById('scheduleDescription').value = schedule.description || '';
            document.getElementById('saveScheduleBtn').textContent = 'Mettre à jour';
            
            document.getElementById('scheduleModal').style.display = 'flex';
        } else {
            showError('Impossible de charger les détails du créneau');
        }
    } catch (error) {
        console.error('Erreur lors du chargement du créneau:', error);
        showError('Erreur lors du chargement du créneau');
    }
}

// Supprimer un créneau
async function deleteSchedule(scheduleId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce créneau ? Toutes les feuilles d\'appel l\'utilisant seront affectées.')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${getApiUrl('/schedules')}/${scheduleId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showSuccess('Créneau supprimé avec succès');
            await loadSchedulesList();
            await loadSchedules();
        } else {
            const errorData = await response.json();
            showError(errorData.message || 'Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        showError('Erreur lors de la suppression');
    }
}

// Fonction pour charger les créneaux dans le filtre
async function loadSchedulesForFilter() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl('/schedules'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const attendanceSchedule = document.getElementById('attendanceSchedule');
            if (attendanceSchedule) {
                attendanceSchedule.innerHTML = '<option value="">Tous les créneaux</option>';
                data.schedules.forEach(schedule => {
                    const option = document.createElement('option');
                    option.value = schedule.id;
                    option.textContent = `${schedule.nom} (${schedule.heureDebut} - ${schedule.heureFin})`;
                    attendanceSchedule.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Erreur lors du chargement des créneaux:', error);
    }
}

// Fonction pour charger les créneaux dans le modal d'export personnalisé
async function loadSchedulesForCustomExport() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl('/schedules'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const scheduleSelect = document.getElementById('customExportSchedule');
            if (scheduleSelect) {
                scheduleSelect.innerHTML = '<option value="">Tous les créneaux</option>';
                data.schedules.forEach(schedule => {
                    const option = document.createElement('option');
                    option.value = schedule.id;
                    option.textContent = `${schedule.nom} (${schedule.heureDebut} - ${schedule.heureFin})`;
                    scheduleSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Erreur lors du chargement des créneaux:', error);
    }
}

// Initialiser le gestionnaire de formulaire de créneau
function initScheduleFormHandler() {
    const scheduleForm = document.getElementById('scheduleForm');
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const scheduleId = formData.get('scheduleId');
            const scheduleData = {
                nom: formData.get('name'),
                heureDebut: formData.get('startTime'),
                heureFin: formData.get('endTime'),
                description: formData.get('description') || ''
            };

            try {
                const token = localStorage.getItem('token');
                const url = scheduleId ? `${getApiUrl('/schedules')}/${scheduleId}` : getApiUrl('/schedules');
                const method = scheduleId ? 'PUT' : 'POST';
                
                console.log(`📝 ${method} ${url}:`, scheduleData);
                console.log('📝 Headers:', {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token ? '***' : 'MANQUANT'}`
                });
                
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(scheduleData)
                });
                
                console.log('📝 Réponse reçue:', response.status, response.statusText);

                if (response.ok) {
                    const data = await response.json();
                    showSuccess(scheduleId ? 'Créneau modifié avec succès' : 'Créneau créé avec succès');
                    hideModal('scheduleModal');
                    await loadSchedulesList();
                    await loadSchedules();
                } else {
                    const errorData = await response.json();
                    showError(errorData.message || 'Erreur lors de la sauvegarde');
                }
            } catch (error) {
                console.error('Erreur lors de la sauvegarde:', error);
                showError('Erreur lors de la sauvegarde');
            }
        });
    }
}
