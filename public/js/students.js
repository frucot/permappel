// ===== GESTION DES ÉLÈVES =====

// Variables globales pour les élèves
let allStudents = [];

// Gestion de la sélection de fichier
function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        window.selectedFile = e.target.files[0];
        console.log('Fichier sélectionné:', window.selectedFile.name);
        importStudents();
    }
}

// Import des élèves
async function importStudents() {
    if (!window.selectedFile) {
        showNotification('Veuillez sélectionner un fichier CSV', 'warning');
        return;
    }

    const formData = new FormData();
    formData.append('file', window.selectedFile);

    try {
        showNotification('Import en cours...', 'info');
        
        const response = await fetch(getApiUrl('/import/students'), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            displayImportResults(result.results);
            showNotification(result.message, 'success');
            loadStudents();
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        console.error('Erreur lors de l\'import:', error);
        showNotification('Erreur lors de l\'import du fichier', 'error');
    }
}

// Affichage des résultats d'import
function displayImportResults(results) {
    const createdCount = document.getElementById('createdCount');
    const updatedCount = document.getElementById('updatedCount');
    const errorCount = document.getElementById('errorCount');
    const importResults = document.getElementById('importResults');
    const errorList = document.getElementById('errorList');
    const errorItems = document.getElementById('errorItems');
    
    if (createdCount) createdCount.textContent = results.createdEntries.length;
    if (updatedCount) updatedCount.textContent = results.updatedEntries.length;
    if (errorCount) errorCount.textContent = results.errors.length;
    
    if (importResults) importResults.classList.add('show');
    
    if (results.errors.length > 0 && errorList && errorItems) {
        errorList.style.display = 'block';
        errorItems.innerHTML = results.errors.map(error => 
            `<div class="error-item">Ligne ${error.row}: ${error.error}</div>`
        ).join('');
    } else if (errorList) {
        errorList.style.display = 'none';
    }
}

// Téléchargement du modèle
function downloadTemplate() {
    window.open('/api/import/template', '_blank');
}

// Chargement de la liste des élèves
async function loadStudents() {
    try {
        const response = await fetch(getApiUrl('/students'), {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            allStudents = data.students || [];
            displayStudents(allStudents);
            populateFilterOptions();
        } else {
            console.error('Erreur lors du chargement des élèves');
            const studentsList = document.getElementById('studentsList');
            if (studentsList) {
                studentsList.innerHTML = '<p>Erreur lors du chargement des élèves</p>';
            }
        }
    } catch (error) {
        console.error('Erreur lors du chargement des élèves:', error);
        const studentsList = document.getElementById('studentsList');
        if (studentsList) {
            studentsList.innerHTML = '<p>Erreur lors du chargement des élèves</p>';
        }
    }
}

// Affichage de la liste des élèves
function displayStudents(students) {
    console.log('Affichage des élèves:', students);
    
    const studentsListElement = document.getElementById('studentsList');
    const studentsCountElement = document.getElementById('studentsCountText');
    
    if (!studentsListElement) {
        console.error('Élément studentsList non trouvé');
        return;
    }
    
    // Mettre à jour le compteur
    if (studentsCountElement) {
        const totalStudents = allStudents.length;
        const filteredStudents = students.length;
        
        if (filteredStudents === totalStudents) {
            studentsCountElement.innerHTML = `<strong>${totalStudents}</strong> élève${totalStudents > 1 ? 's' : ''} au total`;
        } else {
            studentsCountElement.innerHTML = `<strong>${filteredStudents}</strong> élève${filteredStudents > 1 ? 's' : ''} sur <strong>${totalStudents}</strong> (filtrés)`;
        }
    }
    
    if (students.length === 0) {
        studentsListElement.innerHTML = '<p>Aucun élève trouvé. Importez un fichier CSV pour commencer.</p>';
        return;
    }

    const studentsHtml = students.map(student => `
        <div class="student-row">
            <div class="student-info">
                <div class="student-main-info">
                    <h4>${student.prenom} ${student.nom}</h4>
                    <span class="student-class">${student.classe}</span>
                </div>
                <div class="student-details">
                    <div class="detail-item">
                        <strong>Régime:</strong> ${student.regime || 'Externe'}
                    </div>
                    <div class="detail-item">
                        <strong>Date de naissance:</strong> ${student.dateNaissance || 'Non renseignée'}
                    </div>
                    <div class="detail-item">
                        <strong>Groupes:</strong> ${student.groups && student.groups.length > 0 ? student.groups.join(', ') : 'Aucun'}
                    </div>
                </div>
            </div>
            <div class="student-actions">
                <button class="btn btn-secondary" onclick="editStudent('${student._id || student.id}')">
                    <i class="fas fa-edit"></i>
                    Modifier
                </button>
            </div>
        </div>
    `).join('');

    studentsListElement.innerHTML = studentsHtml;
}

// Remplir les options de filtrage
function populateFilterOptions() {
    // Remplir les classes
    const classes = [...new Set(allStudents.map(s => s.classe))].sort();
    
    const studentClassFilter = document.getElementById('studentClassFilter');
    const studentClassInput = document.getElementById('studentClassInput');
    const editStudentClass = document.getElementById('editStudentClass');
    
    // Remplir le filtre de classe
    if (studentClassFilter) {
        studentClassFilter.innerHTML = '<option value="">Toutes les classes</option>';
        classes.forEach(className => {
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            studentClassFilter.appendChild(option);
        });
    }

    // Remplir les menus de classe dans les modales
    [studentClassInput, editStudentClass].forEach(select => {
        if (select) {
            select.innerHTML = '<option value="">Sélectionner une classe...</option>';
            classes.forEach(className => {
                const option = document.createElement('option');
                option.value = className;
                option.textContent = className;
                select.appendChild(option);
            });
        }
    });

    // Remplir les groupes
    const groups = [...new Set(allStudents.flatMap(s => s.groups || []))].sort();
    const studentGroupFilter = document.getElementById('studentGroupFilter');
    if (studentGroupFilter) {
        studentGroupFilter.innerHTML = '<option value="">Tous les groupes</option>';
        groups.forEach(groupName => {
            const option = document.createElement('option');
            option.value = groupName;
            option.textContent = groupName;
            studentGroupFilter.appendChild(option);
        });
    }
}

// Appliquer les filtres et le tri
function applyFiltersAndSort() {
    let filteredStudents = [...allStudents];

    // Filtrage par recherche textuelle
    const studentSearch = document.getElementById('studentSearch');
    const searchTerm = studentSearch?.value?.toLowerCase() || '';
    if (searchTerm) {
        filteredStudents = filteredStudents.filter(student => 
            student.nom.toLowerCase().includes(searchTerm) ||
            student.prenom.toLowerCase().includes(searchTerm) ||
            student.classe.toLowerCase().includes(searchTerm) ||
            (student.groups && student.groups.some(group => group.toLowerCase().includes(searchTerm)))
        );
    }

    // Filtrage par classe
    const studentClassFilter = document.getElementById('studentClassFilter');
    const selectedClass = studentClassFilter?.value || '';
    if (selectedClass) {
        filteredStudents = filteredStudents.filter(student => student.classe === selectedClass);
    }

    // Filtrage par groupe
    const studentGroupFilter = document.getElementById('studentGroupFilter');
    const selectedGroup = studentGroupFilter?.value || '';
    if (selectedGroup) {
        filteredStudents = filteredStudents.filter(student => 
            student.groups && student.groups.includes(selectedGroup)
        );
    }

    // Tri
    const studentSort = document.getElementById('studentSort');
    const sortBy = studentSort?.value || 'nom';
    filteredStudents.sort((a, b) => {
        switch (sortBy) {
            case 'nom':
                return a.nom.localeCompare(b.nom);
            case 'prenom':
                return a.prenom.localeCompare(b.prenom);
            case 'classe':
                return a.classe.localeCompare(b.classe);
            case 'groupe':
                const aGroups = a.groups ? a.groups.join(',') : '';
                const bGroups = b.groups ? b.groups.join(',') : '';
                return aGroups.localeCompare(bGroups);
            case 'regime':
                return (a.regime || '').localeCompare(b.regime || '');
            default:
                return 0;
        }
    });

    displayStudents(filteredStudents);
}

// Fonction pour modifier un élève
async function editStudent(studentId) {
    try {
        console.log('Chargement de l\'élève:', studentId);
        
        const response = await fetch(`${getApiUrl('/students')}/${studentId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Erreur lors du chargement de l\'élève');
        }

        const data = await response.json();
        const student = data.student;

        // Remplir le formulaire de modification
        document.getElementById('editStudentId').value = student._id || student.id;
        document.getElementById('editStudentFirstName').value = student.prenom || student.firstName;
        document.getElementById('editStudentLastName').value = student.nom || student.lastName;
        
        const classSelect = document.getElementById('editStudentClass');
        if (classSelect) {
            classSelect.value = student.classe || student.class || '';
        }
        
        document.getElementById('editStudentBirthDate').value = student.dateNaissance || student.birthDate || '';
        document.getElementById('editStudentRegime').value = student.regime || 'Externe';
        document.getElementById('editStudentExitPermissions').value = student.autorisationSortie || student.exitPermissions || 'ND';

        // Charger et remplir les groupes
        await loadGroupsForEdit(student.groups || []);

        // Afficher la modal
        showModal('editStudentModal');

    } catch (error) {
        console.error('Erreur lors du chargement de l\'élève:', error);
        showError('Erreur lors du chargement de l\'élève');
    }
}

// Charger les groupes pour la modal d'ajout
async function loadGroupsForAdd() {
    try {
        const response = await fetch(getApiUrl('/students/groups/list'), {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Erreur lors du chargement des groupes');
        }

        const data = await response.json();
        const groups = data.groups || [];
        
        populateGroupCheckboxesForAdd(groups);
    } catch (error) {
        console.error('Erreur lors du chargement des groupes:', error);
    }
}

// Remplir le composant multiselect des groupes pour l'ajout
function populateGroupCheckboxesForAdd(groups) {
    const dropdown = document.getElementById('addStudentGroupsDropdown');
    const selectedElement = document.getElementById('addStudentGroupsSelected');
    const optionsElement = document.getElementById('addStudentGroupsOptions');
    
    if (!dropdown || !selectedElement || !optionsElement) return;
    
    optionsElement.innerHTML = '';
    
    groups.forEach(groupName => {
        const option = document.createElement('div');
        option.className = 'multiselect-option';
        
        option.innerHTML = `
            <input type="checkbox" id="add-group-${groupName}" value="${groupName}">
            <label for="add-group-${groupName}">${groupName}</label>
        `;
        
        optionsElement.appendChild(option);
        
        const checkbox = option.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => {
            updateSelectedGroupsDisplayForAdd();
        });
    });
    
    updateSelectedGroupsDisplayForAdd();
    
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

// Mettre à jour l'affichage des groupes sélectionnés pour l'ajout
function updateSelectedGroupsDisplayForAdd() {
    const selectedElement = document.getElementById('addStudentGroupsSelected');
    const checkboxes = document.querySelectorAll('#addStudentGroupsOptions input[type="checkbox"]:checked');
    
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
                const checkbox = document.querySelector(`#addStudentGroupsOptions input[value="${groupName}"]`);
                if (checkbox) {
                    checkbox.checked = false;
                    updateSelectedGroupsDisplayForAdd();
                }
            });
        });
    }
}

