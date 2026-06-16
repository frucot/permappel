const express = require('express');
const router = express.Router();
const createCdiKioskIpHelpers = require('../middleware/cdiKioskIpRestriction');

module.exports = (db) => {
    const { enforceKioskIPRestriction } = createCdiKioskIpHelpers(db);

    // Autocomplete pour la borne CDI (même restriction IP que /cdi/checkin si activée)
    router.get('/autocomplete', enforceKioskIPRestriction, async (req, res) => {
        try {
            const query = (req.query.q || '').trim();
            if (query.length < 1) {
                return res.json({ success: true, students: [] });
            }

            const students = await db.executeQuery(`
                SELECT id, nom, prenom, classe
                FROM eleves
                WHERE actif = 1
                AND (nom LIKE ? OR prenom LIKE ?)
                ORDER BY nom ASC, prenom ASC
                LIMIT 20
            `, [`${query}%`, `${query}%`]);

            res.json({ success: true, students });
        } catch (error) {
            console.error('Erreur autocomplete élèves:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    });

    // Obtenir tous les élèves
    router.get('/', async (req, res) => {
        try {
            const { search, class: className, group } = req.query;
            
            let query = `
                SELECT e.*, 
                       GROUP_CONCAT(g.nom) as groupes
                FROM eleves e
                LEFT JOIN eleves_groupes eg ON e.id = eg.eleveId
                LEFT JOIN groupes g ON eg.groupeId = g.id
                WHERE e.actif = 1
            `;
            
            const params = [];
            
            if (search) {
                query += ' AND (e.nom LIKE ? OR e.prenom LIKE ?)';
                params.push(`%${search}%`, `%${search}%`);
            }
            
            if (className) {
                query += ' AND e.classe = ?';
                params.push(className);
            }
            
            query += ' GROUP BY e.id ORDER BY e.nom, e.prenom';
            
            const students = await db.executeQuery(query, params);
            
            // Transformer les groupes en tableau
            const formattedStudents = students.map(student => ({
                ...student,
                groups: student.groupes ? student.groupes.split(',') : []
            }));
            
            res.json({
                success: true,
                students: formattedStudents
            });

        } catch (error) {
            console.error('Erreur récupération élèves:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Obtenir un élève par ID
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const students = await db.executeQuery(
                'SELECT * FROM eleves WHERE id = ? AND actif = 1',
                [id]
            );

            if (students.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Élève non trouvé' 
                });
            }

            // Récupérer les groupes de l'élève
            const groups = await db.executeQuery(`
                SELECT g.nom FROM groupes g
                JOIN eleves_groupes eg ON g.id = eg.groupeId
                WHERE eg.eleveId = ?
            `, [id]);

            res.json({
                success: true,
                student: {
                    ...students[0],
                    groups: groups.map(g => g.nom)
                }
            });

        } catch (error) {
            console.error('Erreur récupération élève:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Créer un élève
    router.post('/', async (req, res) => {
        try {
            const { firstName, lastName, class: className, birthDate, regime, groups, exitPermissions } = req.body;
            
            if (!firstName || !lastName || !className || !birthDate) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Champs obligatoires manquants' 
                });
            }

            // Insérer l'élève
            const result = await db.executeQuery(`
                INSERT INTO eleves (prenom, nom, classe, dateNaissance, regime, autorisationSortie)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [firstName, lastName, className, birthDate, regime || 'Externe', exitPermissions || 'ND']);

            const studentId = result.id;

            // Ajouter les groupes
            if (groups && groups.length > 0) {
                for (const groupName of groups) {
                    // Trouver l'ID du groupe
                    const groupResult = await db.executeQuery(
                        'SELECT id FROM groupes WHERE nom = ?',
                        [groupName]
                    );
                    
                    if (groupResult.length > 0) {
                        await db.executeQuery(
                            'INSERT OR IGNORE INTO eleves_groupes (eleveId, groupeId) VALUES (?, ?)',
                            [studentId, groupResult[0].id]
                        );
                    }
                }
            }

            res.json({
                success: true,
                message: 'Élève créé avec succès',
                studentId: studentId
            });

        } catch (error) {
            console.error('Erreur création élève:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Mettre à jour un élève
    router.put('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { firstName, lastName, class: className, birthDate, regime, groups, exitPermissions } = req.body;
            
            console.log('Mise à jour élève:', { id, firstName, lastName, className, birthDate, regime, groups, exitPermissions });
            
            // Mettre à jour l'élève
            await db.executeQuery(`
                UPDATE eleves 
                SET prenom = ?, nom = ?, classe = ?, dateNaissance = ?, regime = ?, autorisationSortie = ?, modifieLe = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [firstName, lastName, className, birthDate, regime, exitPermissions, id]);

            // Mettre à jour les groupes
            if (groups) {
                // Supprimer les groupes existants
                await db.executeQuery('DELETE FROM eleves_groupes WHERE eleveId = ?', [id]);
                
                // Ajouter les nouveaux groupes
                for (const groupName of groups) {
                    const groupResult = await db.executeQuery(
                        'SELECT id FROM groupes WHERE nom = ?',
                        [groupName]
                    );
                    
                    if (groupResult.length > 0) {
                        await db.executeQuery(
                            'INSERT INTO eleves_groupes (eleveId, groupeId) VALUES (?, ?)',
                            [id, groupResult[0].id]
                        );
                    }
                }
            }

            res.json({
                success: true,
                message: 'Élève mis à jour avec succès'
            });

        } catch (error) {
            console.error('Erreur mise à jour élève:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Supprimer un élève
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            // Marquer comme inactif au lieu de supprimer
            await db.executeQuery(
                'UPDATE eleves SET actif = 0 WHERE id = ?',
                [id]
            );

            res.json({
                success: true,
                message: 'Élève supprimé avec succès'
            });

        } catch (error) {
            console.error('Erreur suppression élève:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Obtenir les classes
    router.get('/classes/list', async (req, res) => {
        try {
            const classes = await db.executeQuery(
                'SELECT DISTINCT classe as name FROM eleves WHERE actif = 1 ORDER BY classe'
            );

            res.json({
                success: true,
                classes: classes.map(c => c.name)
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
    router.get('/groups/list', async (req, res) => {
        try {
            const groups = await db.executeQuery(
                'SELECT id, nom as name FROM groupes ORDER BY nom'
            );

            res.json({
                success: true,
                groups: groups.map(g => g.name) // Retourner directement les noms des groupes
            });

        } catch (error) {
            console.error('Erreur récupération groupes:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur'
            });
        }
    });

    // Créer un nouveau groupe
    router.post('/groups', async (req, res) => {
        try {
            const { groupName } = req.body;
            
            if (!groupName || groupName.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Le nom du groupe est requis'
                });
            }

            // Vérifier si le groupe existe déjà
            const existingGroup = await db.executeQuery(
                'SELECT id FROM groupes WHERE nom = ?',
                [groupName.trim()]
            );

            if (existingGroup.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Un groupe avec ce nom existe déjà'
                });
            }

            // Créer le nouveau groupe
            const result = await db.executeQuery(
                'INSERT INTO groupes (nom) VALUES (?)',
                [groupName.trim()]
            );

            res.json({
                success: true,
                message: 'Groupe créé avec succès',
                group: {
                    id: result.id,
                    name: groupName.trim()
                }
            });

        } catch (error) {
            console.error('Erreur création groupe:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    });

    // Modifier un groupe
    router.put('/groups/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { groupName } = req.body;
            
            if (!groupName || groupName.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Le nom du groupe est requis'
                });
            }

            // Vérifier si le groupe existe
            const existingGroup = await db.executeQuery(
                'SELECT id FROM groupes WHERE id = ?',
                [id]
            );

            if (existingGroup.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Groupe non trouvé'
                });
            }

            // Vérifier si un autre groupe avec ce nom existe
            const duplicateGroup = await db.executeQuery(
                'SELECT id FROM groupes WHERE nom = ? AND id != ?',
                [groupName.trim(), id]
            );

            if (duplicateGroup.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Un groupe avec ce nom existe déjà'
                });
            }

            // Mettre à jour le groupe
            await db.executeQuery(
                'UPDATE groupes SET nom = ? WHERE id = ?',
                [groupName.trim(), id]
            );

            res.json({
                success: true,
                message: 'Groupe modifié avec succès',
                group: {
                    id: parseInt(id),
                    name: groupName.trim()
                }
            });

        } catch (error) {
            console.error('Erreur modification groupe:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    });

    // Supprimer un groupe
    router.delete('/groups/:id', async (req, res) => {
        try {
            const { id } = req.params;

            // Vérifier si le groupe existe
            const existingGroup = await db.executeQuery(
                'SELECT nom FROM groupes WHERE id = ?',
                [id]
            );

            if (existingGroup.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Groupe non trouvé'
                });
            }

            // Vérifier si le groupe est utilisé par des élèves
            const studentsWithGroup = await db.executeQuery(
                'SELECT COUNT(*) as count FROM eleves_groupes WHERE groupeId = ?',
                [id]
            );

            if (studentsWithGroup[0].count > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Impossible de supprimer ce groupe car il est assigné à des élèves'
                });
            }

            // Supprimer le groupe
            await db.executeQuery(
                'DELETE FROM groupes WHERE id = ?',
                [id]
            );

            res.json({
                success: true,
                message: 'Groupe supprimé avec succès'
            });

        } catch (error) {
            console.error('Erreur suppression groupe:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    });

    // POST /api/students/search - Recherche avancée des élèves
    router.post('/search', async (req, res) => {
        try {
            const { criteria } = req.body;
            
            console.log('🔍 Recherche avancée des élèves:', criteria);
            
            if (!criteria || !Array.isArray(criteria) || criteria.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Critères de recherche requis'
                });
            }
            
            // Construire la requête SQL avec logique correcte
            let query = `
                SELECT DISTINCT 
                    e.id,
                    e.nom,
                    e.prenom,
                    e.classe,
                    e.regime,
                    e.autorisationSortie,
                    GROUP_CONCAT(g.nom) as groups
                FROM eleves e
                LEFT JOIN eleves_groupes eg ON e.id = eg.eleveId
                LEFT JOIN groupes g ON eg.groupeId = g.id
                WHERE e.actif = 1
            `;
            
            const params = [];
            let whereConditions = [];
            
            // Traiter les critères dans l'ordre avec la logique correcte
            criteria.forEach((criterion, index) => {
                if (!criterion.field || !criterion.value) return;
                
                let condition = '';
                
                switch (criterion.field) {
                    case 'classe':
                        condition = `e.classe = ?`;
                        params.push(criterion.value);
                        break;
                    case 'groupes':
                        // Pour les groupes, on doit vérifier que l'élève appartient au groupe
                        condition = `EXISTS (SELECT 1 FROM eleves_groupes eg2 JOIN groupes g2 ON eg2.groupeId = g2.id WHERE eg2.eleveId = e.id AND g2.nom = ?)`;
                        params.push(criterion.value);
                        break;
                    case 'regime':
                        condition = `e.regime = ?`;
                        params.push(criterion.value);
                        break;
                    case 'autorisationSortie':
                        condition = `e.autorisationSortie = ?`;
                        params.push(criterion.value);
                        break;
                }
                
                if (condition) {
                    if (index === 0) {
                        // Premier critère : pas d'opérateur
                        whereConditions.push(condition);
                    } else {
                        // Critères suivants : utiliser l'opérateur du critère précédent
                        const previousCriterion = criteria[index - 1];
                        let operator = 'AND';
                        
                        if (previousCriterion.operator === 'SAUF') {
                            // Pour SAUF, on utilise NOT
                            condition = `NOT ${condition}`;
                            operator = 'AND';
                        } else if (previousCriterion.operator === 'OU') {
                            operator = 'OR';
                        }
                        
                        whereConditions.push(`${operator} ${condition}`);
                    }
                }
            });
            
            if (whereConditions.length > 0) {
                query += ' AND (' + whereConditions.join(' ') + ')';
            }
            
            query += ' GROUP BY e.id ORDER BY e.classe, e.nom, e.prenom';
            
            console.log('🔍 Requête SQL:', query);
            console.log('🔍 Paramètres:', params);
            
            const students = await db.executeQuery(query, params);
            
            // Formater les résultats
            const formattedStudents = students.map(student => ({
                id: student.id,
                nom: student.nom,
                prenom: student.prenom,
                classe: student.classe,
                regime: student.regime,
                autorisationSortie: student.autorisationSortie,
                groups: student.groups ? student.groups.split(',') : []
            }));
            
            res.json({
                success: true,
                students: formattedStudents,
                count: formattedStudents.length
            });
            
        } catch (error) {
            console.error('Erreur recherche avancée:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    });

    // POST /api/students/bulk-assign-groups - Assigner des groupes en lot
    router.post('/bulk-assign-groups', async (req, res) => {
        try {
            const { studentIds, groups } = req.body;
            
            console.log('👥 Assignation de groupes en lot:', { studentIds, groups });
            
            if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'IDs des élèves requis'
                });
            }
            
            if (!groups || !Array.isArray(groups) || groups.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Groupes requis'
                });
            }
            
            let assignedCount = 0;
            
            for (const studentId of studentIds) {
                for (const groupName of groups) {
                    // Récupérer l'ID du groupe
                    const groupResult = await db.executeQuery(
                        'SELECT id FROM groupes WHERE nom = ?',
                        [groupName]
                    );
                    
                    if (groupResult.length > 0) {
                        const groupId = groupResult[0].id;
                        
                        // Vérifier si l'association existe déjà
                        const existingResult = await db.executeQuery(
                            'SELECT eleveId FROM eleves_groupes WHERE eleveId = ? AND groupeId = ?',
                            [studentId, groupId]
                        );
                        
                        if (existingResult.length === 0) {
                            // Créer l'association
                            await db.executeQuery(
                                'INSERT INTO eleves_groupes (eleveId, groupeId) VALUES (?, ?)',
                                [studentId, groupId]
                            );
                            assignedCount++;
                        }
                    }
                }
            }
            
            res.json({
                success: true,
                message: `${assignedCount} assignation(s) effectuée(s)`,
                assignedCount: assignedCount
            });
            
        } catch (error) {
            console.error('Erreur assignation groupes en lot:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    });

    // POST /api/students/bulk-assign-exit-permission - Assigner des autorisations de sortie en lot
    router.post('/bulk-assign-exit-permission', async (req, res) => {
        try {
            const { studentIds, exitPermission } = req.body;
            
            console.log('🔑 Assignation d\'autorisations en lot:', { studentIds, exitPermission });
            
            if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'IDs des élèves requis'
                });
            }
            
            if (!exitPermission) {
                return res.status(400).json({
                    success: false,
                    message: 'Autorisation de sortie requise'
                });
            }
            
            // Mettre à jour tous les élèves sélectionnés
            const placeholders = studentIds.map(() => '?').join(',');
            const result = await db.executeQuery(
                `UPDATE eleves SET autorisationSortie = ?, modifieLe = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
                [exitPermission, ...studentIds]
            );
            
            res.json({
                success: true,
                message: `Autorisation de sortie mise à jour pour ${result.changes} élève(s)`,
                updatedCount: result.changes
            });
            
        } catch (error) {
            console.error('Erreur assignation autorisations en lot:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    });

    return router;
};
