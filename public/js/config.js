// Configuration de l'application PERMAPPEL
const CONFIG = {
    // URL de base de l'API - détection automatique
    get API_BASE_URL() {
        // Si on est sur localhost, utiliser localhost
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3001';
        }
        // Sinon, utiliser l'adresse du serveur actuel
        return `http://${window.location.hostname}:3001`;
    },
    
    // URL complète de l'API
    get API_URL() {
        return this.API_BASE_URL + '/api';
    },
    
    // Configuration du serveur
    SERVER_PORT: 3001,
    SERVER_HOST: 'localhost'
};

// Fonction utilitaire pour construire les URLs API
function getApiUrl(endpoint) {
    return CONFIG.API_URL + endpoint;
}

// Fonction pour obtenir l'URL Socket.IO
function getSocketUrl() {
    // Détecter si on est dans Electron
    const isElectron = typeof window !== 'undefined' && 
                      window.process && 
                      window.process.type === 'renderer';
    
    if (isElectron) {
        // Dans Electron, utiliser localhost (car l'app Electron charge toujours localhost)
        console.log('🔧 Contexte Electron détecté - Socket.IO vers localhost');
        return 'http://localhost:3001';
    } else {
        // Dans un navigateur web, utiliser l'adresse du serveur actuel
        const socketUrl = `http://${window.location.hostname}:3001`;
        console.log('🌐 Contexte navigateur web détecté - Socket.IO vers:', socketUrl);
        return socketUrl;
    }
}

// Fonction pour tester la connectivité du serveur
async function testServerConnection() {
    try {
        const response = await fetch(CONFIG.API_BASE_URL + '/api/auth/me', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer test'
            }
        });
        return response.status !== 0; // Si on a une réponse (même 401), le serveur est accessible
    } catch (error) {
        console.warn('⚠️ Serveur non accessible:', error.message);
        return false;
    }
}

// Fonction pour détecter l'environnement de connexion
function detectConnectionEnvironment() {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    console.log('🔍 Détection de l\'environnement de connexion:');
    console.log('  - Hostname:', hostname);
    console.log('  - Protocol:', protocol);
    console.log('  - API Base URL:', CONFIG.API_BASE_URL);
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        console.log('  - Mode: Local');
    } else {
        console.log('  - Mode: Réseau distant');
    }
    
    return {
        hostname,
        protocol,
        isLocal: hostname === 'localhost' || hostname === '127.0.0.1',
        apiUrl: CONFIG.API_BASE_URL
    };
}

// Export pour utilisation dans d'autres modules
window.CONFIG = CONFIG;
window.getApiUrl = getApiUrl;
window.getSocketUrl = getSocketUrl;
