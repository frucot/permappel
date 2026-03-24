const express = require('express');
const router = express.Router();
const createCdiKioskIpHelpers = require('../middleware/cdiKioskIpRestriction');

function formatDateForDb(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toMinutes(value) {
    if (!value || !value.includes(':')) return null;
    const [hours, minutes] = value.split(':');
    return (parseInt(hours, 10) * 60) + parseInt(minutes, 10);
}

module.exports = (db, io) => {
    const { getCdiKioskSecurityConfig, normalizeIP, enforceKioskIPRestriction } = createCdiKioskIpHelpers(db);

    router.get('/activities', enforceKioskIPRestriction, async (req, res) => {
        try {
            const activities = await db.executeQuery(
                'SELECT id, libelle, actif FROM activites_cdi WHERE actif = 1 ORDER BY libelle ASC'
            );

            res.json({ success: true, activities });
        } catch (error) {
            console.error('Erreur récupération activités CDI:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    });

    router.get('/current-slot', enforceKioskIPRestriction, async (req, res) => {
        try {
            const now = new Date();
            const nowMinutes = (now.getHours() * 60) + now.getMinutes();
            const schedules = await db.executeQuery(
                'SELECT id, nom, heureDebut, heureFin FROM creneaux WHERE actif = 1 ORDER BY heureDebut ASC'
            );

            const currentSlot = schedules.find(schedule => {
                const start = toMinutes(schedule.heureDebut);
                const end = toMinutes(schedule.heureFin);
                return start !== null && end !== null && nowMinutes >= start && nowMinutes <= end;
            }) || null;

            res.json({
                success: true,
                date: formatDateForDb(now),
                currentSlot
            });
        } catch (error) {
            console.error('Erreur récupération créneau courant CDI:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    });

    // Pas de enforceKioskIPRestriction ici : une IP non autorisée doit recevoir 200 +
    // { authorized: false } pour que la borne affiche le message et désactive l’envoi.
    router.get('/kiosk-status', async (req, res) => {
        try {
            const securityConfig = await getCdiKioskSecurityConfig();
            const clientIP = normalizeIP(
                req.ip ||
                req.headers['x-forwarded-for'] ||
                req.connection?.remoteAddress ||
                req.socket?.remoteAddress
            );

            const authorized = !securityConfig.enabled || securityConfig.allowedIPs.includes(clientIP);
            res.json({
                success: true,
                restrictionEnabled: securityConfig.enabled,
                authorized,
                clientIP
            });
        } catch (error) {
            console.error('Erreur récupération statut borne CDI:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    });

    router.post('/checkin', enforceKioskIPRestriction, async (req, res) => {
        try {
            const { studentId, activityId } = req.body;
            if (!studentId || !activityId) {
                return res.status(400).json({
                    success: false,
                    message: 'Élève et activité requis'
                });
            }

            const [student] = await db.executeQuery(
                'SELECT id, nom, prenom, classe FROM eleves WHERE id = ? AND actif = 1',
                [studentId]
            );
            if (!student) {
                return res.status(404).json({ success: false, message: 'Élève introuvable' });
            }

            const [activity] = await db.executeQuery(
                'SELECT id, libelle FROM activites_cdi WHERE id = ? AND actif = 1',
                [activityId]
            );
            if (!activity) {
                return res.status(404).json({ success: false, message: 'Activité introuvable' });
            }

            const now = new Date();
            const date = formatDateForDb(now);
            const nowMinutes = (now.getHours() * 60) + now.getMinutes();
            const schedules = await db.executeQuery(
                'SELECT id, nom, heureDebut, heureFin FROM creneaux WHERE actif = 1 ORDER BY heureDebut ASC'
            );

            const currentSlot = schedules.find(schedule => {
                const start = toMinutes(schedule.heureDebut);
                const end = toMinutes(schedule.heureFin);
                return start !== null && end !== null && nowMinutes >= start && nowMinutes <= end;
            });

            if (!currentSlot) {
                return res.status(400).json({
                    success: false,
                    message: 'Aucun créneau actif actuellement'
                });
            }

            let feuille = await db.executeQuery(
                'SELECT id, classes, groupes FROM feuilles_appel WHERE date = ? AND creneauId = ?',
                [date, currentSlot.id]
            );

            if (feuille.length === 0) {
                const classes = JSON.stringify([student.classe]);
                const groupes = JSON.stringify([]);
                // INSERT OR IGNORE évite l’erreur UNIQUE si une autre requête a créé la feuille entre-temps
                await db.executeQuery(`
                    INSERT OR IGNORE INTO feuilles_appel (date, creneauId, classes, groupes, creePar)
                    VALUES (?, ?, ?, ?, ?)
                `, [date, currentSlot.id, classes, groupes, 1]);
                feuille = await db.executeQuery(
                    'SELECT id, classes, groupes FROM feuilles_appel WHERE date = ? AND creneauId = ?',
                    [date, currentSlot.id]
                );
            }

            if (feuille.length === 0) {
                return res.status(500).json({
                    success: false,
                    message: 'Impossible de récupérer la feuille d’appel après création'
                });
            }

            const feuilleId = feuille[0].id;

            if (student.classe) {
                let classesArr = [];
                try {
                    const parsed = JSON.parse(feuille[0].classes || '[]');
                    classesArr = Array.isArray(parsed) ? parsed : [];
                } catch {
                    classesArr = [];
                }
                if (!classesArr.includes(student.classe)) {
                    classesArr.push(student.classe);
                    await db.executeQuery(
                        `UPDATE feuilles_appel SET classes = ?, modifieLe = CURRENT_TIMESTAMP WHERE id = ?`,
                        [JSON.stringify(classesArr), feuilleId]
                    );
                }
            }

            let existingPresence = await db.executeQuery(
                'SELECT id, statut FROM presences WHERE feuilleAppelId = ? AND eleveId = ?',
                [feuilleId, student.id]
            );

            let insertedPresence = false;
            if (existingPresence.length === 0) {
                const insertPresenceResult = await db.executeQuery(`
                    INSERT OR IGNORE INTO presences (feuilleAppelId, eleveId, statut, activiteCdiId, modifiePar)
                    VALUES (?, ?, 'Présent_CDI', ?, ?)
                `, [feuilleId, student.id, activity.id, 1]);
                insertedPresence = insertPresenceResult.changes > 0;
                existingPresence = await db.executeQuery(
                    'SELECT id, statut FROM presences WHERE feuilleAppelId = ? AND eleveId = ?',
                    [feuilleId, student.id]
                );
                if (existingPresence.length === 0) {
                    return res.status(500).json({
                        success: false,
                        message: 'Impossible d’enregistrer la présence après création'
                    });
                }
            }

            if (!insertedPresence) {
                if (existingPresence[0].statut === 'Présent_CDI') {
                    return res.status(409).json({
                        success: false,
                        message: 'Élève déjà inscrit au CDI pour ce créneau'
                    });
                }
                await db.executeQuery(`
                    UPDATE presences
                    SET statut = 'Présent_CDI',
                        activiteCdiId = ?,
                        modifiePar = ?,
                        modifieLe = CURRENT_TIMESTAMP
                    WHERE feuilleAppelId = ? AND eleveId = ?
                `, [activity.id, 1, feuilleId, student.id]);
            }

            const attendanceId = `${date}_${currentSlot.id}`;
            if (io) {
                io.to(`attendance-${attendanceId}`).emit('cdi-checkin-updated', {
                    attendanceId,
                    studentId: student.id,
                    status: 'Présent_CDI',
                    activity: activity.libelle,
                    timestamp: new Date().toISOString()
                });
            }

            res.json({
                success: true,
                message: 'Inscription CDI enregistrée',
                attendanceId,
                student: {
                    id: student.id,
                    nom: student.nom,
                    prenom: student.prenom,
                    classe: student.classe
                },
                activity: activity.libelle
            });
        } catch (error) {
            console.error('Erreur checkin CDI:', error);
            res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
    });

    return router;
};
