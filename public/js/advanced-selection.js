// ===== SÉLECTION AVANCÉE DES ÉLÈVES =====

// Variables globales
let searchCriteria = [];
let searchResults = [];
let selectedStudents = new Set();
let availableClasses = [];
let availableGroups = [];
let availableRegimes = ['Demi-pensionnaire', 'Externe', 'Interne'];
let availableExitPermissions = ['Non défini', 'Externe Non', 'Externe Libre', 'DP Non', 'DP Oui', 'DP Libre'];
let selectedGroupsForBulk = new Set();

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    initializeAdvancedSelection();
});

// Initialiser la sélection avancée
function initializeAdvancedSelection() {
    const advancedSelectionBtn = document.getElementById('advancedSelectionBtn');
    if (advancedSelectionBtn) {
        advancedSelectionBtn.addEventListener('click', showAdvancedSelectionModal);
    }
    
    // Initialiser les gestionnaires d'événements de la modale
    setupAdvancedSelectionEventListeners();
    
    // Charger les données nécessaires
    loadAvailableData().then(() => {
        // Charger les groupes dans le sélecteur après que les données soient chargées
        loadGroupsInSelector();
    });
}

// Configurer les gestionnaires d'événements
function setupAdvancedSelectionEventListeners() {
    // Bouton ajouter critère
    const addCriterionBtn = document.getElementById('addCriterionBtn');
    if (addCriterionBtn) {
        addCriterionBtn.addEventListener('click', addSearchCriterion);
    }
    
    // Bouton lancer recherche
    const searchStudentsBtn = document.getElementById('searchStudentsBtn');
    if (searchStudentsBtn) {
        searchStudentsBtn.addEventListener('click', performAdvancedSearch);
    }
    
    // Boutons sélection
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    if (selectAllBtn) selectAllBtn.addEventListener('click', selectAllStudents);
    if (deselectAllBtn) deselectAllBtn.addEventListener('click', deselectAllStudents);
    if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', toggleSelectAll);
    
    // Actions en lot
    const assignGroupsBtn = document.getElementById('assignGroupsBtn');
    const assignExitPermissionBtn = document.getElementById('assignExitPermissionBtn');
    const exportSelectedBtn = document.getElementById('exportSelectedBtn');
    const addGroupBtn = document.getElementById('addGroupBtn');
    
    if (assignGroupsBtn) assignGroupsBtn.addEventListener('click', assignGroupsToSelected);
    if (assignExitPermissionBtn) assignExitPermissionBtn.addEventListener('click', assignExitPermissionToSelected);
    if (exportSelectedBtn) exportSelectedBtn.addEventListener('click', exportSelectedStudents);
    if (addGroupBtn) addGroupBtn.addEventListener('click', addSelectedGroup);
}

