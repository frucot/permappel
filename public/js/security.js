// Gestion de la configuration de sécurité
let securityConfig = {
    enabled: false,
    allowedIPs: [],
    allowedRanges: []
};

// URL de base de l'API (exposée par config.js)
const API_BASE_URL = (window.CONFIG && window.CONFIG.API_BASE_URL) 
    ? window.CONFIG.API_BASE_URL 
    : 'http://localhost:3001';

// Charger la configuration de sécurité
async function loadSecurityConfig() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/security`);
        const data = await response.json();
        
        if (data.success) {
            securityConfig = data.config;
            updateSecurityUI();
        } else {
            showNotification('Erreur lors du chargement de la configuration de sécurité', 'error');
        }
    } catch (error) {
        console.error('Erreur chargement configuration sécurité:', error);
        showNotification('Erreur lors du chargement de la configuration', 'error');
    }
}

// Mettre à jour l'interface utilisateur
function updateSecurityUI() {
    const enabledCheckbox = document.getElementById('securityEnabled');
    const configPanel = document.getElementById('securityConfigPanel');
    
    if (enabledCheckbox) {
        enabledCheckbox.checked = securityConfig.enabled;
        configPanel.style.display = securityConfig.enabled ? 'block' : 'none';
    }
    
    renderAllowedIPs();
    renderAllowedRanges();
}

// Afficher/masquer le panneau de configuration
function toggleSecurityEnabled() {
    const enabledCheckbox = document.getElementById('securityEnabled');
    const configPanel = document.getElementById('securityConfigPanel');
    
    if (enabledCheckbox && configPanel) {
        configPanel.style.display = enabledCheckbox.checked ? 'block' : 'none';
    }
}

// Rendre la liste des IPs autorisées
function renderAllowedIPs() {
    const container = document.getElementById('allowedIPsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (securityConfig.allowedIPs.length === 0) {
        container.innerHTML = '<p class="empty-state">Aucune adresse IP autorisée</p>';
        return;
    }
    
    securityConfig.allowedIPs.forEach((ip, index) => {
        const ipItem = document.createElement('div');
        ipItem.className = 'ip-item';
        ipItem.innerHTML = `
            <span class="ip-value">${ip}</span>
            <button class="btn btn-sm btn-error" onclick="removeIP(${index})" title="Supprimer">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(ipItem);
    });
}

