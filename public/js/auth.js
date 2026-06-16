// ===== GESTION DE L'AUTHENTIFICATION =====

// Fonction pour retry les requêtes en cas d'échec de connexion
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (error) {
            console.warn(`⚠️ Tentative ${i + 1}/${maxRetries} échouée:`, error.message);
            if (i === maxRetries - 1) {
                throw error;
            }
            // Attendre 1 seconde avant de réessayer
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Gestion de la connexion
async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const credentials = {
        username: formData.get('username'),
        password: formData.get('password')
    };
    
    try {
        const response = await fetchWithRetry(getApiUrl('/auth/login'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(credentials)
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Données utilisateur reçues:', data.user);
            localStorage.setItem('token', data.token);
            window.currentUser = data.user;

            // Les élèves n'ont accès qu'à la borne CDI
            if (data.user?.role === 'eleve') {
                window.location.href = 'cdi-kiosk.html';
                return;
            }

            showMainPage();
            hideError();
        } else {
            showError('Nom d\'utilisateur ou mot de passe incorrect');
        }
    } catch (error) {
        console.error('Erreur de connexion:', error);
        showError('Erreur de connexion au serveur');
    }
}

// Gestion de la déconnexion
function handleLogout() {
    // Arrêter le rafraîchissement automatique
    if (typeof stopAutoRefreshOnLogout === 'function') {
        stopAutoRefreshOnLogout();
    }
    
    localStorage.removeItem('token');
    window.currentUser = null;
    showLoginPage();
}

// Vérification du statut d'authentification
async function checkAuthStatus() {
    const token = localStorage.getItem('token');
    if (!token) {
        showLoginPage();
        return;
    }
    
    try {
        const response = await fetchWithRetry(getApiUrl('/auth/me'), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Utilisateur vérifié:', data.user);
            window.currentUser = data.user;

            // Les élèves n'ont accès qu'à la borne CDI
            if (data.user?.role === 'eleve') {
                window.location.href = 'cdi-kiosk.html';
                return;
            }

            showMainPage();
        } else {
            localStorage.removeItem('token');
            showLoginPage();
        }
    } catch (error) {
        console.error('Erreur de vérification d\'authentification:', error);
        localStorage.removeItem('token');
        showLoginPage();
    }
}

// Affichage des pages
function showLoginPage() {
    const loginPage = document.getElementById('loginPage');
    const mainPage = document.getElementById('mainPage');
    
    if (loginPage) loginPage.classList.add('active');
    if (mainPage) mainPage.classList.remove('active');
}

function showMainPage() {
    const loginPage = document.getElementById('loginPage');
    const mainPage = document.getElementById('mainPage');
    const userName = document.getElementById('userName');
    
    // Double sécurité: ne jamais afficher l'interface principale aux élèves
    if (window.currentUser?.role === 'eleve') {
        window.location.href = 'cdi-kiosk.html';
        return;
    }

    if (loginPage) loginPage.classList.remove('active');
    if (mainPage) mainPage.classList.add('active');
    
    // Afficher le nom de l'utilisateur connecté
    if (window.currentUser && userName) {
        const displayName = window.currentUser.prenom && window.currentUser.nom 
            ? `${window.currentUser.prenom} ${window.currentUser.nom}`
            : window.currentUser.nomUtilisateur || 'Utilisateur';
        userName.textContent = displayName;
        
        // Masquer le bouton Administration si l'utilisateur n'est pas admin
        const adminBtn = document.querySelector('[data-page="admin"]');
        if (adminBtn) {
            if (window.currentUser.role === 'admin') {
                adminBtn.style.display = 'block';
            } else {
                adminBtn.style.display = 'none';
            }
        }
    } else if (userName) {
        userName.textContent = 'Utilisateur';
    }
    
    // Charger automatiquement les données du dashboard au démarrage
    // Attendre un court délai pour s'assurer que le DOM est prêt
    setTimeout(() => {
        console.log('🔄 Chargement automatique des données du dashboard...');
        loadDashboardData().then(() => {
            console.log('✅ Données du dashboard chargées avec succès');
        }).catch(error => {
            console.error('❌ Erreur lors du chargement du dashboard:', error);
        });
    }, 100);
}
