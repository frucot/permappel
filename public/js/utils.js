// ===== FONCTIONS UTILITAIRES =====

// Détecter si on est dans un contexte Electron ou navigateur web
function isElectronContext() {
    // Vérifier si on est dans Electron
    return typeof window !== 'undefined' && 
           window.process && 
           window.process.type === 'renderer';
}

// Fonction pour ouvrir une fenêtre de feuille d'appel de manière hybride
function openAttendanceWindow(url) {
    if (isElectronContext()) {
        // Contexte Electron - laisser le setWindowOpenHandler gérer
        console.log('🔧 Contexte Electron détecté - ouverture via setWindowOpenHandler');
        window.open(url, '_blank');
    } else {
        // Contexte navigateur web - comportement standard
        console.log('🌐 Contexte navigateur web détecté - ouverture standard');
        window.open(url, '_blank');
    }
}

// Fonction utilitaire pour formater les dates
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Fonction utilitaire pour formater la date pour le PDF
function formatDateForPDF(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Obtenir le libellé du rôle
function getRoleLabel(role) {
    const roles = {
        'admin': 'Administrateur',
        'aed': 'AED',
        'cpe': 'CPE',
        'documentaliste': 'Documentaliste',
        'eleve': 'Élève'
    };
    return roles[role] || role;
}
