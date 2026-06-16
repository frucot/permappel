const path = require('path');
const fs = require('fs');

const sqlite3 = require('./server/node_modules/sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'server', 'permappel.db');
const BACKUP_DIR = path.join(__dirname, 'server', 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

console.log('🚀 Initialisation de la base de données PERMAPPEL...');

/** Aligné sur server/database.js (schéma français) + activites_cdi avant presences (FK). */
const createTables = `
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

    CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT UNIQUE NOT NULL,
        niveau TEXT,
        description TEXT,
        creeLe DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS groupes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT UNIQUE NOT NULL,
        matiere TEXT,
        description TEXT,
        creeLe DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS creneaux (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        heureDebut TIME NOT NULL,
        heureFin TIME NOT NULL,
        description TEXT,
        actif INTEGER DEFAULT 1,
        creeLe DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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

    CREATE TABLE IF NOT EXISTS eleves_groupes (
        eleveId INTEGER,
        groupeId INTEGER,
        PRIMARY KEY (eleveId, groupeId),
        FOREIGN KEY (eleveId) REFERENCES eleves(id) ON DELETE CASCADE,
        FOREIGN KEY (groupeId) REFERENCES groupes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS feuilles_appel (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL,
        creneauId INTEGER NOT NULL,
        classes TEXT,
        groupes TEXT,
        creePar INTEGER NOT NULL,
        creeLe DATETIME DEFAULT CURRENT_TIMESTAMP,
        modifieLe DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creneauId) REFERENCES creneaux(id),
        FOREIGN KEY (creePar) REFERENCES utilisateurs(id),
        UNIQUE(date, creneauId)
    );

    CREATE TABLE IF NOT EXISTS activites_cdi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        libelle TEXT UNIQUE NOT NULL,
        actif INTEGER DEFAULT 1,
        creeLe DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS presences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feuilleAppelId INTEGER NOT NULL,
        eleveId INTEGER NOT NULL,
        statut TEXT NOT NULL DEFAULT 'NON_APPELE',
        notes TEXT,
        activiteCdiId INTEGER,
        modifiePar INTEGER NOT NULL,
        modifieLe DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (feuilleAppelId) REFERENCES feuilles_appel(id) ON DELETE CASCADE,
        FOREIGN KEY (eleveId) REFERENCES eleves(id),
        FOREIGN KEY (activiteCdiId) REFERENCES activites_cdi(id),
        FOREIGN KEY (modifiePar) REFERENCES utilisateurs(id),
        UNIQUE(feuilleAppelId, eleveId)
    );

    CREATE TABLE IF NOT EXISTS etablissement (
        id INTEGER PRIMARY KEY,
        nom TEXT NOT NULL,
        adresse TEXT,
        telephone TEXT,
        email TEXT,
        directeur TEXT,
        modifieLe DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS config (
        cle TEXT PRIMARY KEY,
        valeur TEXT,
        description TEXT,
        modifieLe DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`;

db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');
    db.exec(createTables, (err) => {
        if (err) {
            console.error('❌ Erreur création tables:', err.message);
            process.exitCode = 1;
            return;
        }
        console.log('✅ Tables créées avec succès');
        ensureCdiSchemaMigrations(() => insertDefaultData());
    });
});

/** Bases déjà créées : CREATE IF NOT EXISTS ne rajoute pas activiteCdiId (cf. server/database.js ensureCdiSchema). */
function ensureCdiSchemaMigrations(done) {
    db.all(`SELECT name FROM pragma_table_info('presences')`, (pragmaErr, cols) => {
        if (pragmaErr) {
            console.error('❌ Vérification schéma presences:', pragmaErr.message);
            process.exitCode = 1;
            return;
        }
        if (!cols || cols.length === 0) {
            done();
            return;
        }
        const hasActivite = cols.some((c) => c.name === 'activiteCdiId');
        if (hasActivite) {
            done();
            return;
        }
        db.run(`ALTER TABLE presences ADD COLUMN activiteCdiId INTEGER`, (alterErr) => {
            if (alterErr) {
                console.error('❌ Migration colonne activiteCdiId:', alterErr.message);
                process.exitCode = 1;
                return;
            }
            console.log('✅ Colonne presences.activiteCdiId ajoutée (migration CDI)');
            done();
        });
    });
}