// Charger les groupes pour la modal de modification
async function loadGroupsForEdit(selectedGroups = []) {
    try {
        const response = await fetch(getApiUrl('/students/groups/list'), {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Erreur lors du chargement des groupes');
        }

        const data = await response.json();
        const groups = data.groups || [];
        
        displayGroupTagsForEdit(selectedGroups);
        populateGroupCheckboxesForEdit(groups, selectedGroups);
    } catch (error) {
        console.error('Erreur lors du chargement des groupes:', error);
        displayGroupTagsForEdit(selectedGroups);
    }
}

// Afficher les groupes existants comme tags supprimables
function displayGroupTagsForEdit(selectedGroups = []) {
    const selectedElement = document.getElementById('editStudentGroupsSelected');
    if (!selectedElement) return;
    
    if (selectedGroups.length === 0) {
        selectedElement.innerHTML = `
            <span class="placeholder">Sélectionner des groupes...</span>
            <i class="fas fa-chevron-down"></i>
        `;
    } else {
        const selectedItems = selectedGroups.map(groupName => `
            <div class="selected-item">
                <span>${groupName}</span>
                <span class="remove" data-group="${groupName}">&times;</span>
            </div>
        `).join('');
        
        selectedElement.innerHTML = `
            <div class="selected-items">${selectedItems}</div>
            <i class="fas fa-chevron-down"></i>
        `;
        
        selectedElement.querySelectorAll('.remove').forEach(removeBtn => {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const groupName = e.target.getAttribute('data-group');
                const checkbox = document.querySelector(`#editStudentGroupsOptions input[value="${groupName}"]`);
                if (checkbox) {
                    checkbox.checked = false;
                }
                updateSelectedGroupsDisplayForEdit();
            });
        });
    }
}

