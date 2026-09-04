/**
 * Même logique que la configuration admin « Bornes CDI » : si la restriction IP est
 * activée, seules les requêtes depuis une IP autorisée passent (borne physique).
 * Utilisé pour /cdi/checkin, les GET borne, et /students/autocomplete (borne uniquement).
 */
module.exports = function createCdiKioskIpHelpers(db) {
    async function getCdiKioskSecurityConfig() {
        const defaultConfig = { enabled: false, allowedIPs: ['127.0.0.1'] };
        const rows = await db.executeQuery(
            `SELECT cle, valeur FROM config WHERE cle IN ('cdi_kiosk_ip_restriction_enabled', 'cdi_kiosk_allowed_ips')`
        );

        let enabled = defaultConfig.enabled;
        let allowedIPs = [...defaultConfig.allowedIPs];

        rows.forEach(row => {
            if (row.cle === 'cdi_kiosk_ip_restriction_enabled') {
                enabled = row.valeur === 'true' || row.valeur === '1';
            }
            if (row.cle === 'cdi_kiosk_allowed_ips') {
                try {
                    const parsed = JSON.parse(row.valeur || '[]');
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        allowedIPs = parsed;
                    }
                } catch {
                    allowedIPs = [...defaultConfig.allowedIPs];
                }
            }
        });

        return { enabled, allowedIPs };
    }

    function normalizeIP(rawIP) {
        if (!rawIP) return '';
        let ip = rawIP;
        if (ip.includes(',')) {
            ip = ip.split(',')[0].trim();
        }
        if (ip.startsWith('::ffff:')) {
            ip = ip.replace(/^::ffff:/, '');
        }
        return ip;
    }

    async function enforceKioskIPRestriction(req, res, next) {
        try {
            const securityConfig = await getCdiKioskSecurityConfig();
            if (!securityConfig.enabled) {
                return next();
            }

            const clientIP = normalizeIP(
                req.socket?.remoteAddress ||
                req.connection?.remoteAddress
            );

            if (!securityConfig.allowedIPs.includes(clientIP)) {
                return res.status(403).json({
                    success: false,
                    message: 'Cette borne CDI n’est pas autorisée'
                });
            }

            next();
        } catch (error) {
            console.error('Erreur vérification IP borne CDI:', error);
            return res.status(500).json({
                success: false,
                message: 'Erreur serveur'
            });
        }
    }

    return { getCdiKioskSecurityConfig, normalizeIP, enforceKioskIPRestriction };
};