// Charger les données disponibles
async function loadAvailableData() {
    try {
        // Charger les classes
        const classesResponse = await fetch(getApiUrl('/students/classes/list'), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (classesResponse.ok) {
            const classesData = await classesResponse.json();
            availableClasses = classesData.classes || [];
        }
        
        // Charger les groupes
        const groupsResponse = await fetch(getApiUrl('/students/groups/list'), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (groupsResponse.ok) {
            const groupsData = await groupsResponse.json();
            availableGroups = groupsData.groups || [];
            console.log('📊 Groupes chargés:', availableGroups);
        } else {
            console.error('❌ Erreur lors du chargement des groupes:', groupsResponse.status);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
    }
}

// Afficher la modale de sélection avancée
function showAdvancedSelectionModal() {
    // Réinitialiser les critères
    searchCriteria = [];
    searchResults = [];
    selectedStudents.clear();
    
    // Ajouter 3 critères par défaut
    for (let i = 0; i < 3; i++) {
        addSearchCriterion();
    }
    
    // S'assurer que les groupes sont chargés
    if (availableGroups.length === 0) {
        loadAvailableData().then(() => {
            loadGroupsInSelector();
        });
    } else {
        loadGroupsInSelector();
    }
    
    // Afficher la modale
    showModal('advancedSelectionModal');
}

// Ajouter un critère de recherche
function addSearchCriterion() {
    const container = document.getElementById('searchCriteriaContainer');
    if (!container) return;
    
    const criterionId = `criterion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const criterionDiv = document.createElement('div');
    criterionDiv.className = 'search-criterion';
    criterionDiv.id = criterionId;
    
    criterionDiv.innerHTML = `
        <div class="criterion-lines">
            <div class="criterion-line">
                <div class="criterion-field">
                    <label>Champ :</label>
                    <select class="criterion-field-select">
                        <option value="">Sélectionner un champ...</option>
                        <option value="classe">Classe</option>
                        <option value="groupes">Groupes</option>
                        <option value="regime">Régime</option>
                        <option value="autorisationSortie">Autorisation de sortie</option>
                    </select>
                </div>
                <div class="criterion-value">
                    <label>Valeur :</label>
                    <select class="criterion-value-select">
                        <option value="">Sélectionner une valeur...</option>
                    </select>
                </div>
                <div class="criterion-actions">
                    <button type="button" class="btn btn-sm btn-danger remove-criterion-btn" onclick="removeCriterion('${criterionId}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="criterion-operator-line">
                <div class="criterion-operator">
                    <label>Opérateur :</label>
                    <select class="criterion-operator-select">
                        <option value="ET">ET</option>
                        <option value="OU">OU</option>
                        <option value="SAUF">SAUF</option>
                    </select>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(criterionDiv);
    
    // Configurer les événements pour ce critère
    setupCriterionEvents(criterionDiv);
}

// Configurer les événements pour un critère
function setupCriterionEvents(criterionDiv) {
    const fieldSelect = criterionDiv.querySelector('.criterion-field-select');
    const valueSelect = criterionDiv.querySelector('.criterion-value-select');
    
    fieldSelect.addEventListener('change', function() {
        updateCriterionValues(criterionDiv);
    });
}

// Mettre à jour les valeurs disponibles selon le champ sélectionné
function updateCriterionValues(criterionDiv) {
    const fieldSelect = criterionDiv.querySelector('.criterion-field-select');
    const valueSelect = criterionDiv.querySelector('.criterion-value-select');
    const selectedField = fieldSelect.value;
    
    // Vider les options actuelles
    valueSelect.innerHTML = '<option value="">Sélectionner une valeur...</option>';
    
    let values = [];
    
    switch (selectedField) {
        case 'classe':
            values = availableClasses;
            break;
        case 'groupes':
            values = availableGroups;
            break;
        case 'regime':
            values = availableRegimes;
            break;
        case 'autorisationSortie':
            values = availableExitPermissions;
            break;
    }
    
    // Ajouter les options
    values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        valueSelect.appendChild(option);
    });
}

// Supprimer un critère
function removeCriterion(criterionId) {
    const criterion = document.getElementById(criterionId);
    if (criterion) {
        criterion.remove();
    }
}

// Effectuer la recherche avancée
async function performAdvancedSearch() {
    try {
        // Collecter les critères
        const criteria = collectSearchCriteria();
        
        if (criteria.length === 0) {
            showError('Veuillez définir au moins un critère de recherche');
            return;
        }
        
        console.log('🔍 Critères de recherche:', criteria);
        
        // Construire la requête
        const searchQuery = buildSearchQuery(criteria);
        
        // Effectuer la recherche
        const response = await fetch(getApiUrl('/students/search'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ criteria: searchQuery })
        });
        
        if (response.ok) {
            const data = await response.json();
            searchResults = data.students || [];
            displaySearchResults(searchResults);
        } else {
            const errorData = await response.json();
            showError(errorData.message || 'Erreur lors de la recherche');
        }
        
    } catch (error) {
        console.error('Erreur lors de la recherche:', error);
        showError('Erreur lors de la recherche');
    }
}

// Collecter les critères de recherche
function collectSearchCriteria() {
    const criteria = [];
    const criterionDivs = document.querySelectorAll('.search-criterion');
    
    criterionDivs.forEach(div => {
        const fieldSelect = div.querySelector('.criterion-field-select');
        const operatorSelect = div.querySelector('.criterion-operator-select');
        const valueSelect = div.querySelector('.criterion-value-select');
        
        const field = fieldSelect.value;
        const operator = operatorSelect.value;
        const value = valueSelect.value;
        
        if (field && value) {
            // Ajouter le critère principal
            criteria.push({
                field: field,
                operator: operator,
                value: value
            });
        }
    });
    
    return criteria;
}

// Construire la requête de recherche
function buildSearchQuery(criteria) {
    // La logique est maintenant gérée côté serveur
    // On envoie simplement les critères dans l'ordre
    return criteria;
}