// Remplir le composant multiselect des groupes pour la modification
function populateGroupCheckboxesForEdit(groups, selectedGroups = []) {
    const dropdown = document.getElementById('editStudentGroupsDropdown');
    const selectedElement = document.getElementById('editStudentGroupsSelected');
    const optionsElement = document.getElementById('editStudentGroupsOptions');
    
    if (!dropdown || !selectedElement || !optionsElement) return;
    
    optionsElement.innerHTML = '';
    
    groups.forEach(groupName => {
        const option = document.createElement('div');
        option.className = 'multiselect-option';
        
        const isSelected = selectedGroups.includes(groupName);
        
        option.innerHTML = `
            <input type="checkbox" id="edit-group-${groupName}" value="${groupName}" ${isSelected ? 'checked' : ''}>
            <label for="edit-group-${groupName}">${groupName}</label>
        `;
        
        optionsElement.appendChild(option);
        
        const checkbox = option.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => {
            updateSelectedGroupsDisplayForEdit();
        });
    });
    
    updateSelectedGroupsDisplayForEdit();
    
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

// Mettre à jour l'affichage des groupes sélectionnés pour la modification
function updateSelectedGroupsDisplayForEdit() {
    const selectedElement = document.getElementById('editStudentGroupsSelected');
    const checkboxes = document.querySelectorAll('#editStudentGroupsOptions input[type="checkbox"]:checked');
    
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
                const checkbox = document.querySelector(`#editStudentGroupsOptions input[value="${groupName}"]`);
                if (checkbox) {
                    checkbox.checked = false;
                    updateSelectedGroupsDisplayForEdit();
                }
            });
        });
    }
}

