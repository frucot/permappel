const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const os = require('os');
const DatabaseManager = require('./database');

class PermappelServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
                credentials: true
            }
        });
        
        this.db = new DatabaseManager();
        this.connectedUsers = new Map();
        this.activeAttendances = new Map(); // Pour gérer les conflits
        this.securityConfig = null; // Configuration de sécurité chargée depuis la DB
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
        
        // Log de tous les événements Socket.IO pour debug
        this.io.on('connection', (socket) => {
            console.log(`🔌 Nouvelle connexion Socket.IO: ${socket.id} depuis ${socket.handshake.address}`);
            
            // Log de tous les événements reçus
            socket.onAny((eventName, ...args) => {
                console.log(`📡 Événement reçu: ${eventName}`, args);
            });
        });
        this.setupAutoBackup();
    }

    setupMiddleware() {
        // Configurer Express pour extraire correctement l'IP client
        // Important pour les connexions réseau local
        this.app.set('trust proxy', true);
        
        // Middleware de restriction par IP (appliqué en premier)
        // La configuration est chargée depuis la base de données
        this.app.use(async (req, res, next) => {
            // Si la configuration n'est pas encore chargée, autoriser toutes les requêtes
            // (pour éviter de bloquer le démarrage)
            if (!this.securityConfig || !this.securityConfig.enabled) {
                return next();
            }
            
            // Récupérer l'IP source de la requête (plusieurs méthodes pour compatibilité)
            let clientIP = req.ip || 
                          req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                          req.connection?.remoteAddress || 
                          req.socket?.remoteAddress ||
                          (req.socket && req.socket.remoteAddress) ||
                          'unknown';
            
            // Nettoyer l'IP (enlever le préfixe ::ffff: si présent pour IPv4 mapped IPv6)
            // et extraire seulement l'IP si c'est au format "::ffff:IP"
            if (clientIP && clientIP.startsWith('::ffff:')) {
                clientIP = clientIP.replace(/^::ffff:/, '');
            }
            // Si l'IP contient un port (format "IP:port"), extraire seulement l'IP
            if (clientIP && clientIP.includes(':')) {
                const parts = clientIP.split(':');
                // Si c'est une IPv6 complète, garder tel quel, sinon prendre la première partie
                if (parts.length === 2 && !clientIP.includes('::')) {
                    clientIP = parts[0];
                }
            }
            
            // Vérifier si l'IP est autorisée
            const isAllowed = this.isIPAllowed(clientIP);
            if (!isAllowed) {
                console.warn(`🚫 Accès refusé depuis IP non autorisée: ${clientIP} - ${req.method} ${req.path}`);
                console.warn(`   IP brute: ${req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress}`);
                console.warn(`   Headers X-Forwarded-For: ${req.headers['x-forwarded-for']}`);
                console.warn(`   Configuration sécurité: enabled=${this.securityConfig.enabled}, IPs autorisées=${this.securityConfig.allowedIPs.length}, Plages=${this.securityConfig.allowedRanges.length}`);
                return res.status(403).json({
                    success: false,
                    message: 'Accès refusé : IP non autorisée'
                });
            }
            
            // IP autorisée, continuer
            next();
        });
        
        // Middleware CORS personnalisé pour gérer les requêtes cross-origin
        this.app.use((req, res, next) => {
            const origin = req.headers.origin;
            
            // Définir les headers CORS pour toutes les réponses
            res.setHeader('Access-Control-Allow-Origin', origin || '*');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-Foo, X-Bar');
            res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight pour 24h
            
            // Gérer les requêtes OPTIONS (preflight)
            if (req.method === 'OPTIONS') {
                console.log(`${new Date().toISOString()} - OPTIONS ${req.path} (preflight)`);
                // S'assurer que tous les headers CORS sont présents pour les requêtes OPTIONS
                res.setHeader('Access-Control-Allow-Origin', origin || '*');
                res.setHeader('Access-Control-Allow-Credentials', 'true');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
                res.setHeader('Access-Control-Max-Age', '86400');
                return res.status(200).end();
            }
            
            // Middleware de logging
            const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path} depuis ${clientIP}`);
            next();
        });
        
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '../public')));
        
        // Créer le dossier uploads dans le répertoire partagé
        this.setupUploadsDirectory();
    }

    setupUploadsDirectory() {
        try {
            let uploadsPath;
            
            if (process.platform === 'win32') {
                // Windows : utiliser ProgramData pour un accès partagé
                uploadsPath = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'PERMAPPEL', 'uploads');
            } else if (process.platform === 'darwin') {
                // macOS : utiliser /Library/Application Support
                uploadsPath = '/Library/Application Support/PERMAPPEL/uploads';
            } else {
                // Linux : utiliser /opt ou /var/lib
                uploadsPath = '/opt/PERMAPPEL/uploads';
            }
            
            if (!fs.existsSync(uploadsPath)) {
                fs.mkdirSync(uploadsPath, { recursive: true, mode: 0o755 });
                console.log('✅ Dossier uploads créé:', uploadsPath);
            }
        } catch (error) {
            console.warn('⚠️ Impossible de créer le dossier uploads:', error.message);
        }
    }

    // Charger la configuration de sécurité depuis la base de données
    async loadSecurityConfig() {
        try {
            const config = await this.db.executeQuery(
                'SELECT cle, valeur FROM config WHERE cle LIKE "security_%"'
            );
            
            const securityConfig = {
                enabled: false,
                allowedIPs: [],
                allowedRanges: []
            };
            
            // Parser les valeurs de configuration
            config.forEach(row => {
                const key = row.cle.replace('security_', '');
                if (key === 'enabled') {
                    securityConfig.enabled = row.valeur === 'true' || row.valeur === '1';
                } else if (key === 'allowedIPs') {
                    try {
                        securityConfig.allowedIPs = JSON.parse(row.valeur || '[]');
                    } catch (e) {
                        securityConfig.allowedIPs = [];
                    }
                } else if (key === 'allowedRanges') {
                    try {
                        securityConfig.allowedRanges = JSON.parse(row.valeur || '[]');
                    } catch (e) {
                        securityConfig.allowedRanges = [];
                    }
                }
            });
            
            // Si aucune configuration n'existe, initialiser avec les valeurs par défaut
            if (config.length === 0) {
                await this.initDefaultSecurityConfig();
                // Recharger après initialisation
                return this.loadSecurityConfig();
            }
            
            this.securityConfig = securityConfig;
            console.log('✅ Configuration de sécurité chargée:', {
                enabled: securityConfig.enabled,
                allowedIPs: securityConfig.allowedIPs.length,
                allowedRanges: securityConfig.allowedRanges.length
            });
        } catch (error) {
            console.error('❌ Erreur chargement configuration sécurité:', error);
            // Configuration par défaut en cas d'erreur
            this.securityConfig = {
                enabled: false,
                allowedIPs: [],
                allowedRanges: []
            };
        }
    }

    // Initialiser la configuration de sécurité par défaut
    async initDefaultSecurityConfig() {
        try {
            const defaultIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
            const defaultRanges = [{ base: '10.131.100', start: 1, end: 254 }];
            
            await this.db.executeQuery(
                'INSERT OR REPLACE INTO config (cle, valeur, description) VALUES (?, ?, ?)',
                ['security_enabled', 'false', 'Activer la restriction par IP']
            );
            await this.db.executeQuery(
                'INSERT OR REPLACE INTO config (cle, valeur, description) VALUES (?, ?, ?)',
                ['security_allowedIPs', JSON.stringify(defaultIPs), 'Liste des IPs autorisées (JSON array)']
            );
            await this.db.executeQuery(
                'INSERT OR REPLACE INTO config (cle, valeur, description) VALUES (?, ?, ?)',
                ['security_allowedRanges', JSON.stringify(defaultRanges), 'Plages d\'IPs autorisées (JSON array)']
            );
            
            console.log('✅ Configuration de sécurité par défaut initialisée');
        } catch (error) {
            console.error('❌ Erreur initialisation configuration sécurité:', error);
        }
    }

    // Vérifier si une IP est autorisée
    isIPAllowed(ip) {
        if (!ip || !this.securityConfig || ip === 'unknown') {
            // Si l'IP est inconnue et que la restriction est activée, refuser par sécurité
            // Sauf si la config n'est pas encore chargée (déjà géré dans le middleware)
            return false;
        }
        
        // Nettoyer l'IP (enlever le préfixe ::ffff: si présent pour IPv4 mapped IPv6)
        let cleanIP = ip.replace(/^::ffff:/, '');
        
        // Si l'IP contient un port (format "IP:port"), extraire seulement l'IP
        if (cleanIP.includes(':') && !cleanIP.match(/^\[.*\]$/)) {
            // Format IPv6 avec port: [::1]:port ou IPv4 avec port: 10.131.100.20:port
            const portMatch = cleanIP.match(/^\[(.+)\]:\d+$/);
            if (portMatch) {
                cleanIP = portMatch[1];
            } else {
                const parts = cleanIP.split(':');
                if (parts.length === 2 && !cleanIP.includes('::')) {
                    cleanIP = parts[0];
                }
            }
        }
        
        // Vérifier si c'est une IP autorisée explicitement
        if (this.securityConfig.allowedIPs.includes(ip) || 
            this.securityConfig.allowedIPs.includes(cleanIP)) {
            return true;
        }
        
        // Vérifier si c'est dans une plage autorisée
        for (const range of this.securityConfig.allowedRanges) {
            const ipPattern = new RegExp(`^${range.base.replace(/\./g, '\\.')}\\.(\\d{1,3})$`);
            const match = cleanIP.match(ipPattern);
            if (match) {
                const lastOctet = parseInt(match[1], 10);
                if (lastOctet >= range.start && lastOctet <= range.end) {
                    return true;
                }
            }
        }
        
        return false;
    }

    // Recharger la configuration de sécurité (appelé après modification)
    async reloadSecurityConfig() {
        await this.loadSecurityConfig();
    }

    setupRoutes() {
        // Route principale
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        // API Routes
        this.app.use('/api/auth', require('./routes/auth')(this.db));
        this.app.use('/api/students', require('./routes/students')(this.db));
        this.app.use('/api/attendance', require('./routes/attendance')(this.db, this.io));
        this.app.use('/api/schedules', require('./routes/schedules')(this.db));
        this.app.use('/api/admin', require('./routes/admin')(this.db, this));
        this.app.use('/api/export', require('./routes/export')(this.db));
        this.app.use('/api/import', require('./routes/import')(this.db));

        // Route pour obtenir l'IP du serveur
        this.app.get('/api/server-info', (req, res) => {
            const networkInterfaces = os.networkInterfaces();
            const localIPs = [];
            
            Object.keys(networkInterfaces).forEach(interfaceName => {
                networkInterfaces[interfaceName].forEach(netInterface => {
                    if (netInterface.family === 'IPv4' && !netInterface.internal) {
                        localIPs.push(netInterface.address);
                    }
                });
            });

            res.json({
                serverIP: localIPs[0] || 'localhost',
                port: this.server.address()?.port || 3000,
                connectedUsers: this.connectedUsers.size,
                uptime: process.uptime()
            });
        });
    }

    setupSocketHandlers() {
        // Middleware Socket.IO pour restriction IP (cohérent avec HTTP)
        this.io.use((socket, next) => {
            // Si la configuration n'est pas prête ou la restriction désactivée, on laisse passer
            if (!this.securityConfig || !this.securityConfig.enabled) {
                return next();
            }

            const clientIP =
                socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                socket.handshake.address ||
                socket.conn.remoteAddress;

            if (!this.isIPAllowed(clientIP)) {
                console.warn(`🚫 Connexion Socket.IO refusée: IP non autorisée ${clientIP}`);
                return next(new Error('IP non autorisée'));
            }

            next();
        });

        this.io.on('connection', (socket) => {
            console.log(`👤 Utilisateur connecté: ${socket.id}`);

            // Authentification socket
            socket.on('authenticate', async (data) => {
                try {
                    const user = await this.authenticateUser(data.token);
                    if (user) {
                        socket.userId = user.id;
                        socket.userName = `${user.prenom} ${user.nom}`;
                        this.connectedUsers.set(socket.id, {
                            id: user.id,
                            name: socket.userName,
                            role: user.role,
                            connectedAt: new Date()
                        });
                        
                        socket.emit('authenticated', { user });
                        this.broadcastUserList();
                        console.log(`✅ ${socket.userName} authentifié`);
                    } else {
                        socket.emit('auth_error', { message: 'Token invalide' });
                    }
                } catch (error) {
                    console.error('Erreur authentification:', error);
                    socket.emit('auth_error', { message: 'Erreur d\'authentification' });
                }
            });

            // Gestion des appels en temps réel
            socket.on('join-attendance', async (data) => {
                if (!socket.userId) return;
                
                const { attendanceId } = data;
                console.log(`📋 Utilisateur ${socket.userName} (${socket.userId}) rejoint la feuille ${attendanceId}`);
                console.log(`📋 Socket ID: ${socket.id}, Remote Address: ${socket.handshake.address}`);
                
                socket.join(`attendance-${attendanceId}`);
                
                // Ajouter l'utilisateur aux appels actifs
                if (!this.activeAttendances.has(attendanceId)) {
                    this.activeAttendances.set(attendanceId, new Set());
                }
                this.activeAttendances.get(attendanceId).add(socket.userId);
                
                // Notifier les autres utilisateurs de la nouvelle connexion
                socket.to(`attendance-${attendanceId}`).emit('user-joined-attendance', {
                    userId: socket.userId,
                    userName: socket.userName
                });
                
                // Envoyer la liste complète des utilisateurs connectés à tous les utilisateurs de cette feuille d'appel
                this.broadcastAttendanceUsers(attendanceId);
            });

            socket.on('leave-attendance', (data) => {
                const { attendanceId } = data;
                socket.leave(`attendance-${attendanceId}`);
                
                if (this.activeAttendances.has(attendanceId)) {
                    this.activeAttendances.get(attendanceId).delete(socket.userId);
                    if (this.activeAttendances.get(attendanceId).size === 0) {
                        this.activeAttendances.delete(attendanceId);
                    }
                }
                
                // Notifier les autres utilisateurs du départ
                socket.to(`attendance-${attendanceId}`).emit('user-left-attendance', {
                    userId: socket.userId,
                    userName: socket.userName
                });
                
                // Mettre à jour la liste des utilisateurs connectés pour les utilisateurs restants
                this.broadcastAttendanceUsers(attendanceId);
            });

            // Synchronisation des changements d'appel
            socket.on('attendance-change', async (data) => {
                if (!socket.userId) return;
                
                try {
                    const { attendanceId, studentId, status, notes } = data;
                    
                    // Mettre à jour en base avec gestion des conflits
                    const result = await this.updateAttendanceStatus(
                        attendanceId, studentId, status, notes, socket.userId
                    );
                    
                    if (result.success) {
                        // Diffuser le changement à tous les utilisateurs de cet appel
                        this.io.to(`attendance-${attendanceId}`).emit('attendance-updated', {
                            studentId,
                            status,
                            notes,
                            modifiedBy: socket.userId,
                            modifiedAt: new Date(),
                            version: result.version
                        });
                    } else {
                        socket.emit('attendance-error', { 
                            message: 'Conflit détecté, veuillez recharger' 
                        });
                    }
                } catch (error) {
                    console.error('Erreur mise à jour appel:', error);
                    socket.emit('attendance-error', { 
                        message: 'Erreur lors de la mise à jour' 
                    });
                }
            });

            // Déconnexion
            socket.on('disconnect', () => {
                console.log(`👋 Utilisateur déconnecté: ${socket.id}`);
                this.connectedUsers.delete(socket.id);
                this.broadcastUserList();
            });
        });
    }

    async authenticateUser(token) {
        // Implémentation simple de vérification de token
        // Dans un vrai projet, utiliser JWT
        try {
            const result = await this.db.executeQuery(
                'SELECT id, nomUtilisateur, nom, prenom, email, role FROM utilisateurs WHERE id = ?',
                [token]
            );
            return result[0] || null;
        } catch (error) {
            console.error('Erreur authentification:', error);
            return null;
        }
    }

    async updateAttendanceStatus(attendanceId, studentId, status, notes, userId) {
        try {
            // Utiliser une transaction pour éviter les conflits
            const result = await this.db.executeWithRetry(`
                UPDATE appels 
                SET statut = ?, notes = ?, modifiePar = ?, modifieLe = CURRENT_TIMESTAMP, version = version + 1
                WHERE id = ? AND eleveId = ?
            `, [status, notes, userId, attendanceId, studentId]);

            return { success: true, version: result.changes };
        } catch (error) {
            console.error('Erreur mise à jour statut:', error);
            return { success: false, error: error.message };
        }
    }

    broadcastUserList() {
        const userList = Array.from(this.connectedUsers.values());
        this.io.emit('users-updated', { users: userList });
    }

    // Diffuser la liste des utilisateurs connectés à une feuille d'appel spécifique
    broadcastAttendanceUsers(attendanceId) {
        if (!this.activeAttendances.has(attendanceId)) {
            console.log(`📋 Aucun utilisateur connecté à la feuille ${attendanceId}`);
            return;
        }

        const connectedUserIds = Array.from(this.activeAttendances.get(attendanceId));
        const usersList = [];

        console.log(`📋 Utilisateurs connectés à la feuille ${attendanceId}:`, connectedUserIds);

        // Récupérer les informations des utilisateurs connectés
        this.io.sockets.sockets.forEach(socket => {
            if (connectedUserIds.includes(socket.userId) && socket.userName) {
                usersList.push({
                    userId: socket.userId,
                    userName: socket.userName,
                    connectedAt: new Date()
                });
            }
        });

        console.log(`📋 Diffusion liste utilisateurs pour feuille ${attendanceId}:`, usersList);
        console.log(`📋 Nombre de sockets dans la room attendance-${attendanceId}:`, this.io.sockets.adapter.rooms.get(`attendance-${attendanceId}`)?.size || 0);

        // Envoyer la liste à tous les utilisateurs connectés à cette feuille d'appel
        this.io.to(`attendance-${attendanceId}`).emit('attendance-users-updated', {
            users: usersList
        });
    }

    setupAutoBackup() {
        // Sauvegarde automatique toutes les heures
        setInterval(() => {
            this.db.backupDatabase();
        }, 60 * 60 * 1000);
    }

    getNetworkInfo() {
        const networkInterfaces = os.networkInterfaces();
        const localIPs = [];
        
        Object.keys(networkInterfaces).forEach(interfaceName => {
            networkInterfaces[interfaceName].forEach(netInterface => {
                if (netInterface.family === 'IPv4' && !netInterface.internal) {
                    localIPs.push(netInterface.address);
                }
            });
        });

        return {
            localIPs,
            hostname: os.hostname(),
            platform: os.platform()
        };
    }

    async start(port = 3001) {
        // Charger la configuration de sécurité avant de démarrer le serveur
        await this.loadSecurityConfig();
        
        this.server.listen(port, '0.0.0.0', () => {
            const networkInfo = this.getNetworkInfo();
            console.log('\n🚀 Serveur PERMAPPEL démarré !');
            console.log('================================');
            console.log(`📡 Serveur: http://localhost:${port}`);
            console.log(`🌐 Réseau local:`);
            networkInfo.localIPs.forEach(ip => {
                console.log(`   http://${ip}:${port}`);
            });
            console.log('================================');
            console.log('💡 Les clients peuvent se connecter via les adresses réseau ci-dessus');
            console.log('📊 Interface admin: http://localhost:3001/admin');
        });
    }
}

// Démarrer le serveur
const server = new PermappelServer();
(async () => {
    await server.start(3001);
})();

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du serveur...');
    server.db.close();
    process.exit(0);
});

module.exports = PermappelServer;
