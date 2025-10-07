// ===== GESTION DES UTILISATEURS =====

// Charger la liste des utilisateurs
async function loadUsers() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl('/admin/users'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayUsers(data.users || []);
        } else {
            console.error('Erreur lors du chargement des utilisateurs');
            displayUsers([]);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        displayUsers([]);
    }
}

// Afficher la liste des utilisateurs
function displayUsers(users) {
    const usersContainer = document.getElementById('usersList');
    if (!usersContainer) return;
    
    if (users.length === 0) {
        usersContainer.innerHTML = `
            <div class="no-users">
                <i class="fas fa-users"></i>
                <h3>Aucun utilisateur trouvé</h3>
                <p>Créez votre premier utilisateur pour commencer.</p>
            </div>
        `;
        return;
    }
    
    usersContainer.innerHTML = users.map(user => `
        <div class="user-card">
            <div class="user-info">
                <h4>${user.prenom} ${user.nom}</h4>
                <p><strong>Nom d'utilisateur:</strong> ${user.nomUtilisateur}</p>
                <p><strong>Email:</strong> ${user.email || 'Non renseigné'}</p>
                <span class="user-role">${getRoleLabel(user.role)}</span>
                <span class="user-status ${user.actif ? 'active' : 'inactive'}">
                    ${user.actif ? 'Actif' : 'Inactif'}
                </span>
            </div>
            <div class="user-actions">
                <button class="btn btn-secondary" onclick="editUser(${user.id})">
                    <i class="fas fa-edit"></i> Modifier
                </button>
                <button class="btn btn-error" onclick="confirmDeleteUser(${user.id}, '${user.prenom} ${user.nom}')">
                    <i class="fas fa-trash"></i> Supprimer
                </button>
            </div>
        </div>
    `).join('');
}

// Afficher le modal pour créer un nouvel utilisateur
function showCreateUserModal() {
    document.getElementById('userModalTitle').textContent = 'Nouvel utilisateur';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('passwordRequired').textContent = '*';
    document.getElementById('userPassword').required = true;
    document.getElementById('saveUserBtn').textContent = 'Enregistrer';
    showModal('userModal');
}

// Éditer un utilisateur existant
async function editUser(userId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${getApiUrl('/admin/users')}/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const user = data.user;
            
            document.getElementById('userModalTitle').textContent = 'Modifier l\'utilisateur';
            document.getElementById('userId').value = userId;
            document.getElementById('userFirstName').value = user.prenom || '';
            document.getElementById('userLastName').value = user.nom || '';
            document.getElementById('userUsername').value = user.nomUtilisateur || '';
            document.getElementById('userEmail').value = user.email || '';
            document.getElementById('userRole').value = user.role || '';
            document.getElementById('userPassword').value = '';
            document.getElementById('passwordRequired').textContent = '';
            document.getElementById('userPassword').required = false;
            document.getElementById('saveUserBtn').textContent = 'Mettre à jour';
            
            showModal('userModal');
        } else {
            showError('Impossible de charger les détails de l\'utilisateur');
        }
    } catch (error) {
        console.error('Erreur lors du chargement de l\'utilisateur:', error);
        showError('Erreur lors du chargement de l\'utilisateur');
    }
}

// Confirmer la suppression d'un utilisateur
function confirmDeleteUser(userId, userName) {
    document.getElementById('confirmModalTitle').textContent = 'Supprimer l\'utilisateur';
    document.getElementById('confirmModalMessage').textContent = 
        `Êtes-vous sûr de vouloir supprimer l'utilisateur "${userName}" ? Cette action est irréversible.`;
    
    const confirmBtn = document.getElementById('confirmModalBtn');
    confirmBtn.onclick = () => deleteUser(userId);
    
    showModal('confirmModal');
}

// Supprimer un utilisateur
async function deleteUser(userId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${getApiUrl('/admin/users')}/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showSuccess('Utilisateur supprimé avec succès');
            hideModal('confirmModal');
            await loadUsers();
        } else {
            const errorData = await response.json();
            showError(errorData.message || 'Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        showError('Erreur lors de la suppression');
    }
}

// Initialiser le gestionnaire de formulaire utilisateur
function initUserFormHandler() {
    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const userId = formData.get('userId');
            const userData = {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                username: formData.get('username'),
                email: formData.get('email'),
                role: formData.get('role'),
                password: formData.get('password')
            };

            if (!userData.firstName || !userData.lastName || !userData.username || !userData.email || !userData.role) {
                showError('Veuillez remplir tous les champs obligatoires');
                return;
            }

            if (!userId && !userData.password) {
                showError('Le mot de passe est obligatoire pour un nouvel utilisateur');
                return;
            }

            if (userData.password && userData.password.length < 6) {
                showError('Le mot de passe doit contenir au moins 6 caractères');
                return;
            }

            try {
                const token = localStorage.getItem('token');
                const url = userId ? `${getApiUrl('/admin/users')}/${userId}` : getApiUrl('/admin/users');
                const method = userId ? 'PUT' : 'POST';
                
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(userData)
                });

                if (response.ok) {
                    const data = await response.json();
                    showSuccess(userId ? 'Utilisateur modifié avec succès' : 'Utilisateur créé avec succès');
                    hideModal('userModal');
                    await loadUsers();
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
