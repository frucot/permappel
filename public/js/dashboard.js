// ===== GESTION DU TABLEAU DE BORD =====

// Charger les données du tableau de bord
async function loadDashboardData() {
    console.log('🔄 Début du chargement des données du dashboard...');
    
    try {
        // Afficher les indicateurs de chargement
        const currentScheduleCard = document.getElementById('currentScheduleCard');
        const dailyStatsCard = document.getElementById('dailyStatsCard');
        
        if (currentScheduleCard) {
            currentScheduleCard.innerHTML = '<div class="loading">Chargement du créneau en cours...</div>';
        } else {
            console.warn('⚠️ Élément currentScheduleCard non trouvé pour l\'affichage du chargement');
        }
        if (dailyStatsCard) {
            dailyStatsCard.innerHTML = '<div class="loading">Chargement des statistiques...</div>';
        } else {
            console.warn('⚠️ Élément dailyStatsCard non trouvé pour l\'affichage du chargement');
        }
        
        await Promise.all([
            loadCurrentSchedule(),
            loadDailyStats(),
            loadSchool()
        ]);
        
        console.log('✅ Toutes les données du dashboard ont été chargées avec succès');
    } catch (error) {
        console.error('❌ Erreur lors du chargement des données du dashboard:', error);
        
        // Afficher un message d'erreur dans les cartes
        const currentScheduleCard = document.getElementById('currentScheduleCard');
        const dailyStatsCard = document.getElementById('dailyStatsCard');
        
        if (currentScheduleCard) {
            currentScheduleCard.innerHTML = '<div class="loading error">Erreur lors du chargement du créneau</div>';
        }
        if (dailyStatsCard) {
            dailyStatsCard.innerHTML = '<div class="loading error">Erreur lors du chargement des statistiques</div>';
        }
    }
}

