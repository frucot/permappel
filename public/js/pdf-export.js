// ===== EXPORT PDF =====

// Fonction pour attendre que jsPDF soit chargé
function waitForJsPDF() {
    return new Promise((resolve, reject) => {
        console.log('🔍 Vérification du chargement de jsPDF...');
        
        if (typeof window.jspdf !== 'undefined') {
            console.log('✅ jsPDF est déjà chargé');
            resolve();
            return;
        }
        
        if (window.jspdfError) {
            console.error('❌ Erreur de chargement jsPDF détectée');
            reject(new Error('jsPDF n\'a pas pu être chargé depuis les CDN'));
            return;
        }
        
        let attempts = 0;
        const maxAttempts = 100;
        
        console.log('⏳ Attente du chargement de jsPDF...');
        
        const checkInterval = setInterval(() => {
            attempts++;
            console.log(`🔄 Tentative ${attempts}/${maxAttempts} - jsPDF chargé: ${typeof window.jspdf !== 'undefined'}`);
            
            if (typeof window.jspdf !== 'undefined') {
                console.log('✅ jsPDF chargé avec succès !');
                clearInterval(checkInterval);
                resolve();
            } else if (window.jspdfError || attempts >= maxAttempts) {
                console.error('❌ Timeout ou erreur de chargement jsPDF');
                clearInterval(checkInterval);
                reject(new Error('jsPDF n\'a pas pu être chargé. Vérifiez votre connexion internet.'));
            }
        }, 100);
    });
}

