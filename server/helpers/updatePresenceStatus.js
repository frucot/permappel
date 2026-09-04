/**
 * Mise à jour d'une ligne presences pour une feuille d'appel (identifiant composite date_creneauId).
 * Partagé entre REST (PUT attendance/student) et Socket.IO (attendance-change).
 */
const { verifyToken } = require('../lib/jwtAuth');

function parseBearerUserId(req) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.replace(/^Bearer\s+/i, '').trim()
        : null;
    if (!token) return null;
    const decoded = verifyToken(token);
    const id = decoded?.id;
    return Number.isFinite(id) ? id : null;
}

/**
 * @param {object} db - DatabaseManager (executeQuery, executeWithRetry)
 * @param {object} opts
 * @param {string} opts.attendanceId - ex. "2025-03-24_3"
 * @param {string|number} opts.studentId
 * @param {string} opts.status
 * @param {string|null|undefined} opts.notes
 * @param {number|null|undefined} opts.activityId - activiteCdiId
 * @param {number} opts.userId - modifiePar (utilisateur authentifié)
 * @returns {Promise<{ ok: true, changes: number, studentId: number } | { ok: false, code: string, message: string }>}
 */
async function updatePresenceStatus(db, opts) {
    const { attendanceId, studentId, status, notes, activityId, userId } = opts;

    if (userId == null || !Number.isFinite(Number(userId))) {
        return { ok: false, code: 'INVALID_USER', message: 'Utilisateur authentifié requis pour modifiePar' };
    }

    const composite = String(attendanceId || '');
    const underscore = composite.indexOf('_');
    if (underscore < 0) {
        return {
            ok: false,
            code: 'INVALID_ATTENDANCE_ID',
            message: "Format attendanceId attendu : date_creneauId"
        };
    }
    const date = composite.slice(0, underscore);
    const creneauId = composite.slice(underscore + 1);
    if (!date || creneauId === '') {
        return {
            ok: false,
            code: 'INVALID_ATTENDANCE_ID',
            message: "Format attendanceId attendu : date_creneauId"
        };
    }

    const feuille = await db.executeQuery(
        'SELECT id FROM feuilles_appel WHERE date = ? AND creneauId = ?',
        [date, creneauId]
    );
    if (feuille.length === 0) {
        return { ok: false, code: 'FEUILLE_NOT_FOUND', message: "Feuille d'appel non trouvée" };
    }

    const sid = typeof studentId === 'string' ? parseInt(studentId, 10) : Number(studentId);
    if (!Number.isFinite(sid)) {
        return { ok: false, code: 'INVALID_STUDENT', message: 'Identifiant élève invalide' };
    }

    if (status == null || String(status).trim() === '') {
        return { ok: false, code: 'INVALID_STATUS', message: 'Statut requis' };
    }

    try {
        const result = await db.executeWithRetry(
            `
                UPDATE presences
                SET statut = ?,
                    notes = ?,
                    activiteCdiId = ?,
                    modifieLe = CURRENT_TIMESTAMP,
                    modifiePar = ?
                WHERE feuilleAppelId = ? AND eleveId = ?
            `,
            [
                status,
                notes ?? null,
                activityId != null ? activityId : null,
                Number(userId),
                feuille[0].id,
                sid
            ]
        );

        if (result.changes === 0) {
            return {
                ok: false,
                code: 'NO_ROW_UPDATED',
                message: 'Aucune ligne de présence mise à jour (élève absent de cette feuille ?)'
            };
        }
        return { ok: true, changes: result.changes, studentId: sid };
    } catch (err) {
        console.error('updatePresenceStatus:', err);
        return {
            ok: false,
            code: 'DB_ERROR',
            message: err.message || 'Erreur base de données'
        };
    }
}

function buildStudentStatusSocketPayload(attendanceId, studentId, status, notes) {
    return {
        attendanceId,
        studentId: typeof studentId === 'number' ? studentId : parseInt(studentId, 10),
        status,
        notes: notes ?? undefined,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    parseBearerUserId,
    updatePresenceStatus,
    buildStudentStatusSocketPayload
};
