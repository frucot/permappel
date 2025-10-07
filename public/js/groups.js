// ===== GESTION DES GROUPES =====

// Variables globales
let groups = [];

// Initialiser la gestion des groupes
function initGroupsManagement() {
    // Gestionnaire pour le bouton de gestion des groupes
    const manageGroupsBtn = document.getElementById('manageGroupsBtn');
    
    if (manageGroupsBtn) {
        manageGroupsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showManageGroupsModal();
        });
    }

    // Gestionnaire pour le formulaire d'ajout de groupe
    const addGroupForm = document.getElementById('addGroupForm');
    
    if (addGroupForm) {
        addGroupForm.addEventListener('submit', handleAddGroup);
    }
}

// Afficher la modale de gestion des groupes
async function showManageGroupsModal() {
    showModal('manageGroupsModal');
    
    // Attendre que la modale soit visible dans le DOM
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Charger les groupes directement
    try {
        const response = await fetch(getApiUrl('/students/groups/list'), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) {
            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.groups) {
            groups = data.groups;
            displayGroups();
        } else {
            throw new Error('Format de données invalide');
        }
    } catch (error) {
        console.error('Erreur lors du chargement des groupes:', error);
        const groupsList = document.getElementById('groupsList');
        if (groupsList) {
            groupsList.innerHTML = `
                <div class="no-groups">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erreur lors du chargement des groupes</p>
                    <button class="btn btn-sm btn-primary" onclick="showManageGroupsModal()">Réessayer</button>
                </div>
            `;
        }
    }
}