function insertDefaultData() {
    console.log('📝 Insertion des données par défaut...');

    const adminPassword = bcrypt.hashSync('admin123', 10);
    const defaultSchedules = [
        { nom: 'M1', heureDebut: '08:00', heureFin: '09:00', description: 'Première heure du matin' },
        { nom: 'M2', heureDebut: '09:00', heureFin: '10:00', description: 'Deuxième heure du matin' },
        { nom: 'M3', heureDebut: '10:00', heureFin: '11:00', description: 'Troisième heure du matin' },
        { nom: 'M4', heureDebut: '11:00', heureFin: '12:00', description: 'Quatrième heure du matin' },
        { nom: 'S1', heureDebut: '13:00', heureFin: '14:00', description: "Première heure de l'après-midi" },
        { nom: 'S2', heureDebut: '14:00', heureFin: '15:00', description: "Deuxième heure de l'après-midi" },
        { nom: 'S3', heureDebut: '15:00', heureFin: '16:00', description: "Troisième heure de l'après-midi" },
        { nom: 'S4', heureDebut: '16:00', heureFin: '17:00', description: "Quatrième heure de l'après-midi" }
    ];

    // File unique : tous les INSERT se terminent avant db.close() (évite prepare/finalize + close en course).
    db.serialize(() => {
        db.run(
            `
            INSERT OR IGNORE INTO utilisateurs (nomUtilisateur, nom, prenom, email, motDePasse, role)
            VALUES ('admin', 'Administrateur', 'Admin', 'admin@etablissement.fr', ?, 'admin')
            `,
            [adminPassword],
            (err) => {
                if (err) {
                    console.error('❌ Insert admin:', err.message);
                    process.exitCode = 1;
                }
            }
        );

        db.run(
            `
            INSERT OR IGNORE INTO groupes (nom) VALUES
            ('Groupe A'), ('Groupe B'), ('Option Maths'), ('Option Physique')
            `,
            (err) => {
                if (err) {
                    console.error('❌ Insert groupes:', err.message);
                    process.exitCode = 1;
                }
            }
        );

        db.run(
            `
            INSERT OR IGNORE INTO activites_cdi (libelle, actif) VALUES
            ('Recherche', 1),
            ('Lecture', 1),
            ('Travail de groupe', 1),
            ('Dessin', 1),
            ('Devoir informatique', 1)
            `,
            (err) => {
                if (err) {
                    console.error('❌ Insert activites_cdi:', err.message);
                    process.exitCode = 1;
                }
            }
        );

        db.run(
            `
            INSERT OR IGNORE INTO config (cle, valeur, description) VALUES
            ('cdi_kiosk_ip_restriction_enabled', 'false', 'Activer la restriction IP des bornes CDI'),
            ('cdi_kiosk_allowed_ips', '["127.0.0.1"]', 'Liste des IPs autorisées pour les bornes CDI (JSON array)')
            `,
            (err) => {
                if (err) {
                    console.error('❌ Insert config CDI:', err.message);
                    process.exitCode = 1;
                }
            }
        );

        for (const s of defaultSchedules) {
            db.run(
                'INSERT OR IGNORE INTO creneaux (nom, heureDebut, heureFin, description) VALUES (?, ?, ?, ?)',
                [s.nom, s.heureDebut, s.heureFin, s.description],
                (err) => {
                    if (err) {
                        console.error('❌ Insert creneau:', s.nom, err.message);
                        process.exitCode = 1;
                    }
                }
            );
        }

        db.close((closeErr) => {
            if (closeErr) {
                console.error('❌ Erreur lors de la fermeture de la base de données:', closeErr);
                process.exitCode = 1;
                return;
            }
            console.log('✅ Données par défaut insérées avec succès');
            console.log('🔑 Compte administrateur créé:');
            console.log('   - Nom d\'utilisateur: admin');
            console.log('   - Mot de passe: admin123');
            console.log('   - Email: admin@etablissement.fr');
            console.log('');
            console.log('⚠️  IMPORTANT: Changez le mot de passe administrateur après la première connexion !');
            console.log('✅ Base de données initialisée avec succès !');
            console.log('📁 Base de données créée:', DB_PATH);
        });
    });
}
