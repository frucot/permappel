const { contextBridge, ipcRenderer } = require('electron');

// Exposer des APIs sécurisées au processus de rendu
contextBridge.exposeInMainWorld('electronAPI', {
    // Actions du menu
    onMenuAction: (callback) => {
        ipcRenderer.on('menu-action', (event, action) => {
            callback(action);
        });
    },
    
    // Informations sur la plateforme
    platform: process.platform,
    
    // Version de l'application
    version: process.env.npm_package_version || '1.0.0',
    
    // Mode développement
    isDev: process.argv.includes('--dev'),
    
    // Logs du serveur
    onServerLog: (callback) => {
        ipcRenderer.on('server-log', (event, message) => {
            callback(message);
        });
    }
});