// Charger la liste des groupes
async function loadGroups() {
    console.log('🔄 loadGroups() appelée - DÉBUT');
    
    try {
        console.log('📡 Envoi de la requête API...');
        const response = await fetch(getApiUrl('/students/groups/list'), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        console.log('📡 Réponse reçue:', response.status, response.statusText);

        if (!response.ok) {
            console.error('❌ Erreur HTTP:', response.status, response.statusText);
            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📊 Données reçues:', data);
        
        if (data.success && data.groups) {
            console.log('✅ Données valides, mise à jour du tableau groups');
            groups = data.groups;
            console.log('📊 Tableau groups mis à jour:', groups);
            console.log('🔄 Appel de displayGroups()...');
            displayGroups();
            console.log('✅ displayGroups() appelée');
        } else {
            console.error('❌ Format de données invalide:', data);
            throw new Error('Format de données invalide');
        }
    } catch (error) {
        console.error('❌ Erreur lors du chargement des groupes:', error);
        const groupsList = document.getElementById('groupsList');
        if (groupsList) {
            groupsList.innerHTML = `
                <div class="no-groups">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erreur lors du chargement des groupes</p>
                    <button class="btn btn-sm btn-primary" onclick="loadGroups()">Réessayer</button>
                </div>
            `;
        }
        if (typeof showError === 'function') {
            showError('Erreur lors du chargement des groupes: ' + error.message);
        }
    }
    
    console.log('🔄 loadGroups() appelée - FIN');
}

// Afficher la liste des groupes
function displayGroups() {
    const groupsList = document.getElementById('groupsList');
    
    if (!groupsList) {
        console.error('Élément groupsList non trouvé');
        return;
    }

    if (groups.length === 0) {
        groupsList.innerHTML = `
            <div class="no-groups">
                <i class="fas fa-layer-group"></i>
                <p>Aucun groupe créé pour le moment</p>
            </div>
        `;
        return;
    }

    groupsList.innerHTML = groups.map(group => {
        // Gérer les deux formats possibles : { id, name } ou string
        const groupId = group.id || group;
        const groupName = group.name || group;
        
        return `
            <div class="group-item" data-group-id="${groupId}">
                <div class="group-name">${groupName}</div>
                <div class="group-actions">
                    <button class="btn btn-sm btn-secondary" onclick="editGroup(${groupId}, '${groupName.replace(/'/g, "\\'")}')">
                        <i class="fas fa-edit"></i>
                        Modifier
                    </button>
                    <button class="btn btn-sm btn-error" onclick="deleteGroup(${groupId}, '${groupName.replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash"></i>
                        Supprimer
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Gérer l'ajout d'un nouveau groupe
async function handleAddGroup(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const groupName = formData.get('groupName').trim();
    
    if (!groupName) {
        showError('Le nom du groupe est requis');
        return;
    }

    try {
        const response = await fetch(getApiUrl('/students/groups'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ groupName })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess(data.message);
            e.target.reset();
            await loadGroups();
            // Rafraîchir les listes de groupes dans les autres modales
            refreshGroupLists();
        } else {
            showError(data.message || 'Erreur lors de la création du groupe');
        }
    } catch (error) {
        console.error('Erreur lors de la création du groupe:', error);
        showError('Erreur lors de la création du groupe');
    }
}

// Modifier un groupe
async function editGroup(groupId, currentName) {
    const newName = prompt('Modifier le nom du groupe:', currentName);
    
    if (newName === null) return; // Annulé
    
    const trimmedName = newName.trim();
    if (!trimmedName) {
        showError('Le nom du groupe ne peut pas être vide');
        return;
    }

    if (trimmedName === currentName) {
        return; // Aucun changement
    }

    try {
        const response = await fetch(`${getApiUrl('/students/groups')}/${groupId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ groupName: trimmedName })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess(data.message);
            await loadGroups();
            // Rafraîchir les listes de groupes dans les autres modales
            refreshGroupLists();
        } else {
            showError(data.message || 'Erreur lors de la modification du groupe');
        }
    } catch (error) {
        console.error('Erreur lors de la modification du groupe:', error);
        showError('Erreur lors de la modification du groupe');
    }
}

// Supprimer un groupe
async function deleteGroup(groupId, groupName) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le groupe "${groupName}" ?\n\nCette action est irréversible.`)) {
        return;
    }

    try {
        const response = await fetch(`${getApiUrl('/students/groups')}/${groupId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        const data = await response.json();

        if (data.success) {
            showSuccess(data.message);
            await loadGroups();
            // Rafraîchir les listes de groupes dans les autres modales
            refreshGroupLists();
        } else {
            showError(data.message || 'Erreur lors de la suppression du groupe');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression du groupe:', error);
        showError('Erreur lors de la suppression du groupe');
    }
}

// Rafraîchir la liste des groupes dans la modale
async function refreshGroupsList() {
    const groupsList = document.getElementById('groupsList');
    if (groupsList) {
        groupsList.innerHTML = '<div class="loading">Rafraîchissement...</div>';
    }
    
    try {
        const response = await fetch(getApiUrl('/students/groups/list'), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) {
            throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.groups) {
            groups = data.groups;
            displayGroups();
            showSuccess('Liste des groupes rafraîchie');
        } else {
            throw new Error('Format de données invalide');
        }
    } catch (error) {
        console.error('Erreur lors du rafraîchissement des groupes:', error);
        if (groupsList) {
            groupsList.innerHTML = `
                <div class="no-groups">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erreur lors du rafraîchissement</p>
                    <button class="btn btn-sm btn-primary" onclick="refreshGroupsList()">Réessayer</button>
                </div>
            `;
        }
        showError('Erreur lors du rafraîchissement des groupes');
    }
}

// Rafraîchir les listes de groupes dans les autres modales
function refreshGroupLists() {
    // Rafraîchir les groupes pour l'ajout d'élève
    if (typeof loadGroupsForAdd === 'function') {
        loadGroupsForAdd();
    }
    
    // Rafraîchir les groupes pour la modification d'élève
    if (typeof loadGroupsForEdit === 'function') {
        loadGroupsForEdit();
    }
    
    // Rafraîchir les groupes pour les appels
    if (typeof loadGroupsForCall === 'function') {
        loadGroupsForCall();
    }
    
    // Rafraîchir les filtres de groupes
    if (typeof loadGroupFilters === 'function') {
        loadGroupFilters();
    }
}

// Exposer les fonctions globalement
window.showManageGroupsModal = showManageGroupsModal;
window.editGroup = editGroup;
window.deleteGroup = deleteGroup;
window.loadGroups = loadGroups;
window.refreshGroupsList = refreshGroupsList;

// Module chargé
console.log('🔧 Module groups.js chargé');
