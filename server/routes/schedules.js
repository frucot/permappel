const express = require('express');
const router = express.Router();

module.exports = (db) => {

    // GET /api/schedules - Récupérer tous les créneaux
    router.get('/', async (req, res) => {
        try {
            const schedules = await db.executeQuery('SELECT * FROM creneaux ORDER BY heureDebut');
            res.json({ success: true, schedules });
        } catch (error) {
            console.error('Erreur récupération créneaux:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    });

    // GET /api/schedules/:id - Récupérer un créneau par ID
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const schedules = await db.executeQuery('SELECT * FROM creneaux WHERE id = ?', [id]);
            
            if (schedules.length === 0) {
                return res.status(404).json({ success: false, message: 'Créneau non trouvé' });
            }
            
            res.json({ success: true, schedule: schedules[0] });
        } catch (error) {
            console.error('Erreur récupération créneau:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    });

    // POST /api/schedules - Créer un nouveau créneau
    router.post('/', async (req, res) => {
        try {
            const { nom, heureDebut, heureFin, description } = req.body;
            
            if (!nom || !heureDebut || !heureFin) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Nom, heure de début et heure de fin sont requis' 
                });
            }

            const result = await db.executeQuery(`
                INSERT INTO creneaux (nom, heureDebut, heureFin, description) 
                VALUES (?, ?, ?, ?)
            `, [nom, heureDebut, heureFin, description || '']);

            res.json({ 
                success: true, 
                message: 'Créneau créé avec succès',
                scheduleId: result.lastID 
            });
        } catch (error) {
            console.error('Erreur création créneau:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    });

    // PUT /api/schedules/:id - Modifier un créneau
    router.put('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { nom, heureDebut, heureFin, description } = req.body;
            
            console.log(`📝 Modification créneau ${id}:`, { nom, heureDebut, heureFin, description });
            console.log('📝 Headers reçus:', req.headers);
            console.log('📝 Body reçu:', req.body);
            
            if (!nom || !heureDebut || !heureFin) {
                console.log('❌ Validation échouée: paramètres manquants');
                return res.status(400).json({ 
                    success: false, 
                    message: 'Nom, heure de début et heure de fin sont requis' 
                });
            }

            const result = await db.executeQuery(`
                UPDATE creneaux 
                SET nom = ?, heureDebut = ?, heureFin = ?, description = ?, modifieLe = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [nom, heureDebut, heureFin, description || '', id]);

            console.log(`✅ Créneau ${id} modifié avec succès. Lignes affectées:`, result.changes);

            res.json({ success: true, message: 'Créneau modifié avec succès' });
        } catch (error) {
            console.error('❌ Erreur modification créneau:', error);
            console.error('❌ Stack trace:', error.stack);
            res.status(500).json({ success: false, message: 'Erreur serveur: ' + error.message });
        }
    });

    // DELETE /api/schedules/:id - Supprimer un créneau
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            // Vérifier si le créneau est utilisé dans des feuilles d'appel
            const attendanceCheck = await db.executeQuery(
                'SELECT COUNT(*) as count FROM feuilles_appel WHERE creneauId = ?', 
                [id]
            );
            
            if (attendanceCheck[0].count > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Impossible de supprimer ce créneau car il est utilisé dans des feuilles d\'appel' 
                });
            }

            await db.executeQuery('DELETE FROM creneaux WHERE id = ?', [id]);
            res.json({ success: true, message: 'Créneau supprimé avec succès' });
        } catch (error) {
            console.error('Erreur suppression créneau:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    });

    // Ne pas créer automatiquement les créneaux - ils doivent être créés manuellement via l'interface admin

    return router;
};
