// ===== GESTION DE LA BASE DE DONNÉES =====

// Sauvegarder la base de données
async function backupDatabase() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl('/admin/database/backup'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `permappel_backup_${new Date().toISOString().split('T')[0]}.db`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showSuccess('Sauvegarde téléchargée avec succès');
        } else {
            const errorData = await response.json();
            showError(errorData.message || 'Erreur lors de la sauvegarde');
        }
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        showError('Erreur lors de la sauvegarde');
    }
}

// Confirmer la suppression des élèves
function confirmDeleteStudents() {
    document.getElementById('confirmModalTitle').textContent = 'Supprimer les élèves';
    document.getElementById('confirmModalMessage').textContent = 
        'ATTENTION: Cette action supprimera TOUS les élèves et leurs données d\'appel. Les utilisateurs, créneaux et configuration seront conservés. Cette action est irréversible. Êtes-vous sûr ?';
    
    const confirmBtn = document.getElementById('confirmModalBtn');
    confirmBtn.onclick = () => deleteStudents();
    
    showModal('confirmModal');
}

// Supprimer uniquement les élèves
async function deleteStudents() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl('/admin/database/delete-students'), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showSuccess('Données des élèves supprimées avec succès');
            hideModal('confirmModal');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            const errorData = await response.json();
            showError(errorData.message || 'Erreur lors de la suppression des élèves');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression des élèves:', error);
        showError('Erreur lors de la suppression des élèves');
    }
}

// Confirmer la réinitialisation complète de la base de données
function confirmDatabaseReset() {
    document.getElementById('confirmModalTitle').textContent = 'Réinitialiser la base de données';
    document.getElementById('confirmModalMessage').textContent = 
        'ATTENTION: Cette action supprimera TOUTES les données de l\'application (utilisateurs, élèves, appels, créneaux, configuration, etc.). Cette action est irréversible. Êtes-vous absolument sûr ?';
    
    const confirmBtn = document.getElementById('confirmModalBtn');
    confirmBtn.onclick = () => resetDatabase();
    
    showModal('confirmModal');
}

// Réinitialiser complètement la base de données
async function resetDatabase() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl('/admin/database/reset'), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showSuccess('Base de données réinitialisée avec succès');
            hideModal('confirmModal');
            setTimeout(() => {
                localStorage.removeItem('token');
                window.location.href = '/';
            }, 2000);
        } else {
            const errorData = await response.json();
            showError(errorData.message || 'Erreur lors de la réinitialisation');
        }
    } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
        showError('Erreur lors de la réinitialisation');
    }
}
