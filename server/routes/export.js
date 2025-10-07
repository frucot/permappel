const express = require('express');
const router = express.Router();

module.exports = (db) => {
    // Export d'un appel spécifique
    router.get('/attendance/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            // Récupérer les données de l'appel
            const attendance = await db.executeQuery(`
                SELECT a.*, 
                       c.nom as creneauNom, c.heureDebut, c.heureFin,
                       e.nom, e.prenom, e.classe, e.regime, e.autorisationSortie
                FROM appels a
                JOIN creneaux c ON a.creneauId = c.id
                JOIN eleves e ON a.eleveId = e.id
                WHERE a.id = ?
                ORDER BY e.nom, e.prenom
            `, [id]);

            if (attendance.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Appel non trouvé' 
                });
            }

            // Générer le PDF (simulation)
            const pdfContent = generateAttendancePDF(attendance);
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="appel_${attendance[0].date}.pdf"`);
            res.send(pdfContent);

        } catch (error) {
            console.error('Erreur export appel:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Export de tous les appels d'une date
    router.get('/attendance/date/:date', async (req, res) => {
        try {
            const { date } = req.params;
            
            const attendances = await db.executeQuery(`
                SELECT a.*, 
                       c.nom as creneauNom, c.heureDebut, c.heureFin,
                       e.nom, e.prenom, e.classe, e.regime, e.autorisationSortie
                FROM appels a
                JOIN creneaux c ON a.creneauId = c.id
                JOIN eleves e ON a.eleveId = e.id
                WHERE a.date = ?
                ORDER BY c.heureDebut, e.nom, e.prenom
            `, [date]);

            if (attendances.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Aucun appel trouvé pour cette date' 
                });
            }

            // Générer le PDF (simulation)
            const pdfContent = generateDayAttendancePDF(attendances, date);
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="appels_${date}.pdf"`);
            res.send(pdfContent);

        } catch (error) {
            console.error('Erreur export journée:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Export de la liste des élèves
    router.get('/students', async (req, res) => {
        try {
            const students = await db.executeQuery(`
                SELECT e.*, 
                       GROUP_CONCAT(g.nom) as groupes
                FROM eleves e
                LEFT JOIN eleves_groupes eg ON e.id = eg.eleveId
                LEFT JOIN groupes g ON eg.groupeId = g.id
                WHERE e.actif = 1
                GROUP BY e.id
                ORDER BY e.classe, e.nom, e.prenom
            `);

            // Générer le PDF (simulation)
            const pdfContent = generateStudentsPDF(students);
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="liste_eleves_${new Date().toISOString().split('T')[0]}.pdf"`);
            res.send(pdfContent);

        } catch (error) {
            console.error('Erreur export élèves:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Fonction de génération PDF (simulation)
    function generateAttendancePDF(attendance) {
        // Pour l'instant, retourner un PDF simple
        // Dans un vrai projet, utiliser Puppeteer ou PDFKit
        const pdfHeader = `%PDF-1.3
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 200
>>
stream
BT
/F1 12 Tf
100 700 Td
(Feuille d'appel - ${attendance[0]?.date || 'Date'}) Tj
0 -20 Td
(${attendance[0]?.creneauNom || 'Créneau'}: ${attendance[0]?.heureDebut || ''} - ${attendance[0]?.heureFin || ''}) Tj
0 -20 Td
(Total élèves: ${attendance.length}) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
454
%%EOF`;

        return Buffer.from(pdfHeader);
    }

    function generateDayAttendancePDF(attendances, date) {
        // Simulation d'un PDF pour la journée
        return generateAttendancePDF(attendances);
    }

    function generateStudentsPDF(students) {
        // Simulation d'un PDF pour la liste des élèves
        return generateAttendancePDF(students);
    }

    return router;
};