// Initialiser les gestionnaires de formulaires d'élèves
function initStudentFormHandlers() {
    // Gestion du formulaire d'ajout d'élève
    const addStudentForm = document.getElementById('addStudentForm');
    if (addStudentForm) {
        addStudentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            
            const selectedGroups = Array.from(document.querySelectorAll('#addStudentGroupsOptions input:checked'))
                .map(input => input.value);
            
            const studentData = {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                class: formData.get('class'),
                birthDate: formData.get('birthDate'),
                regime: formData.get('regime'),
                exitPermissions: formData.get('exitPermissions'),
                groups: selectedGroups
            };
            
            if (!studentData.firstName || !studentData.lastName || !studentData.class || !studentData.birthDate) {
                showError('Veuillez remplir tous les champs obligatoires (nom, prénom, classe, date de naissance)');
                return;
            }
            
            try {
                const response = await fetch(getApiUrl('/students'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(studentData)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Erreur lors de la création');
                }
                
                hideModal('addStudentModal');
                showSuccess('Élève ajouté avec succès');
                loadStudents();
                
                e.target.reset();
                const addStudentGroupsSelected = document.getElementById('addStudentGroupsSelected');
                if (addStudentGroupsSelected) {
                    addStudentGroupsSelected.innerHTML = `
                        <span class="placeholder">Sélectionner des groupes...</span>
                        <i class="fas fa-chevron-down"></i>
                    `;
                }
                
            } catch (error) {
                console.error('Erreur lors de l\'ajout:', error);
                showError('Erreur lors de l\'ajout: ' + error.message);
            }
        });
    }

    // Gestion du formulaire de modification d'élève
    const editStudentForm = document.getElementById('editStudentForm');
    if (editStudentForm) {
        editStudentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const studentId = formData.get('studentId');
            
            const selectedGroups = Array.from(document.querySelectorAll('#editStudentGroupsOptions input:checked'))
                .map(input => input.value);
            
            const studentData = {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                class: formData.get('class'),
                birthDate: formData.get('birthDate'),
                regime: formData.get('regime'),
                exitPermissions: formData.get('exitPermissions'),
                groups: selectedGroups
            };
            
            if (!studentData.firstName || !studentData.lastName || !studentData.class || !studentData.birthDate) {
                showError('Veuillez remplir tous les champs obligatoires (nom, prénom, classe, date de naissance)');
                return;
            }
            
            try {
                const response = await fetch(`${getApiUrl('/students')}/${studentId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(studentData)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Erreur lors de la modification');
                }
                
                hideModal('editStudentModal');
                showSuccess('Élève modifié avec succès');
                loadStudents();
                
            } catch (error) {
                console.error('Erreur lors de la modification:', error);
                showError('Erreur lors de la modification: ' + error.message);
            }
        });
    }
}
