const path = require('path');
const fs = require('fs');

// Importer les modules depuis le dossier server
const sqlite3 = require('./server/node_modules/sqlite3').verbose();
const bcrypt = require('./server/node_modules/bcrypt');

// Configuration
const DB_PATH = path.join(__dirname, 'server', 'permappel.db');
const BACKUP_DIR = path.join(__dirname, 'server', 'backups');

// Créer le dossier de sauvegarde s'il n'existe pas
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Créer la base de données
const db = new sqlite3.Database(DB_PATH);

console.log('🚀 Initialisation de la base de données PERMAPPEL...');

// Créer les tables
db.serialize(() => {
    // Table des utilisateurs
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nomUtilisateur TEXT UNIQUE NOT NULL,
            nom TEXT NOT NULL,
            prenom TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            motDePasse TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'aed',
            actif INTEGER DEFAULT 1,
            dateCreation DATETIME DEFAULT CURRENT_TIMESTAMP,
            derniereConnexion DATETIME
        )
    `);

    // Table des créneaux
    db.run(`
        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            heureDebut TEXT NOT NULL,
            heureFin TEXT NOT NULL,
            description TEXT,
            actif INTEGER DEFAULT 1,
            dateCreation DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Table des élèves
    db.run(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT NOT NULL,
            prenom TEXT NOT NULL,
            classe TEXT NOT NULL,
            dateNaissance DATE,
            regime TEXT DEFAULT 'Externe',
            autorisationSortie TEXT DEFAULT 'ND',
            groupes TEXT,
            dateCreation DATETIME DEFAULT CURRENT_TIMESTAMP,
            dateModification DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Table des groupes
    db.run(`
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT UNIQUE NOT NULL,
            dateCreation DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Table des feuilles d'appel
    db.run(`
        CREATE TABLE IF NOT EXISTS attendances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            creneauId INTEGER,
            groupes TEXT,
            classes TEXT,
            statuts TEXT,
            totalEleves INTEGER DEFAULT 0,
            presents INTEGER DEFAULT 0,
            absents INTEGER DEFAULT 0,
            cdi INTEGER DEFAULT 0,
            excuses INTEGER DEFAULT 0,
            dateCreation DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (creneauId) REFERENCES schedules (id)
        )
    `);

    // Table des statuts d'élèves
    db.run(`
        CREATE TABLE IF NOT EXISTS student_attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            attendanceId INTEGER NOT NULL,
            studentId INTEGER NOT NULL,
            statut TEXT NOT NULL DEFAULT 'present',
            commentaire TEXT,
            dateModification DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (attendanceId) REFERENCES attendances (id),
            FOREIGN KEY (studentId) REFERENCES students (id),
            UNIQUE(attendanceId, studentId)
        )
    `);

    console.log('✅ Tables créées avec succès');

    // Insérer les données par défaut
    insertDefaultData();
});

// Insérer les données par défaut
function insertDefaultData() {
    console.log('📝 Insertion des données par défaut...');

    // Utilisateur administrateur par défaut
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(`
        INSERT OR IGNORE INTO users (nomUtilisateur, nom, prenom, email, motDePasse, role)
        VALUES ('admin', 'Administrateur', 'Admin', 'admin@etablissement.fr', ?, 'admin')
    `, [adminPassword]);

    // Créneaux par défaut
    const defaultSchedules = [
        { nom: 'M1', heureDebut: '08:00', heureFin: '09:00', description: 'Première heure du matin' },
        { nom: 'M2', heureDebut: '09:00', heureFin: '10:00', description: 'Deuxième heure du matin' },
        { nom: 'M3', heureDebut: '10:00', heureFin: '11:00', description: 'Troisième heure du matin' },
        { nom: 'M4', heureDebut: '11:00', heureFin: '12:00', description: 'Quatrième heure du matin' },
        { nom: 'S1', heureDebut: '13:00', heureFin: '14:00', description: 'Première heure de l\'après-midi' },
        { nom: 'S2', heureDebut: '14:00', heureFin: '15:00', description: 'Deuxième heure de l\'après-midi' },
        { nom: 'S3', heureDebut: '15:00', heureFin: '16:00', description: 'Troisième heure de l\'après-midi' },
        { nom: 'S4', heureDebut: '16:00', heureFin: '17:00', description: 'Quatrième heure de l\'après-midi' }
    ];

    defaultSchedules.forEach(schedule => {
        db.run(`
            INSERT OR IGNORE INTO schedules (nom, heureDebut, heureFin, description)
            VALUES (?, ?, ?, ?)
        `, [schedule.nom, schedule.heureDebut, schedule.heureFin, schedule.description]);
    });

    // Groupes par défaut
    const defaultGroups = [
        'Groupe A',
        'Groupe B', 
        'Option Maths',
        'Option Physique',
        'Option SVT',
        'Option Histoire',
        'Option Géographie',
        'Option Langues'
    ];

    defaultGroups.forEach(group => {
        db.run(`
            INSERT OR IGNORE INTO groups (nom)
            VALUES (?)
        `, [group]);
    });

    console.log('✅ Données par défaut insérées avec succès');
    console.log('🔑 Compte administrateur créé:');
    console.log('   - Nom d\'utilisateur: admin');
    console.log('   - Mot de passe: admin123');
    console.log('   - Email: admin@etablissement.fr');
    console.log('');
    console.log('⚠️  IMPORTANT: Changez le mot de passe administrateur après la première connexion !');
}

// Fermer la base de données
db.close((err) => {
    if (err) {
        console.error('❌ Erreur lors de la fermeture de la base de données:', err);
    } else {
        console.log('✅ Base de données initialisée avec succès !');
        console.log('📁 Base de données créée:', DB_PATH);
    }
});
