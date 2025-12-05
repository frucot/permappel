const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseManager {
    constructor() {
        this.db = null;
        // Utiliser un répertoire partagé accessible à tous les utilisateurs
        const os = require('os');
        let sharedDataPath;
        
        if (process.platform === 'win32') {
            // Windows : utiliser ProgramData pour un accès partagé
            sharedDataPath = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'PERMAPPEL');
        } else if (process.platform === 'darwin') {
            // macOS : utiliser /Library/Application Support
            sharedDataPath = '/Library/Application Support/PERMAPPEL';
        } else {
            // Linux : utiliser /opt ou /var/lib
            sharedDataPath = '/opt/PERMAPPEL';
        }
        
        // Créer le répertoire s'il n'existe pas
        if (!fs.existsSync(sharedDataPath)) {
            try {
                fs.mkdirSync(sharedDataPath, { recursive: true, mode: 0o777 });
                console.log('✅ Répertoire partagé créé:', sharedDataPath);
            } catch (error) {
                console.warn('⚠️ Impossible de créer le répertoire partagé, utilisation du répertoire utilisateur:', error.message);
                // Fallback vers le répertoire utilisateur si échec
                sharedDataPath = path.join(os.homedir(), 'PERMAPPEL');
                if (!fs.existsSync(sharedDataPath)) {
                    fs.mkdirSync(sharedDataPath, { recursive: true, mode: 0o777 });
                }
            }
        }
        
        // S'assurer que le répertoire a les bonnes permissions (Windows)
        if (process.platform === 'win32') {
            try {
                // Sur Windows, utiliser icacls pour donner les permissions à tous les utilisateurs
                const { execSync } = require('child_process');
                
                // Essayer plusieurs groupes pour une meilleure compatibilité AD
                const permissionGroups = [
                    '"BUILTIN\\Utilisateurs"',  // Utilisateurs locaux
                    '"Authenticated Users"',    // Utilisateurs authentifiés (inclut AD)
                    '"Domain Users"',           // Utilisateurs du domaine (si dans un domaine)
                    '"Everyone"'                // Tous (fallback)
                ];
                
                for (const group of permissionGroups) {
                    try {
                        execSync(`icacls "${sharedDataPath}" /grant ${group}:F /T`, { stdio: 'ignore' });
                        console.log(`✅ Permissions accordées au groupe ${group}:`, sharedDataPath);
                        break; // Si ça marche, on s'arrête
                    } catch (groupError) {
                        console.warn(`⚠️ Impossible d'accorder les permissions au groupe ${group}:`, groupError.message);
                    }
                }
                
                console.log('✅ Permissions Windows du répertoire mises à jour:', sharedDataPath);
            } catch (error) {
                console.warn('⚠️ Impossible de modifier les permissions Windows du répertoire:', error.message);
            }
        } else {
            try {
                fs.chmodSync(sharedDataPath, 0o777);
                console.log('✅ Permissions du répertoire mises à jour:', sharedDataPath);
            } catch (error) {
                console.warn('⚠️ Impossible de modifier les permissions du répertoire:', error.message);
            }
        }
        
        this.dbPath = path.join(sharedDataPath, 'permappel.db');
        console.log('📁 Chemin base de données:', this.dbPath);
        this.initDatabase();
    }

    initDatabase() {
        // Créer le dossier si nécessaire
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true, mode: 0o777 });
        }

        // S'assurer que le répertoire a les bonnes permissions (Windows)
        if (process.platform === 'win32') {
            try {
                // Sur Windows, utiliser icacls pour donner les permissions à tous les utilisateurs
                const { execSync } = require('child_process');
                
                // Essayer plusieurs groupes pour une meilleure compatibilité AD
                const permissionGroups = [
                    '"BUILTIN\\Utilisateurs"',  // Utilisateurs locaux
                    '"Authenticated Users"',    // Utilisateurs authentifiés (inclut AD)
                    '"Domain Users"',           // Utilisateurs du domaine (si dans un domaine)
                    '"Everyone"'                // Tous (fallback)
                ];
                
                for (const group of permissionGroups) {
                    try {
                        execSync(`icacls "${dbDir}" /grant ${group}:F /T`, { stdio: 'ignore' });
                        console.log(`✅ Permissions BDD accordées au groupe ${group}`);
                        break; // Si ça marche, on s'arrête
                    } catch (groupError) {
                        console.warn(`⚠️ Impossible d'accorder les permissions BDD au groupe ${group}:`, groupError.message);
                    }
                }
                
                console.log('✅ Permissions Windows du répertoire BDD mises à jour');
            } catch (error) {
                console.warn('⚠️ Impossible de modifier les permissions Windows du répertoire BDD:', error.message);
            }
        } else {
            try {
                fs.chmodSync(dbDir, 0o777);
            } catch (error) {
                console.warn('⚠️ Impossible de modifier les permissions du répertoire BDD:', error.message);
            }
        }

        // Configuration SQLite optimisée pour multi-utilisateurs
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Erreur ouverture base de données:', err.message);
            } else {
                console.log('✅ Base de données SQLite connectée');
                
                // Vérifier et corriger les permissions de la base de données
                try {
                    const stats = fs.statSync(this.dbPath);
                    console.log('📊 Permissions base de données:', stats.mode.toString(8));
                    
                    // Sur Windows, s'assurer que le fichier a les bonnes permissions
                    if (process.platform === 'win32') {
                        const { execSync } = require('child_process');
                        
                        // Essayer plusieurs groupes pour une meilleure compatibilité AD
                        const permissionGroups = [
                            '"BUILTIN\\Utilisateurs"',  // Utilisateurs locaux
                            '"Authenticated Users"',    // Utilisateurs authentifiés (inclut AD)
                            '"Domain Users"',           // Utilisateurs du domaine (si dans un domaine)
                            '"Everyone"'                // Tous (fallback)
                        ];
                        
                        for (const group of permissionGroups) {
                            try {
                                execSync(`icacls "${this.dbPath}" /grant ${group}:F`, { stdio: 'ignore' });
                                console.log(`✅ Permissions fichier BDD accordées au groupe ${group}`);
                                break; // Si ça marche, on s'arrête
                            } catch (groupError) {
                                console.warn(`⚠️ Impossible d'accorder les permissions fichier BDD au groupe ${group}:`, groupError.message);
                            }
                        }
                        
                        console.log('✅ Permissions Windows du fichier base de données mises à jour');
                    }
                } catch (error) {
                    console.warn('⚠️ Impossible de vérifier/corriger les permissions de la base de données:', error.message);
                }
                
                this.setupDatabase();
            }
        });

        // Configuration pour éviter les conflits
        this.db.serialize(() => {
            // Activer WAL mode pour de meilleures performances concurrentes
            this.db.run("PRAGMA journal_mode = WAL");
            // Augmenter le timeout pour éviter les locks
            this.db.run("PRAGMA busy_timeout = 30000");
            // Activer les foreign keys
            this.db.run("PRAGMA foreign_keys = ON");
            // Optimiser les performances
            this.db.run("PRAGMA synchronous = NORMAL");
            this.db.run("PRAGMA cache_size = 10000");
        });
    }

    setupDatabase() {
        const createTables = `
            -- Table des utilisateurs
            CREATE TABLE IF NOT EXISTS utilisateurs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nomUtilisateur TEXT UNIQUE NOT NULL,
                nom TEXT NOT NULL,
                prenom TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                motDePasse TEXT NOT NULL,
                role TEXT DEFAULT 'Professeur',
                actif INTEGER DEFAULT 1,
                creeLe DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Table des classes
            CREATE TABLE IF NOT EXISTS classes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nom TEXT UNIQUE NOT NULL,
                niveau TEXT,
                description TEXT,
                creeLe DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Table des groupes
            CREATE TABLE IF NOT EXISTS groupes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nom TEXT UNIQUE NOT NULL,
                matiere TEXT,
                description TEXT,
                creeLe DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Table des créneaux horaires
            CREATE TABLE IF NOT EXISTS creneaux (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nom TEXT NOT NULL,
                heureDebut TIME NOT NULL,
                heureFin TIME NOT NULL,
                description TEXT,
                actif INTEGER DEFAULT 1,
                creeLe DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Table des élèves
            CREATE TABLE IF NOT EXISTS eleves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nom TEXT NOT NULL,
                prenom TEXT NOT NULL,
                dateNaissance DATE DEFAULT '1900-01-01',
                classe TEXT NOT NULL,
                regime TEXT DEFAULT 'Externe',
                autorisationSortie TEXT DEFAULT 'ND',
                actif INTEGER DEFAULT 1,
                creeLe DATETIME DEFAULT CURRENT_TIMESTAMP,
                modifieLe DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Table de liaison élèves-groupes
            CREATE TABLE IF NOT EXISTS eleves_groupes (
                eleveId INTEGER,
                groupeId INTEGER,
                PRIMARY KEY (eleveId, groupeId),
                FOREIGN KEY (eleveId) REFERENCES eleves(id) ON DELETE CASCADE,
                FOREIGN KEY (groupeId) REFERENCES groupes(id) ON DELETE CASCADE
            );

            -- Table des feuilles d'appel (selon spécifications)
            CREATE TABLE IF NOT EXISTS feuilles_appel (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL,
                creneauId INTEGER NOT NULL,
                classes TEXT, -- JSON array des classes concernées
                groupes TEXT, -- JSON array des groupes concernés
                creePar INTEGER NOT NULL,
                creeLe DATETIME DEFAULT CURRENT_TIMESTAMP,
                modifieLe DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (creneauId) REFERENCES creneaux(id),
                FOREIGN KEY (creePar) REFERENCES utilisateurs(id),
                UNIQUE(date, creneauId)
            );

            -- Table des présences individuelles
            CREATE TABLE IF NOT EXISTS presences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                feuilleAppelId INTEGER NOT NULL,
                eleveId INTEGER NOT NULL,
                statut TEXT NOT NULL DEFAULT 'NON_APPELE',
                notes TEXT,
                modifiePar INTEGER NOT NULL,
                modifieLe DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (feuilleAppelId) REFERENCES feuilles_appel(id) ON DELETE CASCADE,
                FOREIGN KEY (eleveId) REFERENCES eleves(id),
                FOREIGN KEY (modifiePar) REFERENCES utilisateurs(id),
                UNIQUE(feuilleAppelId, eleveId)
            );

            -- Table de l'établissement
            CREATE TABLE IF NOT EXISTS etablissement (
                id INTEGER PRIMARY KEY,
                nom TEXT NOT NULL,
                adresse TEXT,
                telephone TEXT,
                email TEXT,
                directeur TEXT,
                modifieLe DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Table de configuration
            CREATE TABLE IF NOT EXISTS config (
                cle TEXT PRIMARY KEY,
                valeur TEXT,
                description TEXT,
                modifieLe DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `;

        this.db.exec(createTables, (err) => {
            if (err) {
                console.error('Erreur création tables:', err.message);
            } else {
                console.log('✅ Tables créées avec succès');
                this.insertDefaultData();
            }
        });
    }

    async insertDefaultData() {
        try {
            // Insérer un utilisateur admin par défaut
            const adminPassword = require('bcrypt').hashSync('admin123', 10);
            
            await this.executeQuery(`
                INSERT OR IGNORE INTO utilisateurs 
                (nomUtilisateur, nom, prenom, email, motDePasse, role) 
                VALUES ('admin', 'Administrateur', 'Admin', 'admin@etablissement.fr', ?, 'admin')
            `, [adminPassword]);

            // Mettre à jour le rôle de l'utilisateur admin existant s'il a l'ancien format
            await this.executeQuery(`
                UPDATE utilisateurs 
                SET role = 'admin' 
                WHERE nomUtilisateur = 'admin' AND role = 'Administrateur'
            `);

            // Insérer quelques groupes de test
            await this.executeQuery(`
                INSERT OR IGNORE INTO groupes (nom) VALUES 
                ('Groupe A'), ('Groupe B'), ('Option Maths'), ('Option Physique')
            `);

            console.log('✅ Données par défaut vérifiées');
        } catch (error) {
            console.error('Erreur insertion données par défaut:', error);
        }
    }

    // Méthodes pour gérer les conflits de concurrence
    async executeWithRetry(query, params = [], maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await this.executeQuery(query, params);
            } catch (error) {
                if (error.code === 'SQLITE_BUSY' && i < maxRetries - 1) {
                    console.log(`Tentative ${i + 1} échouée, retry dans 100ms...`);
                    await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
                    continue;
                }
                throw error;
            }
        }
    }

    executeQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            if (query.trim().toUpperCase().startsWith('SELECT')) {
                this.db.all(query, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            } else {
                this.db.run(query, params, function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, changes: this.changes });
                });
            }
        });
    }

    // Sauvegarde automatique
    backupDatabase() {
        // Utiliser le même répertoire que la base de données pour les sauvegardes
        const dbDir = path.dirname(this.dbPath);
        const backupDir = path.join(dbDir, 'backups');
        const backupPath = path.join(backupDir, `permappel_backup_${Date.now()}.db`);
        
        if (!fs.existsSync(backupDir)) {
            try {
                fs.mkdirSync(backupDir, { recursive: true, mode: 0o755 });
            } catch (error) {
                console.error('Erreur création dossier sauvegarde:', error);
                return;
            }
        }

        this.db.backup(backupPath, (err) => {
            if (err) {
                console.error('Erreur sauvegarde:', err);
            } else {
                console.log(`✅ Sauvegarde créée: ${backupPath}`);
                // Nettoyer les anciennes sauvegardes après chaque nouvelle sauvegarde
                this.cleanOldBackups(backupDir);
            }
        });
    }

    // Nettoyer les anciennes sauvegardes
    // Garde les sauvegardes des 30 derniers jours et un maximum de 100 sauvegardes
    cleanOldBackups(backupDir) {
        try {
            if (!fs.existsSync(backupDir)) {
                return;
            }

            const files = fs.readdirSync(backupDir);
            const backupFiles = files
                .filter(file => file.startsWith('permappel_backup_') && file.endsWith('.db'))
                .map(file => {
                    const filePath = path.join(backupDir, file);
                    const stats = fs.statSync(filePath);
                    // Extraire le timestamp du nom de fichier
                    const match = file.match(/permappel_backup_(\d+)\.db/);
                    const timestamp = match ? parseInt(match[1], 10) : stats.mtime.getTime();
                    return {
                        name: file,
                        path: filePath,
                        timestamp: timestamp,
                        date: new Date(timestamp),
                        size: stats.size
                    };
                })
                .sort((a, b) => b.timestamp - a.timestamp); // Plus récentes en premier

            const now = Date.now();
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000); // 30 jours en millisecondes
            const maxBackups = 100; // Maximum de sauvegardes à conserver

            let deletedCount = 0;
            let deletedSize = 0;

            // Supprimer les sauvegardes de plus de 30 jours
            for (const file of backupFiles) {
                if (file.timestamp < thirtyDaysAgo) {
                    try {
                        deletedSize += file.size;
                        fs.unlinkSync(file.path);
                        deletedCount++;
                        console.log(`🗑️  Sauvegarde supprimée (plus de 30 jours): ${file.name}`);
                    } catch (error) {
                        console.warn(`⚠️  Impossible de supprimer ${file.name}:`, error.message);
                    }
                }
            }

            // Si on a encore plus de maxBackups sauvegardes, supprimer les plus anciennes
            const remainingBackups = backupFiles.filter(f => !fs.existsSync(f.path) || f.timestamp >= thirtyDaysAgo);
            if (remainingBackups.length > maxBackups) {
                const toDelete = remainingBackups.slice(maxBackups);
                for (const file of toDelete) {
                    if (fs.existsSync(file.path)) {
                        try {
                            deletedSize += file.size;
                            fs.unlinkSync(file.path);
                            deletedCount++;
                            console.log(`🗑️  Sauvegarde supprimée (limite de ${maxBackups} atteinte): ${file.name}`);
                        } catch (error) {
                            console.warn(`⚠️  Impossible de supprimer ${file.name}:`, error.message);
                        }
                    }
                }
            }

            if (deletedCount > 0) {
                const deletedSizeMB = (deletedSize / (1024 * 1024)).toFixed(2);
                console.log(`🧹 Nettoyage terminé: ${deletedCount} sauvegarde(s) supprimée(s), ${deletedSizeMB} MB libérés`);
            }
        } catch (error) {
            console.warn('⚠️  Erreur lors du nettoyage des sauvegardes:', error.message);
        }
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Erreur fermeture base de données:', err.message);
                } else {
                    console.log('✅ Base de données fermée');
                }
            });
        }
    }
}

module.exports = DatabaseManager;