// Afficher les résultats de recherche
function displaySearchResults(students) {
    const resultsSection = document.getElementById('searchResultsSection');
    const bulkActionsSection = document.getElementById('bulkActionsSection');
    const resultsBody = document.getElementById('searchResultsBody');
    
    if (!resultsSection || !resultsBody) return;
    
    // Afficher les sections
    resultsSection.style.display = 'block';
    bulkActionsSection.style.display = 'block';
    
    // Vider le tableau
    resultsBody.innerHTML = '';
    
    // Ajouter les résultats
    students.forEach(student => {
        const row = document.createElement('tr');
        row.dataset.studentId = student.id;
        
        const groups = Array.isArray(student.groups) ? student.groups.join(', ') : (student.groups || '');
        
        row.innerHTML = `
            <td>
                <input type="checkbox" class="student-checkbox" value="${student.id}">
            </td>
            <td>${student.nom || student.lastName || ''}</td>
            <td>${student.prenom || student.firstName || ''}</td>
            <td>${student.classe || student.class || ''}</td>
            <td>${groups}</td>
            <td>${student.regime || ''}</td>
            <td>${student.autorisationSortie || student.exitPermissions || ''}</td>
        `;
        
        resultsBody.appendChild(row);
    });
    
    // Configurer les événements des checkboxes
    setupResultCheckboxes();
    
    // Mettre à jour le compteur
    updateSelectedCount();
}

// Configurer les événements des checkboxes
function setupResultCheckboxes() {
    const checkboxes = document.querySelectorAll('.student-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const studentId = this.value;
            
            if (this.checked) {
                selectedStudents.add(studentId);
            } else {
                selectedStudents.delete(studentId);
            }
            
            updateSelectedCount();
            updateSelectAllCheckbox();
        });
    });
}

// Sélectionner tous les élèves
function selectAllStudents() {
    const checkboxes = document.querySelectorAll('.student-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        selectedStudents.add(checkbox.value);
    });
    updateSelectedCount();
    updateSelectAllCheckbox();
}

// Désélectionner tous les élèves
function deselectAllStudents() {
    const checkboxes = document.querySelectorAll('.student-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    selectedStudents.clear();
    updateSelectedCount();
    updateSelectAllCheckbox();
}

// Basculer la sélection de tous
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox.checked) {
        selectAllStudents();
    } else {
        deselectAllStudents();
    }
}

// Mettre à jour le compteur de sélection
function updateSelectedCount() {
    const selectedCount = document.getElementById('selectedCount');
    if (selectedCount) {
        selectedCount.textContent = `${selectedStudents.size} sélectionné(s)`;
    }
}

// Mettre à jour la checkbox "Tout sélectionner"
function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const totalCheckboxes = document.querySelectorAll('.student-checkbox').length;
    
    if (selectAllCheckbox) {
        if (selectedStudents.size === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedStudents.size === totalCheckboxes) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }
}

// Assigner des groupes aux élèves sélectionnés
async function assignGroupsToSelected() {
    console.log('🔧 assignGroupsToSelected appelée');
    console.log('🔧 Élèves sélectionnés:', selectedStudents.size);
    console.log('🔧 Groupes sélectionnés:', selectedGroupsForBulk.size);
    
    if (selectedStudents.size === 0) {
        showError('Veuillez sélectionner au moins un élève');
        return;
    }
    
    const selectedGroups = Array.from(selectedGroupsForBulk);
    
    if (selectedGroups.length === 0) {
        showError('Veuillez sélectionner au moins un groupe');
        return;
    }
    
    console.log('🔧 Données à envoyer:', {
        studentIds: Array.from(selectedStudents),
        groups: selectedGroups
    });
    
    try {
        const response = await fetch(getApiUrl('/students/bulk-assign-groups'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                studentIds: Array.from(selectedStudents),
                groups: selectedGroups
            })
        });
        
        if (response.ok) {
            showSuccess(`${selectedGroups.length} groupe(s) assigné(s) à ${selectedStudents.size} élève(s)`);
            // Rafraîchir les résultats
            performAdvancedSearch();
        } else {
            const errorData = await response.json();
            showError(errorData.message || 'Erreur lors de l\'assignation des groupes');
        }
    } catch (error) {
        console.error('Erreur lors de l\'assignation des groupes:', error);
        showError('Erreur lors de l\'assignation des groupes');
    }
}

// Assigner des autorisations de sortie aux élèves sélectionnés
async function assignExitPermissionToSelected() {
    if (selectedStudents.size === 0) {
        showError('Veuillez sélectionner au moins un élève');
        return;
    }
    
    const exitPermissionSelect = document.getElementById('bulkExitPermissionSelect');
    const selectedPermission = exitPermissionSelect.value;
    
    if (!selectedPermission) {
        showError('Veuillez sélectionner une autorisation de sortie');
        return;
    }
    
    try {
        const response = await fetch(getApiUrl('/students/bulk-assign-exit-permission'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                studentIds: Array.from(selectedStudents),
                exitPermission: selectedPermission
            })
        });
        
        if (response.ok) {
            showSuccess(`Autorisation de sortie "${selectedPermission}" assignée à ${selectedStudents.size} élève(s)`);
            // Rafraîchir les résultats
            performAdvancedSearch();
        } else {
            const errorData = await response.json();
            showError(errorData.message || 'Erreur lors de l\'assignation de l\'autorisation');
        }
    } catch (error) {
        console.error('Erreur lors de l\'assignation de l\'autorisation:', error);
        showError('Erreur lors de l\'assignation de l\'autorisation');
    }
}

