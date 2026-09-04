const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Configuration multer pour l'upload de fichiers
// Utiliser un répertoire accessible en écriture
const os = require('os');
let uploadsPath;

if (process.platform === 'win32') {
    // Windows : utiliser ProgramData pour un accès partagé
    uploadsPath = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'PERMAPPEL', 'uploads');
} else if (process.platform === 'darwin') {
    // macOS : utiliser le dossier utilisateur pour éviter les droits admin
    uploadsPath = path.join(os.homedir(), 'Library', 'Application Support', 'PERMAPPEL', 'uploads');
} else {
    // Linux : utiliser /opt ou /var/lib
    uploadsPath = '/opt/PERMAPPEL/uploads';
}

// Créer le répertoire s'il n'existe pas
if (!fs.existsSync(uploadsPath)) {
    try {
        fs.mkdirSync(uploadsPath, { recursive: true, mode: 0o755 });
        console.log('✅ Dossier uploads créé:', uploadsPath);
    } catch (error) {
        console.warn('⚠️ Impossible de créer le dossier uploads, utilisation du répertoire temporaire:', error.message);
        // Fallback vers le répertoire temporaire
        uploadsPath = os.tmpdir();
    }
}

const upload = multer({
    dest: uploadsPath,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Seuls les fichiers CSV sont autorisés'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max
    }
});

module.exports = (db) => {
    // Route pour télécharger le modèle CSV
    router.get('/template', (req, res) => {
        const templateContent = `Nom,Prénom,Classe,Groupes,Régime,Date de naissance
DUPONT,Jean,6 A,"6 Franc 1,Chorale",Demi-pensionnaire,15/03/2010
MARTIN,Marie,3 B,"3 BIL,3ANG2 gp1",Externe,22/07/2011`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="modele_eleves.csv"');
        res.send(templateContent);
    });

    // Route pour importer les élèves
    router.post('/students', upload.single('file'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Aucun fichier fourni'
            });
        }

        const results = {
            createdEntries: [],
            updatedEntries: [],
            skippedEntries: [],
            errors: []
        };

        try {
            const filePath = req.file.path;
            const students = [];

            // Lire et parser le fichier CSV
            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv({
                        separator: ',',
                        skipEmptyLines: true,
                        headers: ['nom', 'prenom', 'classe', 'groupes', 'regime', 'dateNaissance']
                    }))
                    .on('data', (row) => {
                        students.push(row);
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });

            console.log(`📊 ${students.length} lignes trouvées dans le CSV`);

            // Traiter chaque élève
            for (let i = 0; i < students.length; i++) {
                const row = students[i];
                const rowNumber = i + 2; // +2 car on commence à la ligne 2 (après l'en-tête)

                try {
                    // Validation des données
                    if (!row.nom || !row.prenom || !row.classe) {
                        results.errors.push({
                            row: rowNumber,
                            error: 'Nom, prénom et classe sont obligatoires'
                        });
                        continue;
                    }

                    // Nettoyer et formater les données
                    const studentData = {
                        nom: row.nom.trim(),
                        prenom: row.prenom.trim(),
                        classe: row.classe.trim(),
                        regime: row.regime && row.regime.trim() ? row.regime.trim() : 'Externe',
                        dateNaissance: formatDate(row.dateNaissance),
                        groupes: parseGroups(row.groupes)
                    };

                    // Vérifier si l'élève existe déjà
                    const existingStudents = await db.executeQuery(
                        'SELECT id FROM eleves WHERE nom = ? AND prenom = ? AND classe = ?',
                        [studentData.nom, studentData.prenom, studentData.classe]
                    );

                    if (existingStudents.length > 0) {
                        // Mettre à jour l'élève existant
                        await updateStudent(db, existingStudents[0].id, studentData);
                        results.updatedEntries.push(studentData);
                    } else {
                        // Créer un nouvel élève
                        const studentId = await createStudent(db, studentData);
                        studentData.id = studentId;
                        results.createdEntries.push(studentData);
                    }

                } catch (error) {
                    console.error(`Erreur ligne ${rowNumber}:`, error);
                    results.errors.push({
                        row: rowNumber,
                        error: error.message
                    });
                }
            }

            // Nettoyer le fichier temporaire
            fs.unlinkSync(filePath);

            // Retourner les résultats
            res.json({
                success: true,
                message: `Import terminé: ${results.createdEntries.length} créés, ${results.updatedEntries.length} mis à jour, ${results.errors.length} erreurs`,
                results: results
            });

        } catch (error) {
            console.error('Erreur import CSV:', error);
            
            // Nettoyer le fichier temporaire en cas d'erreur
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'import du fichier CSV',
                error: error.message
            });
        }
    });

    return router;
};

// Fonction pour formater la date
function formatDate(dateString) {
    if (!dateString || !dateString.trim()) return '1900-01-01'; // Date par défaut si vide
    
    const trimmed = dateString.trim();
    
    // Format DD/MM/YYYY vers YYYY-MM-DD
    const parts = trimmed.split('/');
    if (parts.length === 3) {
        const [day, month, year] = parts;
        // Validation basique
        if (day && month && year && 
            day.length <= 2 && month.length <= 2 && year.length === 4) {
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    }
    
    // Si le format n'est pas reconnu, retourner une date par défaut
    console.warn(`Date non reconnue: "${dateString}", utilisation de la date par défaut`);
    return '1900-01-01';
}

// Fonction pour parser les groupes
function parseGroups(groupsString) {
    if (!groupsString || !groupsString.trim()) return [];
    
    return groupsString
        .split(',')
        .map(group => group.trim())
        .filter(group => group.length > 0);
}

// Fonction pour créer un élève
async function createStudent(db, studentData) {
    // Insérer l'élève
    const result = await db.executeQuery(`
        INSERT INTO eleves (nom, prenom, classe, regime, dateNaissance, autorisationSortie)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        studentData.nom,
        studentData.prenom,
        studentData.classe,
        studentData.regime,
        studentData.dateNaissance,
        'ND' // Autorisation de sortie par défaut
    ]);

    const studentId = result.id;

    // Ajouter les groupes
    await addStudentGroups(db, studentId, studentData.groupes);

    return studentId;
}

// Fonction pour mettre à jour un élève
async function updateStudent(db, studentId, studentData) {
    // Mettre à jour les données de l'élève
    await db.executeQuery(`
        UPDATE eleves 
        SET regime = ?, dateNaissance = ?, modifieLe = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [studentData.regime, studentData.dateNaissance, studentId]);

    // Mettre à jour les groupes
    await db.executeQuery('DELETE FROM eleves_groupes WHERE eleveId = ?', [studentId]);
    await addStudentGroups(db, studentId, studentData.groupes);
}

// Fonction pour ajouter les groupes d'un élève
async function addStudentGroups(db, studentId, groups) {
    for (const groupName of groups) {
        // Vérifier si le groupe existe, sinon le créer
        let groupResult = await db.executeQuery(
            'SELECT id FROM groupes WHERE nom = ?',
            [groupName]
        );

        let groupId;
        if (groupResult.length === 0) {
            // Créer le groupe
            const newGroup = await db.executeQuery(
                'INSERT INTO groupes (nom, matiere, description) VALUES (?, ?, ?)',
                [groupName, 'Général', `Groupe créé automatiquement lors de l'import`]
            );
            groupId = newGroup.id;
        } else {
            groupId = groupResult[0].id;
        }

        // Associer l'élève au groupe
        await db.executeQuery(
            'INSERT OR IGNORE INTO eleves_groupes (eleveId, groupeId) VALUES (?, ?)',
            [studentId, groupId]
        );
    }
}
