const express = require('express');
const router = express.Router();

module.exports = (db, io) => {
    // GET /api/attendance - Récupérer toutes les feuilles d'appel
    router.get('/', async (req, res) => {
        try {
            const { date, scheduleId, startDate, endDate } = req.query;
            
            let query = `
                SELECT 
                    fa.id,
                    fa.date,
                    fa.creneauId,
                    c.nom as creneauNom,
                    c.heureDebut,
                    c.heureFin,
                    fa.classes,
                    fa.groupes,
                    fa.creeLe,
                    COUNT(p.eleveId) as totalEleves,
                    SUM(CASE WHEN p.statut = 'Présent' THEN 1 ELSE 0 END) as presents,
                    SUM(CASE WHEN p.statut = 'Absent' THEN 1 ELSE 0 END) as absents,
                    SUM(CASE WHEN p.statut = 'Présent_CDI' THEN 1 ELSE 0 END) as cdi,
                    SUM(CASE WHEN p.statut = 'Absence_prévue' THEN 1 ELSE 0 END) as excused,
                    SUM(CASE WHEN p.statut = 'NON_APPELE' THEN 1 ELSE 0 END) as unattended
                FROM feuilles_appel fa
                LEFT JOIN creneaux c ON fa.creneauId = c.id
                LEFT JOIN presences p ON fa.id = p.feuilleAppelId
                WHERE 1=1
            `;
            
            const params = [];
            
            if (date) {
                query += ' AND fa.date = ?';
                params.push(date);
            }
            
            if (startDate && endDate) {
                query += ' AND fa.date >= ? AND fa.date <= ?';
                params.push(startDate, endDate);
            }
            
            if (scheduleId) {
                query += ' AND fa.creneauId = ?';
                params.push(scheduleId);
            }
            
            query += ' GROUP BY fa.id ORDER BY fa.date DESC, fa.creeLe DESC';
            
            const feuilles = await db.executeQuery(query, params);
            
            // Parser les JSON arrays
            const result = feuilles.map(feuille => ({
                id: `${feuille.date}_${feuille.creneauId}`,
                date: feuille.date,
                schedule: {
                    id: feuille.creneauId,
                    name: feuille.creneauNom,
                    startTime: feuille.heureDebut,
                    endTime: feuille.heureFin
                },
                classes: JSON.parse(feuille.classes || '[]'),
                groups: JSON.parse(feuille.groupes || '[]'),
                stats: {
                    present: feuille.presents || 0,
                    absent: feuille.absents || 0,
                    late: 0, // Pas de retards selon spécifications
                    cdi: feuille.cdi || 0, // Ajout du compteur CDI
                    excused: feuille.excused || 0,
                    unattended: feuille.unattended || 0,
                    total: feuille.totalEleves || 0
                },
                createdAt: feuille.creeLe
            }));
            
            res.json({ success: true, attendances: result });
        } catch (error) {
            console.error('Erreur récupération feuilles d\'appel:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    });

    // GET /api/attendance/:id - Récupérer une feuille d'appel spécifique
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const [date, creneauId] = id.split('_');
            
            // Récupérer la feuille d'appel
            const feuille = await db.executeQuery(`
                SELECT 
                    fa.*,
                    c.nom as creneauNom,
                    c.heureDebut,
                    c.heureFin
                FROM feuilles_appel fa
                LEFT JOIN creneaux c ON fa.creneauId = c.id
                WHERE fa.date = ? AND fa.creneauId = ?
            `, [date, creneauId]);
            
            if (feuille.length === 0) {
                return res.status(404).json({ success: false, message: 'Feuille d\'appel non trouvée' });
            }
            
            // Récupérer les présences avec les groupes
            const presences = await db.executeQuery(`
                SELECT 
                    p.*,
                    e.id as _id,
                    e.nom as lastName,
                    e.prenom as firstName,
                    e.classe as class,
                    e.regime,
                    e.autorisationSortie as exitPermissions,
                    GROUP_CONCAT(g.nom) as groups
                FROM presences p
                JOIN eleves e ON p.eleveId = e.id
                LEFT JOIN eleves_groupes eg ON e.id = eg.eleveId
                LEFT JOIN groupes g ON eg.groupeId = g.id
                WHERE p.feuilleAppelId = ?
                GROUP BY p.id, e.id
                ORDER BY e.classe ASC, e.nom ASC
            `, [feuille[0].id]);
            
            console.log('📊 Feuille d\'appel trouvée:', feuille[0]);
            console.log('📊 Présences trouvées:', presences.length);
            
            // Calculer les statistiques
            const stats = {
                present: 0,
                absent: 0,
                cdi: 0,
                excused: 0,
                unattended: 0,
                total: presences.length
            };
            
            presences.forEach(presence => {
                const status = presence.statut || 'NON_APPELE';
                switch (status) {
                    case 'Présent':
                        stats.present++;
                        break;
                    case 'Absent':
                        stats.absent++;
                        break;
                    case 'Présent_CDI':
                        stats.cdi++;
                        break;
                    case 'Absence_prévue':
                        stats.excused++;
                        break;
                    case 'NON_APPELE':
                        stats.unattended++;
                        break;
                }
            });
            
            // Transformer les données élèves avec format standardisé
            const studentsWithGroups = presences.map(student => ({
                _id: student._id,
                id: student._id,
                lastName: student.lastName,
                firstName: student.firstName,
                nom: student.lastName,
                prenom: student.firstName,
                class: student.class,
                classe: student.class,
                regime: student.regime,
                exitPermissions: student.exitPermissions,
                autorisationSortie: student.exitPermissions,
                status: student.statut || 'NON_APPELE',
                statut: student.statut || 'NON_APPELE',
                groups: student.groups ? student.groups.split(',').filter(g => g) : []
            }));
            
            const result = {
                id: id,
                date: feuille[0].date,
                schedule: {
                    id: feuille[0].creneauId,
                    name: feuille[0].creneauNom,
                    startTime: feuille[0].heureDebut,
                    endTime: feuille[0].heureFin
                },
                students: studentsWithGroups,
                stats: stats,
                groups: JSON.parse(feuille[0].groupes || '[]'),
                classes: JSON.parse(feuille[0].classes || '[]')
            };
            
            res.json({ success: true, attendance: result });
        } catch (error) {
            console.error('Erreur récupération feuille d\'appel:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    });

    // POST /api/attendance - Créer une nouvelle feuille d'appel
    router.post('/', async (req, res) => {
        try {
            const { date, creneauId, groups, classes, isRecurring, recurrenceType, recurrenceEndDate, recurrenceCount } = req.body;
            
            console.log('📊 Création nouvelle feuille d\'appel:', { date, creneauId, groups, classes });
            
            // Validation des paramètres
            if (!date || !creneauId) {
                return res.status(400).json({
                    success: false,
                    message: 'Date et créneau sont requis'
                });
            }
            
            // Vérifier si la feuille existe déjà
            const existing = await db.executeQuery(
                'SELECT id FROM feuilles_appel WHERE date = ? AND creneauId = ?',
                [date, creneauId]
            );
            
            if (existing.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Une feuille d\'appel existe déjà pour cette date et ce créneau' 
                });
            }
            
            // Créer la feuille d'appel
            const feuilleResult = await db.executeQuery(`
                INSERT INTO feuilles_appel (date, creneauId, classes, groupes, creePar)
                VALUES (?, ?, ?, ?, ?)
            `, [date, creneauId, JSON.stringify(classes || []), JSON.stringify(groups || []), 1]);
            
            const feuilleId = feuilleResult.id;
            
            // Récupérer les élèves concernés avec une logique plus robuste
            let elevesQuery = `
                SELECT DISTINCT e.id, e.nom, e.prenom, e.classe, e.actif
                FROM eleves e
                WHERE 1=1 
            `;
            const elevesParams = [];
            
            // Construire les conditions dynamiquement
            const conditions = [];
            
            if (classes && classes.length > 0) {
                conditions.push('(e.classe IN (' + classes.map(() => '?').join(',') + '))');
                elevesParams.push(...classes);
            }
            
            if (groups && groups.length > 0) {
                conditions.push(`(e.id IN (
                    SELECT DISTINCT eg.eleveId 
                    FROM eleves_groupes eg
                    JOIN groupes g ON eg.groupeId = g.id
                    WHERE g.nom IN (${groups.map(() => '?').join(',')})
                ))`);
                elevesParams.push(...groups);
            }
            
            // Si aucune condition, récupérer tous les élèves actifs
            if (conditions.length === 0) {
                elevesQuery += ' AND e.actif = 1';
            } else {
                elevesQuery += ' AND (' + conditions.join(' OR ') + ') AND e.actif = 1';
            }
            
            console.log('🔍 Requête élèves:', elevesQuery);
            console.log('🔍 Paramètres:', elevesParams);
            
            const eleves = await db.executeQuery(elevesQuery, elevesParams);
            console.log(`📊 Elèves trouvés: ${eleves.length}`);
            
            // Si aucun élève trouvé, retourner un message d'erreur spécifique  
            if (eleves.length === 0) {
                await db.executeQuery('DELETE FROM feuilles_appel WHERE id = ?', [feuilleId]);
                return res.status(400).json({
                    success: false,
                    message: 'Aucun élève trouvé pour les classes/groupes sélectionnés'
                });
            }
            
            // Créer les présences
            let presentesCount = 0;
            for (const eleve of eleves) {
                try {
                    await db.executeQuery(`
                        INSERT INTO presences (feuilleAppelId, eleveId, statut, modifiePar)
                        VALUES (?, ?, 'NON_APPELE', ?)
                    `, [feuilleId, eleve.id, 1]);
                    presentesCount++;
                } catch (err) {
                    console.error(`Erreur création présence pour élève ${eleve.id}:`, err.message);
                }
            }
            
            console.log(`✅ ${presentesCount} présences créées`);
            
            // Gestion des appels récurrents
            let totalCreated = 1;
            if (isRecurring && recurrenceType) {
                console.log('🔄 Création d\'appels récurrents:', { recurrenceType, recurrenceEndDate, recurrenceCount });
                totalCreated += await createRecurringAttendances(
                    db, 
                    date, 
                    creneauId, 
                    classes, 
                    groups, 
                    recurrenceType, 
                    recurrenceEndDate, 
                    recurrenceCount,
                    eleves
                );
            }
            
            res.json({ 
                success: true, 
                message: `${totalCreated} feuille(s) d'appel créée(s) avec succès (${presentesCount} élèves)`,
                attendanceId: `${date}_${creneauId}`,
                feuilleId: feuilleId,
                studentCount: presentesCount,
                totalCreated: totalCreated
            });
        } catch (error) {
            console.error('Erreur création feuille d\'appel:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur: ' + error.message });
        }
    });

    // PUT /api/attendance/:attendanceId/student/:studentId - Mettre à jour le statut d'un élève
    router.put('/:attendanceId/student/:studentId', async (req, res) => {
        try {
            const { attendanceId, studentId } = req.params;
            const { status, notes } = req.body;
            const [date, creneauId] = attendanceId.split('_');
            
            // Récupérer la feuille d'appel
            const feuille = await db.executeQuery(
                'SELECT id FROM feuilles_appel WHERE date = ? AND creneauId = ?',
                [date, creneauId]
            );
            
            if (feuille.length === 0) {
                return res.status(404).json({ success: false, message: 'Feuille d\'appel non trouvée' });
            }
            
            // Mettre à jour la présence
            await db.executeQuery(`
                UPDATE presences 
                SET statut = ?, notes = ?, modifieLe = CURRENT_TIMESTAMP, modifiePar = ?
                WHERE feuilleAppelId = ? AND eleveId = ?
            `, [status, notes, 1, feuille[0].id, studentId]);
            
            // Émettre la mise à jour via Socket.IO
            if (io) {
                io.to(`attendance-${attendanceId}`).emit('student-status-updated', {
                    studentId: parseInt(studentId),
                    status: status,
                    notes: notes,
                    timestamp: new Date().toISOString()
                });
            }
            
            res.json({ success: true, message: 'Statut mis à jour' });
        } catch (error) {
            console.error('Erreur mise à jour statut:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    });

    // POST /api/attendance/:attendanceId/groups - Ajouter des groupes à une feuille d'appel
    router.post('/:attendanceId/groups', async (req, res) => {
        try {
            const { attendanceId } = req.params;
            const { groups } = req.body;
            const [date, creneauId] = attendanceId.split('_');
            
            if (!groups || groups.length === 0) {
                return res.status(400).json({ success: false, message: 'Aucun groupe fourni' });
            }
            
            // Récupérer la feuille d'appel
            const feuille = await db.executeQuery(
                'SELECT id, groupes FROM feuilles_appel WHERE date = ? AND creneauId = ?',
                [date, creneauId]
            );
            
            if (feuille.length === 0) {
                return res.status(404).json({ success: false, message: 'Feuille d\'appel non trouvée' });
            }
            
            // Mettre à jour les groupes
            const currentGroups = JSON.parse(feuille[0].groupes || '[]');
            const newGroups = [...new Set([...currentGroups, ...groups])];
            
            await db.executeQuery(
                'UPDATE feuilles_appel SET groupes = ? WHERE id = ?',
                [JSON.stringify(newGroups), feuille[0].id]
            );
            
            // Ajouter les élèves des nouveaux groupes
            const elevesQuery = `
                SELECT DISTINCT e.id FROM eleves e
                JOIN eleves_groupes eg ON e.id = eg.eleveId
                JOIN groupes g ON eg.groupeId = g.id
                WHERE g.nom IN (${groups.map(() => '?').join(',')})
                AND e.id NOT IN (
                    SELECT eleveId FROM presences WHERE feuilleAppelId = ?
                )
            `;
            
            const eleves = await db.executeQuery(elevesQuery, [...groups, feuille[0].id]);
            
            // Créer les présences pour les nouveaux élèves
            for (const eleve of eleves) {
                await db.executeQuery(`
                    INSERT INTO presences (feuilleAppelId, eleveId, statut, modifiePar)
                    VALUES (?, ?, 'NON_APPELE', ?)
                `, [feuille[0].id, eleve.id, 1]);
            }
            
            // Récupérer les données mises à jour de la feuille d'appel pour rafraîchir l'affichage
            const feuilleUpdatee = await db.executeQuery(
                'SELECT * FROM feuilles_appel WHERE id = ?',
                [feuille[0].id]
            );
            
            if (feuilleUpdatee.length === 0) {
                return res.status(404).json({ success: false, message: 'Feuille d\'appel non trouvée après ajout' });
            }
            
            // Simuler la même structure que GET pour l'affichage côté client
            const classesResult = JSON.parse(feuilleUpdatee[0].classes || '[]');
            const groupesResult = JSON.parse(feuilleUpdatee[0].groupes || '[]');
            
            // Récupérer les élèves mis à jour par présences
            const elevesRows = await db.executeQuery(
                `SELECT DISTINCT e.id as eleveId, e.nom as lastName, e.prenom as firstName, 
                 e.classe, e.actif, e.autorisationSortie, p.statut
                 FROM eleves e
                 JOIN presences p ON e.id = p.eleveId
                 WHERE p.feuilleAppelId = ? 
                 ORDER BY e.classe, e.nom, e.prenom`,
                [feuille[0].id]
            );
            
            res.json({ 
                success: true, 
                message: 'Groupes ajoutés avec succès',
                attendance: {
                    id: attendanceId,
                    classes: classesResult,
                    groups: groupesResult,
                    groupes: groupesResult, // pour compatibilité
                    students: elevesRows.map(eleve => ({
                        _id: eleve.eleveId,
                        id: eleve.eleveId,
                        lastName: eleve.lastName,
                        firstName: eleve.firstName,
                        classe: eleve.classe,
                        class: eleve.classe,
                        status: eleve.statut || 'non_called',
                        statut: eleve.statut || 'non_called', // pour compatibilité
                        autorisationSortie: eleve.autorisationSortie,
                        exitPermissions: eleve.autorisationSortie
                    }))
                }
            });
        } catch (error) {
            console.error('Erreur ajout groupes:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    });

    // Route pour supprimer un groupe spécifique de la feuille d'appel
    router.delete('/:attendanceId/groups', async (req, res) => {
        try {
            const { attendanceId } = req.params;
            const { groupName } = req.body;
            const [date, creneauId] = attendanceId.split('_');
            
            if (!groupName) {
                return res.status(400).json({ success: false, message: 'Nom de groupe manquant' });
            }
            
            // Récupérer la feuille d'appel
            const feuille = await db.executeQuery(
                'SELECT id, classes, groupes FROM feuilles_appel WHERE date = ? AND creneauId = ?',
                [date, creneauId]
            );
            
            if (feuille.length === 0) {
                return res.status(404).json({ success: false, message: 'Feuille d\'appel non trouvée' });
            }
            
            // Mettre à jour les groupes (supprimer celui demandé)
            const currentGroups = JSON.parse(feuille[0].groupes || '[]');
            const updatedGroups = currentGroups.filter(grp => grp !== groupName);
            
            await db.executeQuery(
                'UPDATE feuilles_appel SET groupes = ? WHERE id = ?',
                [JSON.stringify(updatedGroups), feuille[0].id]
            );
            
            // Supprimer les présences pour les élèves de ce groupe
            // Vérifier s'il reste d'autres groupes après suppression
            if (updatedGroups.length > 0) {
                // Supprimer seulement les élèves qui sont dans ce groupe ET dans aucun groupe restant
                await db.executeQuery(`
                    DELETE FROM presences 
                    WHERE feuilleAppelId = ? 
                    AND eleveId IN (
                        SELECT DISTINCT e.id FROM eleves e
                        JOIN eleves_groupes eg ON e.id = eg.eleveId
                        JOIN groupes g ON eg.groupeId = g.id
                        WHERE g.nom = ?
                        AND e.id NOT IN (
                            SELECT DISTINCT e2.id FROM eleves e2
                            JOIN eleves_groupes eg2 ON e2.id = eg2.eleveId
                            JOIN groupes g2 ON eg2.groupeId = g2.id
                            WHERE g2.nom IN (${updatedGroups.map(() => '?').join(',')})
                        )
                    )
                `, [feuille[0].id, groupName, ...updatedGroups]);
            } else {
                // Si aucun autre groupe, supprimer tous les élèves de ce groupe
                await db.executeQuery(`
                    DELETE FROM presences 
                    WHERE feuilleAppelId = ? 
                    AND eleveId IN (
                        SELECT DISTINCT e.id FROM eleves e
                        JOIN eleves_groupes eg ON e.id = eg.eleveId
                        JOIN groupes g ON eg.groupeId = g.id
                        WHERE g.nom = ?
                    )
                `, [feuille[0].id, groupName]);
            }
            
            // Récupérer les données mises à jour de la feuille d'appel pour rafraîchir l'affichage
            const feuilleUpdatee = await db.executeQuery(
                'SELECT * FROM feuilles_appel WHERE id = ?',
                [feuille[0].id]
            );
            
            if (feuilleUpdatee.length === 0) {
                return res.status(404).json({ success: false, message: 'Feuille d\'appel non trouvée après suppression' });
            }
            
            // Simuler la même structure que GET pour l'affichage côté client
            const classesResult = JSON.parse(feuilleUpdatee[0].classes || '[]');
            const groupesResult = JSON.parse(feuilleUpdatee[0].groupes || '[]');
            
            // Récupérer les élèves mis à jour par présences
            const elevesRows = await db.executeQuery(
                `SELECT DISTINCT e.id as eleveId, e.nom as lastName, e.prenom as firstName, 
                 e.classe, e.actif, e.autorisationSortie, p.statut
                 FROM eleves e
                 JOIN presences p ON e.id = p.eleveId
                 WHERE p.feuilleAppelId = ? 
                 ORDER BY e.classe, e.nom, e.prenom`,
                [feuille[0].id]
            );
            
            res.json({ 
                success: true, 
                message: 'Groupe supprimé avec succès',
                attendance: {
                    id: attendanceId,
                    classes: classesResult,
                    groups: groupesResult,
                    groupes: groupesResult, // pour compatibilité
                    students: elevesRows.map(eleve => ({
                        _id: eleve.eleveId,
                        id: eleve.eleveId,
                        lastName: eleve.lastName,
                        firstName: eleve.firstName,
                        classe: eleve.classe,
                        class: eleve.classe,
                        status: eleve.statut || 'non_called',
                        statut: eleve.statut || 'non_called', // pour compatibilité
                        autorisationSortie: eleve.autorisationSortie,
                        exitPermissions: eleve.autorisationSortie
                    }))
                }
            });
        } catch (error) {
            console.error('Erreur suppression groupe:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur: ' + error.message });
        }
    });
    
    // POST /api/attendance/:attendanceId/classes - Ajouter des classes à une feuille d'appel
    router.post('/:attendanceId/classes', async (req, res) => {
        try {
            const { attendanceId } = req.params;
            const { classes } = req.body;
            const [date, creneauId] = attendanceId.split('_');
            
            if (!classes || classes.length === 0) {
                return res.status(400).json({ success: false, message: 'Aucune classe fournie' });
            }
            
            // Récupérer la feuille d'appel
            const feuille = await db.executeQuery(
                'SELECT id, classes FROM feuilles_appel WHERE date = ? AND creneauId = ?',
                [date, creneauId]
            );
            
            if (feuille.length === 0) {
                return res.status(404).json({ success: false, message: 'Feuille d\'appel non trouvée' });
            }
            
            // Mettre à jour les classes
            const currentClasses = JSON.parse(feuille[0].classes || '[]');
            const newClasses = [...new Set([...currentClasses, ...classes])];
            
            await db.executeQuery(
                'UPDATE feuilles_appel SET classes = ? WHERE id = ?',
                [JSON.stringify(newClasses), feuille[0].id]
            );
            
            // Ajouter les élèves des nouvelles classes
            const elevesQuery = `
                SELECT id FROM eleves 
                WHERE classe IN (${classes.map(() => '?').join(',')})
                AND id NOT IN (
                    SELECT eleveId FROM presences WHERE feuilleAppelId = ?
                )
            `;
            
            const eleves = await db.executeQuery(elevesQuery, [...classes, feuille[0].id]);
            
            // Créer les présences pour les nouveaux élèves
            for (const eleve of eleves) {
                await db.executeQuery(`
                    INSERT INTO presences (feuilleAppelId, eleveId, statut, modifiePar)
                    VALUES (?, ?, 'NON_APPELE', ?)
                `, [feuille[0].id, eleve.id, 1]);
            }
            
            // Récupérer les données mises à jour de la feuille d'appel pour rafraîchir l'affichage
            const feuilleUpdatee = await db.executeQuery(
                'SELECT * FROM feuilles_appel WHERE id = ?',
                [feuille[0].id]
            );
            
            if (feuilleUpdatee.length === 0) {
                return res.status(404).json({ success: false, message: 'Feuille d\'appel non trouvée après ajout' });
            }
            
            // Simuler la même structure que GET pour l'affichage côté client
            const classesResult = JSON.parse(feuilleUpdatee[0].classes || '[]');
            const groupesResult = JSON.parse(feuilleUpdatee[0].groupes || '[]');
            
            // Récupérer les élèves mis à jour par présences
            const elevesRows = await db.executeQuery(
                `SELECT DISTINCT e.id as eleveId, e.nom as lastName, e.prenom as firstName, 
                 e.classe, e.actif, e.autorisationSortie, p.statut
                 FROM eleves e
                 JOIN presences p ON e.id = p.eleveId
                 WHERE p.feuilleAppelId = ? 
                 ORDER BY e.classe, e.nom, e.prenom`,
                [feuille[0].id]
            );
            
            res.json({ 
                success: true, 
                message: 'Classes ajoutées avec succès',
                attendance: {
                    id: attendanceId,
                    classes: classesResult,
                    groups: groupesResult,
                    groupes: groupesResult, // pour compatibilité
                    students: elevesRows.map(eleve => ({
                        _id: eleve.eleveId,
                        id: eleve.eleveId,
                        lastName: eleve.lastName,
                        firstName: eleve.firstName,
                        classe: eleve.classe,
                        class: eleve.classe,
                        status: eleve.statut || 'non_called',
                        statut: eleve.statut || 'non_called', // pour compatibilité
                        autorisationSortie: eleve.autorisationSortie,
                        exitPermissions: eleve.autorisationSortie
                    }))
                }
            });
        } catch (error) {
            console.error('Erreur ajout classes:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    });

    // DELETE /api/attendance/:attendanceId/classes - Supprimer une classe d'une feuille d'appel
    router.delete('/:attendanceId/classes', async (req, res) => {
        try {
            const { attendanceId } = req.params;
            const { className } = req.body;
            const [date, creneauId] = attendanceId.split('_');
            
            if (!className) {
                return res.status(400).json({ success: false, message: 'Nom de classe manquant' });
            }
            
            // Récupérer la feuille d'appel
            const feuille = await db.executeQuery(
                'SELECT id, classes, groupes FROM feuilles_appel WHERE date = ? AND creneauId = ?',
                [date, creneauId]
            );
            
            if (feuille.length === 0) {
                return res.status(404).json({ success: false, message: 'Feuille d\'appel non trouvée' });
            }
            
            // Mettre à jour les classes (supprimer celle demandée)
            const currentClasses = JSON.parse(feuille[0].classes || '[]');
            const updatedClasses = currentClasses.filter(cls => cls !== className);
            
            await db.executeQuery(
                'UPDATE feuilles_appel SET classes = ? WHERE id = ?',
                [JSON.stringify(updatedClasses), feuille[0].id]
            );
            
            // Supprimer les présences seulement pour les élèves de cette classe 
            // qui ne sont pas dans d'autres groupes de la feuille
            const groupes = JSON.parse(feuille[0].groupes || '[]');
            
            if (groupes.length > 0) {
                // Préparer les placeholders pour les groupes
                const groupesPlaceholders = groupes.map(() => '?').join(',');
                
                await db.executeQuery(`
                    DELETE FROM presences 
                    WHERE feuilleAppelId = ? 
                    AND eleveId IN (
                        SELECT e.id FROM eleves e 
                        WHERE e.classe = ? 
                        AND e.id NOT IN (
                            SELECT eg.eleveId FROM eleves_groupes eg 
                            JOIN groupes g ON eg.groupeId = g.id 
                            WHERE g.nom IN (${groupesPlaceholders})
                        )
                    )
                `, [feuille[0].id, className, ...groupes]);
            } else {
                // Si pas de groupes définis, supprimer tous les élèves de cette classe
                await db.executeQuery(`
                    DELETE FROM presences 
                    WHERE feuilleAppelId = ? 
                    AND eleveId IN (
                        SELECT id FROM eleves WHERE classe = ?
                    )
                `, [feuille[0].id, className]);
            }
            
            // Récupérer les données mises à jour de la feuille d'appel pour rafraîchir l'affichage
            const feuilleUpdatee = await db.executeQuery(
                'SELECT * FROM feuilles_appel WHERE id = ?',
                [feuille[0].id]
            );
            
            if (feuilleUpdatee.length === 0) {
                return res.status(404).json({ success: false, message: 'Feuille d\'appel non trouvée après suppression' });
            }
            
            // Simuler la même structure que GET pour l'affichage côté client
            const classesResult = JSON.parse(feuilleUpdatee[0].classes || '[]');
            const groupesResult = JSON.parse(feuilleUpdatee[0].groupes || '[]');
            
            // Récupérer les élèves mis à jour par présences
            const elevesRows = await db.executeQuery(
                `SELECT DISTINCT e.id as eleveId, e.nom as lastName, e.prenom as firstName, 
                 e.classe, e.actif, e.autorisationSortie, p.statut
                 FROM eleves e
                 JOIN presences p ON e.id = p.eleveId
                 WHERE p.feuilleAppelId = ? 
                 ORDER BY e.classe, e.nom, e.prenom`,
                [feuille[0].id]
            );
            
            res.json({ 
                success: true, 
                message: 'Classe supprimée avec succès',
                attendance: {
                    id: attendanceId,
                    classes: classesResult,
                    groups: groupesResult,    // pour compatibilité frontend
                    groupes: groupesResult,   // pour compatibilité langage FR
                    students: elevesRows.map(eleve => ({
                        _id: eleve.eleveId,
                        id: eleve.eleveId,
                        lastName: eleve.lastName,
                        firstName: eleve.firstName,
                        classe: eleve.classe,
                        class: eleve.classe,
                        status: eleve.statut || 'non_called',
                        autorisationSortie: eleve.autorisationSortie,
                        exitPermissions: eleve.autorisationSortie
                    }))
                }
            });
        } catch (error) {
            console.error('Erreur suppression classe:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur: ' + error.message });
        }
    });

    // POST /api/attendance/:id/sync-students - Synchroniser automatiquement les élèves d'une feuille d'appel
    router.post('/:id/sync-students', async (req, res) => {
        try {
            const { id } = req.params;
            const [date, creneauId] = id.split('_');
            
            // Récupérer la feuille d'appel
            const feuille = await db.executeQuery(
                'SELECT id, classes, groupes FROM feuilles_appel WHERE date = ? AND creneauId = ?',
                [date, creneauId]
            );
            
            if (feuille.length === 0) {
                return res.status(404).json({ success: false, message: 'Feuille d\'appel non trouvée' });
            }
            
            // Récupérer les paramètres de la feuille
            const classes = JSON.parse(feuille[0].classes || '[]');
            const groups = JSON.parse(feuille[0].groupes || '[]');
            
            // Récupérer les élèves déjà présents dans la feuille
            const existingPresences = await db.executeQuery(
                'SELECT eleveId FROM presences WHERE feuilleAppelId = ?',
                [feuille[0].id]
            );
            const existingStudentIds = new Set(existingPresences.map(p => p.eleveId));
            
            // Récupérer TOUS les élèves correspondant aux critères (y compris les nouveaux)
            let elevesQuery = 'SELECT * FROM eleves WHERE actif = 1';
            const elevesParams = [];
            
            if (classes.length > 0) {
                elevesQuery += ' AND classe IN (' + classes.map(() => '?').join(',') + ')';
                elevesParams.push(...classes);
            }
            
            if (groups.length > 0) {
                elevesQuery += ` AND id IN (
                    SELECT DISTINCT eleveId FROM eleves_groupes eg
                    JOIN groupes g ON eg.groupeId = g.id
                    WHERE g.nom IN (${groups.map(() => '?').join(',')})
                )`;
                elevesParams.push(...groups);
            }
            
            const allEligibleStudents = await db.executeQuery(elevesQuery, elevesParams);
            const eligibleStudentIds = new Set(allEligibleStudents.map(e => e.id));
            
            // Filtrer pour ne garder que les nouveaux élèves (ceux qui ne sont pas déjà dans la feuille)
            const newStudents = allEligibleStudents.filter(eleve => !existingStudentIds.has(eleve.id));
            
            // Trouver les élèves à supprimer (ceux qui sont dans la feuille mais ne correspondent plus aux critères)
            const studentsToRemove = Array.from(existingStudentIds).filter(studentId => !eligibleStudentIds.has(studentId));
            
            console.log(`🔄 Synchronisation: ${existingStudentIds.size} élèves existants, ${allEligibleStudents.length} élèves éligibles, ${newStudents.length} nouveaux à ajouter, ${studentsToRemove.length} à supprimer`);
            
            // Ajouter les nouveaux élèves avec statut NON_APPELE
            let addedCount = 0;
            for (const eleve of newStudents) {
                try {
                    await db.executeQuery(`
                        INSERT INTO presences (feuilleAppelId, eleveId, statut, modifiePar)
                        VALUES (?, ?, 'NON_APPELE', ?)
                    `, [feuille[0].id, eleve.id, 1]);
                    addedCount++;
                    console.log(`✅ Élève ${eleve.id} (${eleve.nom} ${eleve.prenom}) ajouté à la feuille d'appel`);
                } catch (err) {
                    // Ignorer les erreurs de doublons (cas de race condition)
                    console.log(`⚠️ Élève ${eleve.id} déjà présent ou erreur:`, err.message);
                }
            }
            
            // Supprimer les élèves qui ne correspondent plus aux critères
            let removedCount = 0;
            for (const studentId of studentsToRemove) {
                try {
                    // Récupérer les infos de l'élève pour le log
                    const eleveInfo = await db.executeQuery('SELECT nom, prenom FROM eleves WHERE id = ?', [studentId]);
                    const eleveName = eleveInfo.length > 0 ? `${eleveInfo[0].nom} ${eleveInfo[0].prenom}` : `ID ${studentId}`;
                    
                    await db.executeQuery(
                        'DELETE FROM presences WHERE feuilleAppelId = ? AND eleveId = ?',
                        [feuille[0].id, studentId]
                    );
                    removedCount++;
                    console.log(`🗑️ Élève ${studentId} (${eleveName}) supprimé de la feuille d'appel (ne correspond plus aux critères)`);
                } catch (err) {
                    console.error(`❌ Erreur lors de la suppression de l'élève ${studentId}:`, err.message);
                }
            }
            
            const finalTotal = existingStudentIds.size + addedCount - removedCount;
            
            res.json({ 
                success: true, 
                message: addedCount > 0 || removedCount > 0 
                    ? `${addedCount} élève(s) ajouté(s), ${removedCount} élève(s) supprimé(s)` 
                    : 'Aucune modification nécessaire',
                addedCount: addedCount,
                removedCount: removedCount,
                totalStudents: finalTotal
            });
        } catch (error) {
            console.error('Erreur lors de la synchronisation des élèves:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur lors de la synchronisation' });
        }
    });

    // POST /api/attendance/:attendanceId/refresh - Forcer l'ajout des élèves à une feuille d'appel
    router.post('/:attendanceId/refresh', async (req, res) => {
        try {
            const { attendanceId } = req.params;
            const [date, creneauId] = attendanceId.split('_');
            
            // Récupérer la feuille d'appel
            const feuille = await db.executeQuery(
                'SELECT id, classes, groupes FROM feuilles_appel WHERE date = ? AND creneauId = ?',
                [date, creneauId]
            );
            
            if (feuille.length === 0) {
                return res.status(404).json({ success: false, message: 'Feuille d\'appel non trouvée' });
            }
            
            // Vérifier si des présences existent déjà
            const existingPresences = await db.executeQuery(
                'SELECT COUNT(*) as count FROM presences WHERE feuilleAppelId = ?',
                [feuille[0].id]
            );
            
            if (existingPresences[0].count > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Cette feuille d\'appel a déjà des élèves associés' 
                });
            }
            
            // Récupérer les paramètres de la feuille
            const classes = JSON.parse(feuille[0].classes || '[]');
            const groups = JSON.parse(feuille[0].groupes || '[]');
            
            // Récupérer les élèves concernés
            let elevesQuery = 'SELECT * FROM eleves WHERE 1=1'; // Retirer actif = 1 pour l'instant
            const elevesParams = [];
            
            if (classes.length > 0) {
                elevesQuery += ' AND classe IN (' + classes.map(() => '?').join(',') + ')';
                elevesParams.push(...classes);
            }
            
            if (groups.length > 0) {
                elevesQuery += ` AND id IN (
                    SELECT DISTINCT eleveId FROM eleves_groupes eg
                    JOIN groupes g ON eg.groupeId = g.id
                    WHERE g.nom IN (${groups.map(() => '?').join(',')})
                )`;
                elevesParams.push(...groups);
            }
            
            console.log('🔍 Requête élèves:', elevesQuery);
            console.log('🔍 Paramètres:', elevesParams);
            
            const eleves = await db.executeQuery(elevesQuery, elevesParams);
            console.log(`📊 Elèves trouvés: ${eleves.length}`);
            
            // Si aucun élève trouvé selon les critères, prendre tous les élèves actifs
            let elevesFinal = eleves;
            if (eleves.length === 0 && (classes.length > 0 || groups.length > 0)) {
                elevesQuery = 'SELECT * FROM eleves';
                elevesFinal = await db.executeQuery(elevesQuery);
                console.log(`🔄 Fallback: ${elevesFinal.length} élèves au total`);
            }
            
            // Créer les présences
            for (const eleve of elevesFinal) {
                try {
                    await db.executeQuery(`
                        INSERT INTO presences (feuilleAppelId, eleveId, statut, modifiePar)
                        VALUES (?, ?, 'NON_APPELE', ?)
                    `, [feuille[0].id, eleve.id, 1]);
                } catch (err) {
                    // Ignorer les erreurs de doublons
                    console.log(`⚠️ Élève ${eleve.id} déjà présent ou erreur:`, err.message);
                }
            }
            
            res.json({ 
                success: true, 
                message: `${elevesFinal.length} élèves ajoutés à la feuille d'appel`,
                studentCount: elevesFinal.length
            });
        } catch (error) {
            console.error('Erreur lors de l\'ajout des élèves:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    });

    // Fonction pour créer des appels récurrents
    async function createRecurringAttendances(db, startDate, creneauId, classes, groups, recurrenceType, recurrenceEndDate, recurrenceCount, eleves) {
        let createdCount = 0;
        const start = new Date(startDate);
        let currentDate = new Date(start);
        
        // Déterminer l'intervalle en jours
        let intervalDays = 7; // Hebdomadaire par défaut
        if (recurrenceType === 'bi-hebdomadaire') {
            intervalDays = 14;
        }
        
        // Déterminer la condition d'arrêt
        let endDate = null;
        let maxCount = null;
        
        if (recurrenceEndDate) {
            endDate = new Date(recurrenceEndDate);
        }
        if (recurrenceCount && recurrenceCount > 0) {
            maxCount = parseInt(recurrenceCount);
        }
        
        console.log('🔄 Paramètres récurrence:', { 
            intervalDays, 
            endDate: endDate?.toISOString().split('T')[0], 
            maxCount 
        });
        
        let iteration = 0;
        while (true) {
            iteration++;
            currentDate.setDate(currentDate.getDate() + intervalDays);
            
            // Vérifier les conditions d'arrêt
            if (endDate && currentDate > endDate) {
                console.log('🔄 Arrêt: date de fin atteinte');
                break;
            }
            if (maxCount && iteration >= maxCount) {
                console.log('🔄 Arrêt: nombre d\'occurrences atteint');
                break;
            }
            
            const currentDateStr = currentDate.toISOString().split('T')[0];
            
            // Vérifier si la feuille existe déjà
            const existing = await db.executeQuery(
                'SELECT id FROM feuilles_appel WHERE date = ? AND creneauId = ?',
                [currentDateStr, creneauId]
            );
            
            if (existing.length > 0) {
                console.log(`⚠️ Feuille d'appel déjà existante pour ${currentDateStr}`);
                continue;
            }
            
            try {
                // Créer la feuille d'appel récurrente
                const feuilleResult = await db.executeQuery(`
                    INSERT INTO feuilles_appel (date, creneauId, classes, groupes, creePar)
                    VALUES (?, ?, ?, ?, ?)
                `, [currentDateStr, creneauId, JSON.stringify(classes || []), JSON.stringify(groups || []), 1]);
                
                const feuilleId = feuilleResult.id;
                
                // Créer les présences pour cette feuille
                let presentesCount = 0;
                for (const eleve of eleves) {
                    try {
                        await db.executeQuery(`
                            INSERT INTO presences (feuilleAppelId, eleveId, statut, modifiePar)
                            VALUES (?, ?, 'NON_APPELE', ?)
                        `, [feuilleId, eleve.id, 1]);
                        presentesCount++;
                    } catch (err) {
                        console.error(`Erreur création présence pour élève ${eleve.id}:`, err.message);
                    }
                }
                
                console.log(`✅ Feuille récurrente créée: ${currentDateStr} (${presentesCount} élèves)`);
                createdCount++;
                
            } catch (error) {
                console.error(`❌ Erreur création feuille récurrente pour ${currentDateStr}:`, error);
            }
        }
        
        console.log(`🔄 Total feuilles récurrentes créées: ${createdCount}`);
        return createdCount;
    }

    return router;
};
