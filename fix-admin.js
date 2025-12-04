const path = require('path');
const sqlite3 = require('./server/node_modules/sqlite3').verbose();
const bcrypt = require('./server/node_modules/bcrypt');
const os = require('os');
const fs = require('fs');

// Déterminer le chemin de la base de données (même logique que DatabaseManager)
let sharedDataPath;

if (process.platform === 'win32') {
    sharedDataPath = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'PERMAPPEL');
} else if (process.platform === 'darwin') {
    sharedDataPath = '/Library/Application Support/PERMAPPEL';
} else {
    sharedDataPath = '/opt/PERMAPPEL';
}

// Fallback vers le répertoire utilisateur si nécessaire
if (!fs.existsSync(sharedDataPath)) {
    sharedDataPath = path.join(os.homedir(), 'PERMAPPEL');
}

const dbPath = path.join(sharedDataPath, 'permappel.db');

console.log('🔧 Script de réparation du compte administrateur');
console.log('📁 Chemin base de données:', dbPath);

if (!fs.existsSync(dbPath)) {
    console.error('❌ Base de données non trouvée à:', dbPath);
    console.log('💡 Essayez de démarrer le serveur d\'abord pour créer la base de données');
    process.exit(1);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erreur ouverture base de données:', err);
        process.exit(1);
    }
    console.log('✅ Base de données ouverte');
});

// Vérifier et créer l'utilisateur admin
db.serialize(() => {
    // Vérifier si l'utilisateur admin existe
    db.get('SELECT * FROM utilisateurs WHERE nomUtilisateur = ?', ['admin'], async (err, user) => {
        if (err) {
            console.error('❌ Erreur lors de la vérification:', err);
            db.close();
            process.exit(1);
        }

        if (user) {
            console.log('✅ Utilisateur admin trouvé');
            console.log('   - ID:', user.id);
            console.log('   - Nom d\'utilisateur:', user.nomUtilisateur);
            console.log('   - Email:', user.email);
            console.log('   - Rôle:', user.role);
            console.log('   - Actif:', user.actif ? 'Oui' : 'Non');
            
            // Réinitialiser le mot de passe
            const newPassword = 'admin123';
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            
            db.run(
                'UPDATE utilisateurs SET motDePasse = ?, role = ?, actif = 1 WHERE nomUtilisateur = ?',
                [hashedPassword, 'admin', 'admin'],
                function(updateErr) {
                    if (updateErr) {
                        console.error('❌ Erreur lors de la mise à jour:', updateErr);
                    } else {
                        console.log('✅ Mot de passe réinitialisé avec succès');
                        console.log('🔑 Identifiants:');
                        console.log('   - Nom d\'utilisateur: admin');
                        console.log('   - Mot de passe: admin123');
                    }
                    db.close();
                }
            );
        } else {
            console.log('⚠️ Utilisateur admin non trouvé, création...');
            
            // Créer l'utilisateur admin
            const adminPassword = await bcrypt.hash('admin123', 10);
            
            db.run(
                `INSERT INTO utilisateurs (nomUtilisateur, nom, prenom, email, motDePasse, role, actif)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ['admin', 'Administrateur', 'Admin', 'admin@etablissement.fr', adminPassword, 'admin', 1],
                function(insertErr) {
                    if (insertErr) {
                        console.error('❌ Erreur lors de la création:', insertErr);
                    } else {
                        console.log('✅ Utilisateur admin créé avec succès');
                        console.log('🔑 Identifiants:');
                        console.log('   - Nom d\'utilisateur: admin');
                        console.log('   - Mot de passe: admin123');
                        console.log('   - Email: admin@etablissement.fr');
                        console.log('   - Rôle: admin');
                    }
                    db.close();
                }
            );
        }
    });
});

