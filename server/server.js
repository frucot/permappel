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
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
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
        this.app.use('/api/admin', require('./routes/admin')(this.db));
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

    start(port = 3001) {
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
server.start(3001);

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du serveur...');
    server.db.close();
    process.exit(0);
});

module.exports = PermappelServer;