// Rendre la liste des plages d'IPs autorisées
function renderAllowedRanges() {
    const container = document.getElementById('allowedRangesList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (securityConfig.allowedRanges.length === 0) {
        container.innerHTML = '<p class="empty-state">Aucune plage d\'adresses IP autorisée</p>';
        return;
    }
    
    securityConfig.allowedRanges.forEach((range, index) => {
        const rangeItem = document.createElement('div');
        rangeItem.className = 'ip-range-item';
        rangeItem.innerHTML = `
            <span class="range-value">${range.base}.${range.start} - ${range.base}.${range.end}</span>
            <button class="btn btn-sm btn-error" onclick="removeIPRange(${index})" title="Supprimer">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(rangeItem);
    });
}

// Ajouter une IP
function addIP() {
    const input = document.getElementById('newIPInput');
    if (!input) return;
    
    const ip = input.value.trim();
    
    if (!ip) {
        showNotification('Veuillez saisir une adresse IP', 'warning');
        return;
    }
    
    // Validation basique de l'IP
    const ipPattern = /^([0-9]{1,3}\.){3}[0-9]{1,3}$|^::1$|^::ffff:127\.0\.0\.1$/;
    if (!ipPattern.test(ip)) {
        showNotification('Format d\'adresse IP invalide', 'error');
        return;
    }
    
    // Vérifier si l'IP existe déjà
    if (securityConfig.allowedIPs.includes(ip)) {
        showNotification('Cette adresse IP est déjà autorisée', 'warning');
        return;
    }
    
    securityConfig.allowedIPs.push(ip);
    input.value = '';
    renderAllowedIPs();
}

// Supprimer une IP
function removeIP(index) {
    if (index >= 0 && index < securityConfig.allowedIPs.length) {
        securityConfig.allowedIPs.splice(index, 1);
        renderAllowedIPs();
    }
}

// Ajouter une plage d'IPs
function addIPRange() {
    const baseInput = document.getElementById('newRangeBaseInput');
    const startInput = document.getElementById('newRangeStartInput');
    const endInput = document.getElementById('newRangeEndInput');
    
    if (!baseInput || !startInput || !endInput) return;
    
    const base = baseInput.value.trim();
    const start = parseInt(startInput.value, 10);
    const end = parseInt(endInput.value, 10);
    
    if (!base) {
        showNotification('Veuillez saisir la base de la plage d\'IP', 'warning');
        return;
    }
    
    // Validation de la base (format: x.x.x)
    const basePattern = /^([0-9]{1,3}\.){2}[0-9]{1,3}$/;
    if (!basePattern.test(base)) {
        showNotification('Format de base invalide. Format attendu: x.x.x (ex: 10.131.100)', 'error');
        return;
    }
    
    if (isNaN(start) || isNaN(end)) {
        showNotification('Veuillez saisir des valeurs numériques valides pour le début et la fin', 'warning');
        return;
    }
    
    if (start < 0 || start > 255 || end < 0 || end > 255) {
        showNotification('Les valeurs doivent être entre 0 et 255', 'error');
        return;
    }
    
    if (start > end) {
        showNotification('La valeur de début doit être inférieure ou égale à la valeur de fin', 'error');
        return;
    }
    
    // Vérifier si la plage existe déjà
    const rangeExists = securityConfig.allowedRanges.some(r => 
        r.base === base && r.start === start && r.end === end
    );
    
    if (rangeExists) {
        showNotification('Cette plage d\'adresses IP est déjà autorisée', 'warning');
        return;
    }
    
    securityConfig.allowedRanges.push({ base, start, end });
    baseInput.value = '';
    startInput.value = '1';
    endInput.value = '254';
    renderAllowedRanges();
}

// Supprimer une plage d'IPs
function removeIPRange(index) {
    if (index >= 0 && index < securityConfig.allowedRanges.length) {
        securityConfig.allowedRanges.splice(index, 1);
        renderAllowedRanges();
    }
}

// Sauvegarder la configuration de sécurité
async function saveSecurityConfig() {
    try {
        const enabledCheckbox = document.getElementById('securityEnabled');
        const enabled = enabledCheckbox ? enabledCheckbox.checked : false;
        
        const config = {
            enabled: enabled,
            allowedIPs: securityConfig.allowedIPs,
            allowedRanges: securityConfig.allowedRanges
        };
        
        const response = await fetch(`${API_BASE_URL}/api/admin/security`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Configuration de sécurité sauvegardée avec succès', 'success');
            await loadSecurityConfig(); // Recharger pour confirmer
        } else {
            showNotification(data.message || 'Erreur lors de la sauvegarde', 'error');
        }
    } catch (error) {
        console.error('Erreur sauvegarde configuration sécurité:', error);
        showNotification('Erreur lors de la sauvegarde de la configuration', 'error');
    }
}

// Charger la configuration au chargement de la page admin
document.addEventListener('DOMContentLoaded', () => {
    // Charger la configuration quand on accède à la page admin
    const adminPage = document.getElementById('adminPage');
    if (adminPage) {
        // Observer les changements de page
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (adminPage.classList.contains('active')) {
                        loadSecurityConfig();
                    }
                }
            });
        });
        
        observer.observe(adminPage, { attributes: true });
        
        // Charger immédiatement si la page est déjà active
        if (adminPage.classList.contains('active')) {
            loadSecurityConfig();
        }
    }
});
