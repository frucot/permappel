const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Configuration
const isDev = process.argv.includes('--dev');
const SERVER_PORT = 3001;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

let mainWindow;
let serverProcess;
let attendanceWindows = new Map(); // Pour gérer les fenêtres de feuilles d'appel

// Fonction pour copier récursivement un dossier en excluant certains fichiers
function copyDir(src, dest, excludeFiles = []) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    for (const file of files) {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        
        // Ignorer les fichiers exclus
        if (excludeFiles.some(exclude => file.includes(exclude))) {
            console.log('Ignoré:', file);
            continue;
        }
        
        if (fs.statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath, excludeFiles);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Créer la fenêtre principale
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false,
        titleBarStyle: 'default'
    });

    // Charger l'application
    if (app.isPackaged) {
        // En mode packagé, démarrer le serveur puis charger l'application
        startServer().then(() => {
            console.log('✅ Serveur démarré, chargement de l\'application');
            mainWindow.loadURL(SERVER_URL).catch((error) => {
                console.error('❌ Erreur chargement URL:', error);
                // Fallback vers le fichier local
                const htmlPath = path.join(__dirname, 'public', 'index.html');
                mainWindow.loadFile(htmlPath).catch((fileError) => {
                    console.error('❌ Erreur chargement fichier:', fileError);
                });
            });
        }).catch((error) => {
            console.error('❌ Erreur serveur:', error);
            // En cas d'erreur, charger la page locale
            const htmlPath = path.join(__dirname, 'public', 'index.html');
            mainWindow.loadFile(htmlPath).catch((fileError) => {
                console.error('❌ Erreur chargement fichier:', fileError);
            });
        });
    } else {
        // En mode développement, charger depuis le serveur
        mainWindow.loadURL(SERVER_URL).catch((error) => {
            console.error('❌ Erreur chargement URL en dev:', error);
            // Fallback vers le fichier local
            const htmlPath = path.join(__dirname, 'public', 'index.html');
            mainWindow.loadFile(htmlPath).catch((fileError) => {
                console.error('❌ Erreur chargement fichier:', fileError);
            });
        });
    }

    // Afficher la fenêtre quand elle est prête
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Ouvrir les DevTools en mode développement
        if (isDev) {
            mainWindow.webContents.openDevTools();
        }
    });

    // Gérer la fermeture de la fenêtre
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Gérer l'ouverture des fenêtres de manière hybride
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        // Vérifier si c'est une feuille d'appel
        if (url.includes('attendance.html')) {
            // Créer une nouvelle fenêtre Electron pour les feuilles d'appel
            createAttendanceWindow(url);
            return { action: 'deny' };
        } else {
            // Pour les autres liens, ouvrir dans le navigateur par défaut
            shell.openExternal(url);
            return { action: 'deny' };
        }
    });
}

// Créer une fenêtre de feuille d'appel
function createAttendanceWindow(url) {
    console.log('📋 Création d\'une nouvelle fenêtre de feuille d\'appel:', url);
    
    // Extraire l'ID de la feuille d'appel pour l'utiliser comme clé
    const urlParams = new URL(url);
    const attendanceId = urlParams.searchParams.get('id') || 'unknown';
    
    // Vérifier si une fenêtre pour cette feuille d'appel existe déjà
    if (attendanceWindows.has(attendanceId)) {
        const existingWindow = attendanceWindows.get(attendanceId);
        if (!existingWindow.isDestroyed()) {
            existingWindow.focus();
            console.log('📋 Fenêtre existante mise au premier plan');
            return;
        } else {
            // Nettoyer la référence si la fenêtre a été fermée
            attendanceWindows.delete(attendanceId);
        }
    }
    
    const attendanceWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false,
        titleBarStyle: 'default',
        title: 'Feuille d\'appel - PERMAPPEL'
    });
    
    // Stocker la référence de la fenêtre
    attendanceWindows.set(attendanceId, attendanceWindow);
    
    // Charger l'URL de la feuille d'appel
    attendanceWindow.loadURL(url).catch((error) => {
        console.error('❌ Erreur lors du chargement de la feuille d\'appel:', error);
        // Fallback vers le fichier local
        const htmlPath = path.join(__dirname, 'public', 'attendance.html');
        attendanceWindow.loadFile(htmlPath).catch((fileError) => {
            console.error('❌ Erreur lors du chargement du fichier local:', fileError);
        });
    });
    
    // Afficher la fenêtre quand elle est prête
    attendanceWindow.once('ready-to-show', () => {
        attendanceWindow.show();
        console.log('✅ Fenêtre de feuille d\'appel affichée');
    });
    
    // Gérer la fermeture de la fenêtre
    attendanceWindow.on('closed', () => {
        console.log('📋 Fermeture de la fenêtre de feuille d\'appel:', attendanceId);
        attendanceWindows.delete(attendanceId);
    });
    
    // Ouvrir les liens externes dans le navigateur par défaut pour cette fenêtre aussi
    attendanceWindow.webContents.setWindowOpenHandler(({ url: externalUrl }) => {
        shell.openExternal(externalUrl);
        return { action: 'deny' };
    });
}