// Exporter les élèves sélectionnés
function exportSelectedStudents() {
    if (selectedStudents.size === 0) {
        showError('Veuillez sélectionner au moins un élève');
        return;
    }
    
    // Filtrer les élèves sélectionnés
    const selectedStudentsData = searchResults.filter(student => 
        selectedStudents.has(student.id.toString())
    );
    
    // Utiliser la fonction d'export existante
    if (typeof exportStudentsList === 'function') {
        exportStudentsList(selectedStudentsData, 'Sélection avancée des élèves');
    } else {
        // Fallback : export simple
        exportStudentsToCSV(selectedStudentsData);
    }
}

// Export simple en CSV
function exportStudentsToCSV(students) {
    const headers = ['Nom', 'Prénom', 'Classe', 'Groupes', 'Régime', 'Autorisation de sortie'];
    const csvContent = [
        headers.join(','),
        ...students.map(student => [
            `"${student.nom || student.lastName || ''}"`,
            `"${student.prenom || student.firstName || ''}"`,
            `"${student.classe || student.class || ''}"`,
            `"${Array.isArray(student.groups) ? student.groups.join('; ') : (student.groups || '')}"`,
            `"${student.regime || ''}"`,
            `"${student.autorisationSortie || student.exitPermissions || ''}"`
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `selection_eleves_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Charger les groupes dans le menu déroulant
function loadGroupsInSelector() {
    const groupsDropdown = document.getElementById('bulkGroupsDropdown');
    if (!groupsDropdown) {
        console.error('❌ Élément bulkGroupsDropdown non trouvé');
        return;
    }
    
    console.log('🔧 Chargement des groupes dans le menu déroulant:', availableGroups);
    
    // Vider le menu déroulant (garder l'option par défaut)
    groupsDropdown.innerHTML = '<option value="">Sélectionner un groupe...</option>';
    selectedGroupsForBulk.clear();
    
    if (availableGroups.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Aucun groupe disponible';
        option.disabled = true;
        groupsDropdown.appendChild(option);
        return;
    }
    
    availableGroups.forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        groupsDropdown.appendChild(option);
    });
    
    console.log(`✅ ${availableGroups.length} groupes chargés dans le menu déroulant`);
}

// Ajouter un groupe sélectionné depuis le menu déroulant
function addSelectedGroup() {
    const groupsDropdown = document.getElementById('bulkGroupsDropdown');
    if (!groupsDropdown) return;
    
    const selectedGroup = groupsDropdown.value;
    if (!selectedGroup) {
        showError('Veuillez sélectionner un groupe');
        return;
    }
    
    if (selectedGroupsForBulk.has(selectedGroup)) {
        showError('Ce groupe est déjà sélectionné');
        return;
    }
    
    selectedGroupsForBulk.add(selectedGroup);
    updateSelectedGroupsDisplay();
    
    // Réinitialiser le menu déroulant
    groupsDropdown.value = '';
    
    console.log('✅ Groupe ajouté:', selectedGroup);
}

// Mettre à jour l'affichage des groupes sélectionnés
function updateSelectedGroupsDisplay() {
    const groupsTags = document.getElementById('bulkGroupsTags');
    if (!groupsTags) return;
    
    groupsTags.innerHTML = '';
    
    selectedGroupsForBulk.forEach(groupName => {
        const tag = document.createElement('div');
        tag.className = 'group-tag';
        tag.innerHTML = `
            <span>${groupName}</span>
            <button type="button" class="remove-btn" onclick="removeSelectedGroup('${groupName}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        groupsTags.appendChild(tag);
    });
}

// Supprimer un groupe sélectionné
function removeSelectedGroup(groupName) {
    selectedGroupsForBulk.delete(groupName);
    updateSelectedGroupsDisplay();
    console.log('🗑️ Groupe supprimé:', groupName);
}

// Exposer les fonctions globalement
window.showAdvancedSelectionModal = showAdvancedSelectionModal;
window.addSearchCriterion = addSearchCriterion;
window.removeCriterion = removeCriterion;
window.performAdvancedSearch = performAdvancedSearch;
window.selectAllStudents = selectAllStudents;
window.deselectAllStudents = deselectAllStudents;
window.toggleSelectAll = toggleSelectAll;
window.assignGroupsToSelected = assignGroupsToSelected;
window.assignExitPermissionToSelected = assignExitPermissionToSelected;
window.exportSelectedStudents = exportSelectedStudents;
window.addSelectedGroup = addSelectedGroup;
window.removeSelectedGroup = removeSelectedGroup;