// Charger le créneau en cours
async function loadCurrentSchedule() {
    try {
        const token = localStorage.getItem('token');
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const today = now.toISOString().split('T')[0];

        const schedulesResponse = await fetch(getApiUrl('/schedules'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!schedulesResponse.ok) {
            throw new Error('Erreur lors du chargement des créneaux');
        }

        const schedulesData = await schedulesResponse.json();
        const schedules = schedulesData.schedules || [];

        const currentSchedule = schedules.find(schedule => {
            return currentTime >= schedule.heureDebut && currentTime <= schedule.heureFin;
        });

        const cardElement = document.getElementById('currentScheduleCard');
        if (!cardElement) {
            console.warn('⚠️ Élément currentScheduleCard non trouvé');
            return;
        }

        if (currentSchedule) {
            const attendanceResponse = await fetch(`${getApiUrl('/attendance')}?date=${today}&scheduleId=${currentSchedule.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            let attendanceData = null;
            if (attendanceResponse.ok) {
                const data = await attendanceResponse.json();
                attendanceData = data.attendances && data.attendances[0] ? data.attendances[0] : null;
            }

            cardElement.innerHTML = `
                <div class="current-schedule-info">
                    <div class="schedule-details">
                        <h4>${currentSchedule.nom}</h4>
                        <div class="schedule-time">
                            <i class="fas fa-clock"></i>
                            ${currentSchedule.heureDebut} - ${currentSchedule.heureFin}
                        </div>
                        ${attendanceData ? `
                            <div class="schedule-stats">
                                <div class="stat-item">
                                    <div class="stat-number">${attendanceData.stats?.present || 0}</div>
                                    <div class="stat-label">Présents</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number">${attendanceData.stats?.absent || 0}</div>
                                    <div class="stat-label">Absents</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number">${attendanceData.stats?.cdi || 0}</div>
                                    <div class="stat-label">CDI</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number">${attendanceData.stats?.excused || 0}</div>
                                    <div class="stat-label">Excusés</div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div>
                        ${attendanceData ? `
                            <button class="btn btn-primary" onclick="openAttendance('${attendanceData.id}')">
                                <i class="fas fa-eye"></i>
                                Ouvrir l'appel
                            </button>
                        ` : `
                            <button class="btn btn-secondary" onclick="createQuickCall('${currentSchedule.id}')">
                                <i class="fas fa-plus"></i>
                                Créer un appel
                            </button>
                        `}
                    </div>
                </div>
            `;
        } else {
            cardElement.innerHTML = `
                <div class="no-current-schedule">
                    <i class="fas fa-clock"></i>
                    <h4>Aucun créneau en cours</h4>
                    <p>Il n'y a pas de créneau actif en ce moment.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erreur lors du chargement du créneau en cours:', error);
        const cardElement = document.getElementById('currentScheduleCard');
        if (cardElement) {
            cardElement.innerHTML = '<div class="loading">Erreur lors du chargement</div>';
        }
    }
}

// Charger les statistiques de la journée
async function loadDailyStats() {
    try {
        const token = localStorage.getItem('token');
        const today = new Date().toISOString().split('T')[0];

        const response = await fetch(`${getApiUrl('/attendance')}?date=${today}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Erreur lors du chargement des statistiques');
        }

        const data = await response.json();
        const attendances = data.attendances || [];

        let totalPresent = 0;
        let totalAbsent = 0;
        let totalCdi = 0;
        let totalExcused = 0;

        attendances.forEach(attendance => {
            totalPresent += attendance.stats?.present || 0;
            totalAbsent += attendance.stats?.absent || 0;
            totalCdi += attendance.stats?.cdi || 0;
            totalExcused += attendance.stats?.excused || 0;
        });

        const cardElement = document.getElementById('dailyStatsCard');
        if (!cardElement) {
            console.warn('⚠️ Élément dailyStatsCard non trouvé');
            return;
        }

        cardElement.innerHTML = `
            <div class="daily-stats-grid">
                <div class="daily-stat-card present">
                    <div class="daily-stat-number">${totalPresent}</div>
                    <div class="daily-stat-label">Présents</div>
                </div>
                <div class="daily-stat-card absent">
                    <div class="daily-stat-number">${totalAbsent}</div>
                    <div class="daily-stat-label">Absents</div>
                </div>
                <div class="daily-stat-card cdi">
                    <div class="daily-stat-number">${totalCdi}</div>
                    <div class="daily-stat-label">CDI</div>
                </div>
                <div class="daily-stat-card excused">
                    <div class="daily-stat-number">${totalExcused}</div>
                    <div class="daily-stat-label">Excusés</div>
                </div>
            </div>
            <div class="daily-summary">
                <p><strong>Total des appels :</strong> ${attendances.length} créneau${attendances.length > 1 ? 'x' : ''}</p>
            </div>
        `;
    } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
        const cardElement = document.getElementById('dailyStatsCard');
        if (cardElement) {
            cardElement.innerHTML = '<div class="loading">Erreur lors du chargement</div>';
        }
    }
}

// Créer un appel rapide
async function createQuickCall(scheduleId) {
    try {
        const token = localStorage.getItem('token');
        const today = new Date().toISOString().split('T')[0];

        const [groupsResponse, classesResponse] = await Promise.all([
            fetch(getApiUrl('/students/groups/list'), {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(getApiUrl('/students/classes/list'), {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        const groupsData = await groupsResponse.json();
        const classesData = await classesResponse.json();

        const quickGroups = groupsData.groups.slice(0, 3);
        const quickClasses = classesData.classes.slice(0, 2);

        const callData = {
            date: today,
            creneauId: scheduleId,
            groups: quickGroups,
            classes: quickClasses
        };

        const response = await fetch(getApiUrl('/attendance'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(callData)
        });

        if (response.ok) {
            const data = await response.json();
            showSuccess('Appel créé avec succès');
            loadDashboardData();
            
            if (data.attendanceId) {
                openAttendanceWindow(`attendance.html?id=${data.attendanceId}`);
            }
        } else {
            const errorData = await response.json();
            showError(errorData.message || 'Erreur lors de la création de l\'appel');
        }
    } catch (error) {
        console.error('Erreur lors de la création de l\'appel rapide:', error);
        showError('Erreur lors de la création de l\'appel');
    }
}

// Afficher la modale des élèves absents
async function showAbsentStudentsModal() {
    try {
        const token = localStorage.getItem('token');
        const today = new Date().toISOString().split('T')[0];

        await loadAbsentFilters();
        await loadAbsentStudents(today);

        showModal('absentStudentsModal');
    } catch (error) {
        console.error('Erreur lors de l\'ouverture de la modale des absents:', error);
        showError('Erreur lors du chargement des données');
    }
}

// Charger les filtres pour la modale des absents
async function loadAbsentFilters() {
    try {
        const token = localStorage.getItem('token');

        const schedulesResponse = await fetch(getApiUrl('/schedules'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (schedulesResponse.ok) {
            const schedulesData = await schedulesResponse.json();
            const scheduleSelect = document.getElementById('absentScheduleFilter');
            if (scheduleSelect) {
                scheduleSelect.innerHTML = '<option value="">Tous les créneaux</option>';
                schedulesData.schedules.forEach(schedule => {
                    const option = document.createElement('option');
                    option.value = schedule.id;
                    option.textContent = `${schedule.nom} (${schedule.heureDebut} - ${schedule.heureFin})`;
                    scheduleSelect.appendChild(option);
                });
            }
        }

        const classesResponse = await fetch(getApiUrl('/students/classes/list'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (classesResponse.ok) {
            const classesData = await classesResponse.json();
            const classSelect = document.getElementById('absentClassFilter');
            if (classSelect) {
                classSelect.innerHTML = '<option value="">Toutes les classes</option>';
                classesData.classes.forEach(className => {
                    const option = document.createElement('option');
                    option.value = className;
                    option.textContent = className;
                    classSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Erreur lors du chargement des filtres:', error);
    }
}

// Charger les élèves absents
async function loadAbsentStudents(date, scheduleId = '', className = '') {
    try {
        const token = localStorage.getItem('token');
        let url = `${getApiUrl('/attendance')}?date=${date}`;
        
        if (scheduleId) {
            url += `&scheduleId=${scheduleId}`;
        }

        console.log('🔍 Chargement des élèves absents pour:', date, 'scheduleId:', scheduleId, 'className:', className);

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Erreur lors du chargement des données');
        }

        const data = await response.json();
        const attendances = data.attendances || [];
        console.log('📊 Feuilles d\'appel trouvées:', attendances.length);

        const absentStudents = [];
        
        for (const attendance of attendances) {
            console.log('🔍 Traitement de la feuille d\'appel:', attendance.id);
            
            const detailResponse = await fetch(`${getApiUrl('/attendance')}/${attendance.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (detailResponse.ok) {
                const detailData = await detailResponse.json();
                const students = detailData.attendance?.students || [];
                console.log(`📊 ${students.length} élèves trouvés dans la feuille ${attendance.id}`);
                
                students.forEach(student => {
                    const studentStatus = student.status || student.statut;
                    console.log(`👤 ${student.firstName || student.prenom} ${student.lastName || student.nom} - Statut: ${studentStatus}`);
                    
                    if (studentStatus === 'absent' || 
                        studentStatus === 'Absent' || 
                        studentStatus === 'ABSENT' ||
                        studentStatus === 'Absence' ||
                        studentStatus === 'ABSENCE') {
                        
                        console.log(`❌ Élève absent trouvé: ${student.firstName || student.prenom} ${student.lastName || student.nom}`);
                        
                        if (!className || student.class === className || student.classe === className) {
                            absentStudents.push({
                                ...student,
                                scheduleName: attendance.schedule?.name || 'Créneau',
                                scheduleTime: `${attendance.schedule?.startTime || ''} - ${attendance.schedule?.endTime || ''}`
                            });
                        }
                    }
                });
            } else {
                console.warn('⚠️ Impossible de récupérer les détails de la feuille', attendance.id);
            }
        }

        console.log('📊 Total des élèves absents trouvés:', absentStudents.length);

        const listElement = document.getElementById('absentStudentsList');
        if (!listElement) return;

        if (absentStudents.length === 0) {
            listElement.innerHTML = `
                <div class="no-absent-students">
                    <i class="fas fa-check-circle"></i>
                    <h4>Aucun élève absent</h4>
                    <p>Tous les élèves sont présents aujourd'hui !</p>
                </div>
            `;
        } else {
            listElement.innerHTML = absentStudents.map(student => `
                <div class="absent-student-item">
                    <div class="absent-student-info">
                        <div class="absent-student-name">${student.firstName || student.prenom} ${student.lastName || student.nom}</div>
                        <div class="absent-student-class">Classe: ${student.class || student.classe}</div>
                    </div>
                    <div class="absent-student-schedule">${student.scheduleName}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Erreur lors du chargement des élèves absents:', error);
        const listElement = document.getElementById('absentStudentsList');
        if (listElement) {
            listElement.innerHTML = '<div class="loading">Erreur lors du chargement</div>';
        }
    }
}

// Filtrer les élèves absents
function filterAbsentStudents() {
    const scheduleId = document.getElementById('absentScheduleFilter')?.value || '';
    const className = document.getElementById('absentClassFilter')?.value || '';
    const today = new Date().toISOString().split('T')[0];
    
    loadAbsentStudents(today, scheduleId, className);
}