// Démarrer le serveur
function startServer() {
    return new Promise((resolve, reject) => {
        console.log('🚀 Démarrage du serveur PERMAPPEL...');
        
        // Afficher les logs dans l'interface si possible
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('server-log', '🚀 Démarrage du serveur PERMAPPEL...');
        }
        
        try {
            // Démarrer le serveur de manière asynchrone pour ne pas bloquer l'interface
            console.log('🚀 Démarrage du serveur en arrière-plan...');
            console.log('📁 Répertoire actuel:', __dirname);
            console.log('📁 Chemin serveur:', path.join(__dirname, 'server', 'server.js'));
            console.log('📁 Serveur existe:', fs.existsSync(path.join(__dirname, 'server', 'server.js')));
            
            // Utiliser setImmediate pour démarrer le serveur de manière asynchrone
            setImmediate(() => {
                console.log('🔄 Tentative d\'import du serveur...');
                try {
                    // Importer et démarrer le serveur
                    const serverModule = require('./server/server.js');
                    console.log('✅ Serveur importé avec succès');
                    
                    // Tester la connexion au serveur
                    const testServer = () => {
                        console.log('🔍 Test de connexion au serveur...');
                        const http = require('http');
                        // Utiliser 127.0.0.1 au lieu de localhost pour éviter les problèmes IPv6
                        const req = http.get('http://127.0.0.1:3001', (res) => {
                            console.log('✅ Serveur répond sur le port 3001');
                            if (mainWindow && mainWindow.webContents) {
                                mainWindow.webContents.send('server-log', '✅ Serveur prêt sur le port 3001');
                            }
                            resolve();
                        });
                        
                        req.on('error', (err) => {
                            console.log('⏳ Serveur pas encore prêt, nouvelle tentative dans 1s...', err.message);
                            setTimeout(testServer, 1000);
                        });
                        
                        req.setTimeout(2000, () => {
                            req.destroy();
                        });
                    };
                    
                    // Attendre un peu puis tester la connexion
                    setTimeout(testServer, 3000);
                } catch (error) {
                    console.error('❌ Erreur lors du démarrage du serveur:', error);
                    console.error('❌ Stack trace:', error.stack);
                    if (mainWindow && mainWindow.webContents) {
                        mainWindow.webContents.send('server-log', `❌ Erreur serveur: ${error.message}`);
                    }
                    reject(error);
                }
            });
            
            // Résoudre immédiatement pour ne pas bloquer l'interface
            resolve();
        } catch (error) {
            console.error('❌ Erreur lors du démarrage du serveur:', error);
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('server-log', `❌ Erreur serveur: ${error.message}`);
            }
            reject(error);
        }
    });
}

// Arrêter le serveur
function stopServer() {
    console.log('🛑 Arrêt du serveur...');
    // En mode intégré, le serveur s'arrête automatiquement avec l'application
    serverProcess = null;
}

// Créer le menu de l'application
function createMenu() {
    const template = [
        {
            label: 'Fichier',
            submenu: [
                {
                    label: 'Nouvelle feuille d\'appel',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow.webContents.send('menu-action', 'new-call');
                    }
                },
                {
                    label: 'Exporter',
                    submenu: [
                        {
                            label: 'Export PDF du jour',
                            accelerator: 'CmdOrCtrl+E',
                            click: () => {
                                mainWindow.webContents.send('menu-action', 'export-day');
                            }
                        },
                        {
                            label: 'Export PDF personnalisé',
                            click: () => {
                                mainWindow.webContents.send('menu-action', 'export-custom');
                            }
                        }
                    ]
                },
                { type: 'separator' },
                {
                    label: 'Quitter',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Édition',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' }
            ]
        },
        {
            label: 'Affichage',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Fenêtre',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        },
        {
            label: 'Aide',
            submenu: [
                {
                    label: 'À propos de PERMAPPEL',
                    click: () => {
                        const version = app.getVersion();
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'À propos de PERMAPPEL',
                            message: `PERMAPPEL v${version}`,
                            detail: 'Application d\'appel d\'élèves\n\nDéveloppé avec Electron et Node.js'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Gestionnaires d'événements de l'application
app.whenReady().then(() => {
    try {
        // Créer la fenêtre (qui démarrera le serveur si nécessaire)
        createWindow();
        
        // Créer le menu
        createMenu();
        
        console.log('✅ Application PERMAPPEL démarrée avec succès');
    } catch (error) {
        console.error('❌ Erreur lors du démarrage:', error);
        
        dialog.showErrorBox(
            'Erreur de démarrage',
            'Impossible de démarrer l\'application PERMAPPEL.\n\nVérifiez que tous les fichiers sont présents.'
        );
        
        app.quit();
    }
});

app.on('window-all-closed', () => {
    // Fermer toutes les fenêtres de feuilles d'appel
    attendanceWindows.forEach((window, id) => {
        if (!window.isDestroyed()) {
            window.close();
        }
    });
    attendanceWindows.clear();
    
    stopServer();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    // Fermer toutes les fenêtres de feuilles d'appel
    attendanceWindows.forEach((window, id) => {
        if (!window.isDestroyed()) {
            window.close();
        }
    });
    attendanceWindows.clear();
    
    stopServer();
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
    console.error('Erreur non capturée:', error);
    
    dialog.showErrorBox(
        'Erreur de l\'application',
        'Une erreur inattendue s\'est produite.\n\nL\'application va se fermer.'
    );
    
    app.quit();
});

// Gestion des erreurs de promesse non capturées
process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesse rejetée non gérée:', reason);
});
