const express = require('express');
const router = express.Router();

module.exports = (db) => {
    // Obtenir tous les utilisateurs
    router.get('/users', async (req, res) => {
        try {
            const users = await db.executeQuery(
                'SELECT id, nomUtilisateur, nom, prenom, email, role, actif FROM utilisateurs ORDER BY nom, prenom'
            );

            res.json({
                success: true,
                users: users
            });

        } catch (error) {
            console.error('Erreur récupération utilisateurs:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Obtenir un utilisateur
    router.get('/users/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const users = await db.executeQuery(
                'SELECT id, nomUtilisateur, nom, prenom, email, role, actif FROM utilisateurs WHERE id = ?',
                [id]
            );

            if (users.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Utilisateur non trouvé' 
                });
            }

            res.json({
                success: true,
                user: users[0]
            });

        } catch (error) {
            console.error('Erreur récupération utilisateur:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Créer un utilisateur
    router.post('/users', async (req, res) => {
        try {
            const { username, email, role, firstName, lastName, password } = req.body;
            
            if (!username || !email || !role || !firstName || !lastName || !password) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Tous les champs sont requis' 
                });
            }

            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash(password, 10);

            const result = await db.executeQuery(`
                INSERT INTO utilisateurs (nomUtilisateur, email, role, nom, prenom, motDePasse)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [username, email, role, lastName, firstName, hashedPassword]);

            res.json({
                success: true,
                message: 'Utilisateur créé avec succès',
                userId: result.id
            });

        } catch (error) {
            console.error('Erreur création utilisateur:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Mettre à jour un utilisateur
    router.put('/users/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { username, email, role, firstName, lastName, password } = req.body;
            
            let query = `
                UPDATE utilisateurs 
                SET nomUtilisateur = ?, email = ?, role = ?, nom = ?, prenom = ?
                WHERE id = ?
            `;
            
            const params = [username, email, role, lastName, firstName, id];
            
            // Ajouter le mot de passe seulement s'il est fourni
            if (password && password.trim() !== '') {
                const bcrypt = require('bcrypt');
                const hashedPassword = await bcrypt.hash(password, 10);
                query = query.replace('WHERE id = ?', ', motDePasse = ? WHERE id = ?');
                params.splice(-1, 0, hashedPassword);
            }
            
            await db.executeQuery(query, params);

            res.json({
                success: true,
                message: 'Utilisateur mis à jour avec succès'
            });

        } catch (error) {
            console.error('Erreur mise à jour utilisateur:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Supprimer un utilisateur
    router.delete('/users/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            await db.executeQuery(
                'UPDATE utilisateurs SET actif = 0 WHERE id = ?',
                [id]
            );

            res.json({
                success: true,
                message: 'Utilisateur supprimé avec succès'
            });

        } catch (error) {
            console.error('Erreur suppression utilisateur:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Obtenir les créneaux
    router.get('/schedules', async (req, res) => {
        try {
            const schedules = await db.executeQuery(
                'SELECT * FROM creneaux ORDER BY heureDebut'
            );

            res.json({
                success: true,
                schedules: schedules
            });

        } catch (error) {
            console.error('Erreur récupération créneaux:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Créer un créneau
    router.post('/schedules', async (req, res) => {
        try {
            const { name, startTime, endTime, description } = req.body;
            
            if (!name || !startTime || !endTime) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Nom, heure de début et heure de fin requis' 
                });
            }

            const result = await db.executeQuery(`
                INSERT INTO creneaux (nom, heureDebut, heureFin, description)
                VALUES (?, ?, ?, ?)
            `, [name, startTime, endTime, description || '']);

            res.json({
                success: true,
                message: 'Créneau créé avec succès',
                scheduleId: result.id
            });

        } catch (error) {
            console.error('Erreur création créneau:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Obtenir les classes
    router.get('/classes', async (req, res) => {
        try {
            const classes = await db.executeQuery(
                'SELECT * FROM classes ORDER BY nom'
            );

            res.json({
                success: true,
                classes: classes
            });

        } catch (error) {
            console.error('Erreur récupération classes:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Obtenir les groupes
    router.get('/groups', async (req, res) => {
        try {
            const groups = await db.executeQuery(
                'SELECT * FROM groupes ORDER BY nom'
            );

            res.json({
                success: true,
                groups: groups
            });

        } catch (error) {
            console.error('Erreur récupération groupes:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Obtenir la configuration
    router.get('/config', async (req, res) => {
        try {
            const config = await db.executeQuery(
                'SELECT * FROM etablissement WHERE id = 1'
            );

            res.json({
                success: true,
                ...(config[0] || {})
            });

        } catch (error) {
            console.error('Erreur récupération config:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Sauvegarder la configuration
    router.put('/config', async (req, res) => {
        try {
            const { nom, adresse, telephone, email, directeur } = req.body;
            
            await db.executeQuery(`
                INSERT OR REPLACE INTO etablissement (id, nom, adresse, telephone, email, directeur, modifieLe)
                VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [nom, adresse, telephone, email, directeur]);

            res.json({
                success: true,
                message: 'Configuration sauvegardée avec succès'
            });

        } catch (error) {
            console.error('Erreur sauvegarde config:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // ===== GESTION DE LA BASE DE DONNÉES =====
    
    // Sauvegarder la base de données
    router.get('/database/backup', async (req, res) => {
        try {
            const fs = require('fs');
            const path = require('path');
            
            // Utiliser le même chemin que la base de données active
            const dbPath = db.dbPath;
            
            if (!fs.existsSync(dbPath)) {
                return res.status(404).json({
                    success: false,
                    message: 'Fichier de base de données non trouvé'
                });
            }
            
            // Lire le fichier de base de données
            const dbData = fs.readFileSync(dbPath);
            
            // Définir les headers pour le téléchargement
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="permappel_backup_${new Date().toISOString().split('T')[0]}.db"`);
            res.setHeader('Content-Length', dbData.length);
            
            res.send(dbData);
            
        } catch (error) {
            console.error('Erreur sauvegarde base de données:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur lors de la sauvegarde' 
            });
        }
    });

    // Supprimer uniquement les données des élèves
    router.post('/database/delete-students', async (req, res) => {
        try {
            // Supprimer les données liées aux élèves dans l'ordre correct (contraintes de clés étrangères)
            await db.executeQuery('DELETE FROM presences');
            await db.executeQuery('DELETE FROM feuilles_appel');
            await db.executeQuery('DELETE FROM eleves_groupes');
            await db.executeQuery('DELETE FROM eleves');
            
            res.json({
                success: true,
                message: 'Données des élèves supprimées avec succès'
            });
            
        } catch (error) {
            console.error('Erreur suppression élèves:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur lors de la suppression des élèves' 
            });
        }
    });

    // Réinitialiser complètement la base de données
    router.post('/database/reset', async (req, res) => {
        try {
            // Supprimer toutes les tables et recréer la base de données
            await db.executeQuery('DROP TABLE IF EXISTS presences');
            await db.executeQuery('DROP TABLE IF EXISTS feuilles_appel');
            await db.executeQuery('DROP TABLE IF EXISTS eleves_groupes');
            await db.executeQuery('DROP TABLE IF EXISTS eleves');
            await db.executeQuery('DROP TABLE IF EXISTS groupes');
            await db.executeQuery('DROP TABLE IF EXISTS classes');
            await db.executeQuery('DROP TABLE IF EXISTS creneaux');
            await db.executeQuery('DROP TABLE IF EXISTS utilisateurs');
            await db.executeQuery('DROP TABLE IF EXISTS etablissement');
            await db.executeQuery('DROP TABLE IF EXISTS config');
            
            // Recréer toutes les tables
            await db.createTables();
            
            // Insérer les données par défaut
            await db.insertDefaultData();
            
            res.json({
                success: true,
                message: 'Base de données réinitialisée avec succès'
            });
            
        } catch (error) {
            console.error('Erreur réinitialisation base de données:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur lors de la réinitialisation' 
            });
        }
    });

    // Obtenir les informations de l'établissement
    router.get('/establishment', async (req, res) => {
        try {
            const establishment = await db.executeQuery(
                'SELECT nom, adresse, telephone FROM etablissement LIMIT 1'
            );

            if (establishment.length === 0) {
                // Créer un établissement par défaut s'il n'existe pas
                await db.executeQuery(
                    'INSERT INTO etablissement (nom, adresse, telephone) VALUES (?, ?, ?)',
                    ['Établissement', 'Adresse non renseignée', 'Tél: Non renseigné']
                );
                
                res.json({
                    success: true,
                    establishment: {
                        nom: 'Établissement',
                        adresse: 'Adresse non renseignée',
                        telephone: 'Tél: Non renseigné'
                    }
                });
            } else {
                res.json({
                    success: true,
                    establishment: establishment[0]
                });
            }

        } catch (error) {
            console.error('Erreur récupération établissement:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Modifier les informations de l'établissement
    router.put('/establishment', async (req, res) => {
        try {
            const { nom, adresse, telephone } = req.body;
            
            if (!nom || !adresse || !telephone) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Tous les champs sont requis' 
                });
            }

            // Vérifier si l'établissement existe
            const existing = await db.executeQuery('SELECT id FROM etablissement LIMIT 1');
            
            if (existing.length === 0) {
                // Créer l'établissement
                await db.executeQuery(
                    'INSERT INTO etablissement (nom, adresse, telephone) VALUES (?, ?, ?)',
                    [nom, adresse, telephone]
                );
            } else {
                // Mettre à jour l'établissement
                await db.executeQuery(
                    'UPDATE etablissement SET nom = ?, adresse = ?, telephone = ? WHERE id = ?',
                    [nom, adresse, telephone, existing[0].id]
                );
            }

            res.json({
                success: true,
                message: 'Établissement mis à jour avec succès'
            });

        } catch (error) {
            console.error('Erreur modification établissement:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    return router;
};