// Fonction pour exporter une feuille d'appel individuelle
async function exportSingleAttendance(attendanceId) {
    try {
        await waitForJsPDF();
        
        showNotification('Génération du PDF en cours...', 'info');
        
        const token = localStorage.getItem('token');
        
        const response = await fetch(`${getApiUrl('/attendance')}/${attendanceId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error('Erreur lors du chargement de la feuille d\'appel');
        }
        
        const data = await response.json();
        const attendance = data.attendance;
        
        if (!attendance) {
            showError('Feuille d\'appel non trouvée');
            return;
        }
        
        const configResponse = await fetch(getApiUrl('/admin/config'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        let establishmentInfo = {
            nom: 'Établissement',
            adresse: 'Adresse non renseignée',
            telephone: 'Tél: Non renseigné'
        };
        
        if (configResponse.ok) {
            const configData = await configResponse.json();
            establishmentInfo = {
                nom: configData.nom || 'Établissement',
                adresse: configData.adresse || 'Adresse non renseignée',
                telephone: configData.telephone ? `Tél: ${configData.telephone}` : 'Tél: Non renseigné'
            };
        }
        
        generateAttendancePDF([attendance], establishmentInfo, attendance.date);
        
    } catch (error) {
        console.error('Erreur lors de l\'export:', error);
        showError('Erreur lors de l\'export PDF: ' + error.message);
    }
}

// Fonction pour afficher le modal d'export personnalisé
function showCustomExportModal() {
    loadSchedulesForCustomExport();
    
    const customExportForm = document.getElementById('customExportForm');
    if (customExportForm) customExportForm.reset();
    
    showModal('customExportModal');
}

// Fonction pour exporter une période personnalisée
async function exportCustomPeriod() {
    try {
        await waitForJsPDF();
        
        showNotification('Génération du PDF en cours...', 'info');
        
        const token = localStorage.getItem('token');
        
        const formData = new FormData(document.getElementById('customExportForm'));
        const startDate = formData.get('startDate');
        const endDate = formData.get('endDate');
        const scheduleId = formData.get('scheduleId');
        
        if (!startDate || !endDate) {
            showError('Veuillez sélectionner une date de début et une date de fin');
            return;
        }
        
        if (new Date(startDate) > new Date(endDate)) {
            showError('La date de début doit être antérieure à la date de fin');
            return;
        }
        
        let url = `${getApiUrl('/attendance')}?startDate=${startDate}&endDate=${endDate}`;
        if (scheduleId) {
            url += `&scheduleId=${scheduleId}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error('Erreur lors du chargement des données');
        }
        
        const data = await response.json();
        const attendancesList = data.attendances || [];
        
        if (attendancesList.length === 0) {
            showError('Aucune feuille d\'appel trouvée pour cette période');
            return;
        }
        
        console.log('📊 Récupération des détails de', attendancesList.length, 'feuilles d\'appel...');
        const attendances = [];
        
        for (const attendanceSummary of attendancesList) {
            try {
                const detailResponse = await fetch(`${getApiUrl('/attendance')}/${attendanceSummary.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (detailResponse.ok) {
                    const detailData = await detailResponse.json();
                    attendances.push(detailData.attendance);
                    console.log(`✅ Détails récupérés pour ${attendanceSummary.id}: ${detailData.attendance.students?.length || 0} élèves`);
                } else {
                    console.warn(`⚠️ Impossible de récupérer les détails pour ${attendanceSummary.id}`);
                }
            } catch (error) {
                console.error(`❌ Erreur lors de la récupération des détails pour ${attendanceSummary.id}:`, error);
            }
        }
        
        if (attendances.length === 0) {
            showError('Aucune donnée d\'élève trouvée pour les feuilles d\'appel');
            return;
        }
        
        const configResponse = await fetch(getApiUrl('/admin/config'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        let establishmentInfo = {
            nom: 'Établissement',
            adresse: 'Adresse non renseignée',
            telephone: 'Tél: Non renseigné'
        };
        
        if (configResponse.ok) {
            const configData = await configResponse.json();
            establishmentInfo = {
                nom: configData.nom || 'Établissement',
                adresse: configData.adresse || 'Adresse non renseignée',
                telephone: configData.telephone ? `Tél: ${configData.telephone}` : 'Tél: Non renseigné'
            };
        }
        
        generateCustomAttendancePDF(attendances, establishmentInfo, startDate, endDate);
        
        hideModal('customExportModal');
        
    } catch (error) {
        console.error('Erreur lors de l\'export:', error);
        showError('Erreur lors de l\'export PDF: ' + error.message);
    }
}

// Fonction pour exporter les appels du jour
async function exportDayAttendance() {
    try {
        await waitForJsPDF();
        
        showNotification('Génération du PDF en cours...', 'info');
        
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
        
        if (!response.ok) {
            throw new Error('Erreur lors du chargement des données');
        }
        
        const data = await response.json();
        const attendancesList = data.attendances || [];
        
        if (attendancesList.length === 0) {
            showError('Aucune feuille d\'appel trouvée pour cette date');
            return;
        }
        
        console.log('📊 Récupération des détails de', attendancesList.length, 'feuilles d\'appel...');
        const attendances = [];
        
        for (const attendanceSummary of attendancesList) {
            try {
                const detailResponse = await fetch(`${getApiUrl('/attendance')}/${attendanceSummary.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (detailResponse.ok) {
                    const detailData = await detailResponse.json();
                    attendances.push(detailData.attendance);
                    console.log(`✅ Détails récupérés pour ${attendanceSummary.id}: ${detailData.attendance.students?.length || 0} élèves`);
                } else {
                    console.warn(`⚠️ Impossible de récupérer les détails pour ${attendanceSummary.id}`);
                }
            } catch (error) {
                console.error(`❌ Erreur lors de la récupération des détails pour ${attendanceSummary.id}:`, error);
            }
        }
        
        if (attendances.length === 0) {
            showError('Aucune donnée d\'élève trouvée pour les feuilles d\'appel');
            return;
        }
        
        const configResponse = await fetch(getApiUrl('/admin/config'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        let establishmentInfo = {
            nom: 'Établissement',
            adresse: 'Adresse non renseignée',
            telephone: 'Tél: Non renseigné'
        };
        
        if (configResponse.ok) {
            const configData = await configResponse.json();
            establishmentInfo = {
                nom: configData.nom || 'Établissement',
                adresse: configData.adresse || 'Adresse non renseignée',
                telephone: configData.telephone ? `Tél: ${configData.telephone}` : 'Tél: Non renseigné'
            };
        }
        
        generateAttendancePDF(attendances, establishmentInfo, date);
        
    } catch (error) {
        console.error('Erreur lors de l\'export:', error);
        showError('Erreur lors de l\'export PDF: ' + error.message);
    }
}

// Fonction pour générer le PDF des feuilles d'appel
function generateAttendancePDF(attendances, establishmentInfo, date) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (2 * margin);
    
    let currentPage = 1;
    let totalPages = 0;
    
    attendances.forEach(attendance => {
        if (attendance.students && attendance.students.length > 0) {
            const studentsPerPage = Math.floor((pageHeight - 200) / 12);
            const pagesForThisAttendance = Math.ceil(attendance.students.length / studentsPerPage);
            totalPages += pagesForThisAttendance;
        } else {
            totalPages += 1;
        }
    });
    
    function addHeader(scheduleName, scheduleTime, attendance) {
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text(establishmentInfo.nom, margin, 15);
        
        doc.setFontSize(6);
        doc.setFont(undefined, 'normal');
        doc.text(establishmentInfo.adresse, margin, 20);
        doc.text(establishmentInfo.telephone, margin, 24);
        
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.text('Feuille de présence du :', margin, 32);
        doc.text(formatDateForPDF(date), margin + 50, 32);
        
        doc.setFontSize(7);
        doc.setFont(undefined, 'normal');
        doc.text(`${scheduleName} (${scheduleTime})`, margin, 38);
        
        if (attendance && attendance.stats) {
            const stats = attendance.stats;
            const statsText = `Présents: ${stats.present || 0} | Absents: ${stats.absent || 0} | CDI: ${stats.cdi || 0} | Excusés: ${stats.excused || 0}`;
            doc.setFontSize(6);
            doc.text(statsText, margin, 43);
        }
        
        // Ligne de séparation sera ajoutée après le tableau
        
        doc.setFontSize(10);
        doc.text(`Page ${currentPage}/${totalPages}`, pageWidth - margin - 30, 30);
    }
    
    function addStudentTable(students, attendance) {
        const startY = 60;
        const rowHeight = 12;
        const colWidths = [50, 50, 25, 35];
        const colPositions = [margin, margin + colWidths[0], margin + colWidths[0] + colWidths[1], margin + colWidths[0] + colWidths[1] + colWidths[2]];
        
        const studentsPerPage = Math.floor((pageHeight - 80) / rowHeight);
        
        for (let pageStart = 0; pageStart < students.length; pageStart += studentsPerPage) {
            const pageStudents = students.slice(pageStart, pageStart + studentsPerPage);
            
            if (pageStart > 0) {
                doc.addPage();
                currentPage++;
                addHeader(attendance.schedule?.name || 'Créneau', 
                         `${attendance.schedule?.startTime || ''} - ${attendance.schedule?.endTime || ''}`, attendance);
            }
            
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.text('Nom', colPositions[0], startY);
            doc.text('Prénom', colPositions[1], startY);
            doc.text('Classe', colPositions[2], startY);
            doc.text('Statut', colPositions[3], startY);
            
            doc.setLineWidth(0.3);
            doc.line(margin, startY + 3, pageWidth - margin, startY + 3);
            
            doc.setFont(undefined, 'normal');
            let currentY = startY + 8;
            
            pageStudents.forEach((student, index) => {
                doc.setLineWidth(0.2);
                doc.rect(margin, currentY - 6, colWidths[0], rowHeight);
                doc.rect(margin + colWidths[0], currentY - 6, colWidths[1], rowHeight);
                doc.rect(margin + colWidths[0] + colWidths[1], currentY - 6, colWidths[2], rowHeight);
                doc.rect(margin + colWidths[0] + colWidths[1] + colWidths[2], currentY - 6, colWidths[3], rowHeight);
                
                doc.setFontSize(9);
                doc.text(student.lastName || student.nom || '', colPositions[0] + 2, currentY);
                doc.text(student.firstName || student.prenom || '', colPositions[1] + 2, currentY);
                doc.text(student.class || student.classe || '', colPositions[2] + 2, currentY);
                
                const status = student.status || student.statut || 'Non appelé';
                let statusText = status;
                if (status === 'present') statusText = 'Présent';
                else if (status === 'absent') statusText = 'Absent';
                else if (status === 'cdi') statusText = 'Présent (CDI)';
                else if (status === 'excused') statusText = 'Excusé';
                else if (status === 'late') statusText = 'Absence prévue';
                
                doc.text(statusText, colPositions[3] + 2, currentY);
                
                currentY += rowHeight;
            });
        }
    }
    
    function addFooter() {
        const now = new Date();
        const exportDate = now.toLocaleDateString('fr-FR') + ' ' + now.toLocaleTimeString('fr-FR');
        
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(`Imprimé le ${exportDate}`, margin, pageHeight - 20);
    }
    
    attendances.forEach((attendance, index) => {
        if (index > 0) {
            doc.addPage();
            currentPage++;
        }
        
        const scheduleName = attendance.schedule?.name || 'Créneau';
        const scheduleTime = `${attendance.schedule?.startTime || ''} - ${attendance.schedule?.endTime || ''}`;
        
        addHeader(scheduleName, scheduleTime, attendance);
        
        if (attendance.students && attendance.students.length > 0) {
            addStudentTable(attendance.students, attendance);
        } else {
            doc.setFontSize(12);
            doc.text('Aucun élève trouvé pour ce créneau', margin, 140);
        }
        
        addFooter();
    });
    
    let fileName;
    if (attendances.length === 1) {
        const attendance = attendances[0];
        const scheduleName = attendance.schedule?.name || 'Creneau';
        fileName = `feuille_presence_${date.replace(/-/g, '_')}_${scheduleName}.pdf`;
    } else {
        fileName = `feuilles_presence_${date.replace(/-/g, '_')}.pdf`;
    }
    doc.save(fileName);
    
    showSuccess('PDF généré avec succès');
}

// Fonction pour générer le PDF avec nom de fichier personnalisé
function generateCustomAttendancePDF(attendances, establishmentInfo, startDate, endDate) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (2 * margin);
    
    let currentPage = 1;
    let totalPages = 0;
    
    attendances.forEach(attendance => {
        if (attendance.students && attendance.students.length > 0) {
            const studentsPerPage = Math.floor((pageHeight - 200) / 12);
            const pagesForThisAttendance = Math.ceil(attendance.students.length / studentsPerPage);
            totalPages += pagesForThisAttendance;
        } else {
            totalPages += 1;
        }
    });
    
    function addHeader(scheduleName, scheduleTime, attendance) {
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text(establishmentInfo.nom, margin, 15);
        
        doc.setFontSize(6);
        doc.setFont(undefined, 'normal');
        doc.text(establishmentInfo.adresse, margin, 20);
        doc.text(establishmentInfo.telephone, margin, 24);
        
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.text('Feuilles de présence du :', margin, 32);
        doc.text(formatDateForPDF(startDate), margin + 50, 32);
        doc.text('au', margin + 80, 32);
        doc.text(formatDateForPDF(endDate), margin + 90, 32);
        
        doc.setFontSize(7);
        doc.setFont(undefined, 'normal');
        doc.text(`${scheduleName} (${scheduleTime})`, margin, 38);
        
        if (attendance && attendance.stats) {
            const stats = attendance.stats;
            const statsText = `Présents: ${stats.present || 0} | Absents: ${stats.absent || 0} | CDI: ${stats.cdi || 0} | Excusés: ${stats.excused || 0}`;
            doc.setFontSize(6);
            doc.text(statsText, margin, 43);
        }
        
        // Ligne de séparation sera ajoutée après le tableau
        
        doc.setFontSize(10);
        doc.text(`Page ${currentPage}/${totalPages}`, pageWidth - margin - 30, 30);
    }
    
    function addStudentTable(students, attendance) {
        const startY = 60;
        const rowHeight = 12;
        const colWidths = [50, 50, 25, 35];
        const colPositions = [margin, margin + colWidths[0], margin + colWidths[0] + colWidths[1], margin + colWidths[0] + colWidths[1] + colWidths[2]];
        
        const studentsPerPage = Math.floor((pageHeight - 80) / rowHeight);
        
        for (let pageStart = 0; pageStart < students.length; pageStart += studentsPerPage) {
            const pageStudents = students.slice(pageStart, pageStart + studentsPerPage);
            
            if (pageStart > 0) {
                doc.addPage();
                currentPage++;
                addHeader(attendance.schedule?.name || 'Créneau', 
                         `${attendance.schedule?.startTime || ''} - ${attendance.schedule?.endTime || ''}`, attendance);
            }
            
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.text('Nom', colPositions[0], startY);
            doc.text('Prénom', colPositions[1], startY);
            doc.text('Classe', colPositions[2], startY);
            doc.text('Statut', colPositions[3], startY);
            
            doc.setLineWidth(0.3);
            doc.line(margin, startY + 3, pageWidth - margin, startY + 3);
            
            doc.setFont(undefined, 'normal');
            let currentY = startY + 8;
            
            pageStudents.forEach((student, index) => {
                doc.setLineWidth(0.2);
                doc.rect(margin, currentY - 6, colWidths[0], rowHeight);
                doc.rect(margin + colWidths[0], currentY - 6, colWidths[1], rowHeight);
                doc.rect(margin + colWidths[0] + colWidths[1], currentY - 6, colWidths[2], rowHeight);
                doc.rect(margin + colWidths[0] + colWidths[1] + colWidths[2], currentY - 6, colWidths[3], rowHeight);
                
                doc.setFontSize(9);
                doc.text(student.lastName || student.nom || '', colPositions[0] + 2, currentY);
                doc.text(student.firstName || student.prenom || '', colPositions[1] + 2, currentY);
                doc.text(student.class || student.classe || '', colPositions[2] + 2, currentY);
                
                const status = student.status || student.statut || 'Non appelé';
                let statusText = status;
                if (status === 'present') statusText = 'Présent';
                else if (status === 'absent') statusText = 'Absent';
                else if (status === 'cdi') statusText = 'Présent (CDI)';
                else if (status === 'excused') statusText = 'Excusé';
                else if (status === 'late') statusText = 'Absence prévue';
                
                doc.text(statusText, colPositions[3] + 2, currentY);
                
                currentY += rowHeight;
            });
        }
    }
    
    function addFooter() {
        const now = new Date();
        const exportDate = now.toLocaleDateString('fr-FR') + ' ' + now.toLocaleTimeString('fr-FR');
        
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(`Imprimé le ${exportDate}`, margin, pageHeight - 20);
    }
    
    attendances.forEach((attendance, index) => {
        if (index > 0) {
            doc.addPage();
            currentPage++;
        }
        
        const scheduleName = attendance.schedule?.name || 'Créneau';
        const scheduleTime = `${attendance.schedule?.startTime || ''} - ${attendance.schedule?.endTime || ''}`;
        
        addHeader(scheduleName, scheduleTime, attendance);
        
        if (attendance.students && attendance.students.length > 0) {
            addStudentTable(attendance.students, attendance);
        } else {
            doc.setFontSize(12);
            doc.text('Aucun élève trouvé pour ce créneau', margin, 140);
        }
        
        addFooter();
    });
    
    const fileName = `feuilles_presence_${startDate.replace(/-/g, '_')}_au_${endDate.replace(/-/g, '_')}.pdf`;
    doc.save(fileName);
    
    showSuccess('PDF généré avec succès');
}
