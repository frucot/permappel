const crypto = require('crypto');

const JWT_SECRET_CONFIG_KEY = 'jwt_secret';
const JWT_SECRET_SOURCE_CONFIG_KEY = 'jwt_secret_source';
const JWT_SECRET_DESCRIPTION = 'Secret JWT persistant généré automatiquement';

function generateJwtSecret() {
    return crypto.randomBytes(64).toString('hex');
}

async function ensureConfigTable(db) {
    await db.executeQuery(`
        CREATE TABLE IF NOT EXISTS config (
            cle TEXT PRIMARY KEY,
            valeur TEXT,
            description TEXT,
            modifieLe DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

async function persistJwtSecret(db, secret) {
    await db.executeQuery(
        `
            INSERT OR REPLACE INTO config (cle, valeur, description, modifieLe)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `,
        [JWT_SECRET_CONFIG_KEY, secret, JWT_SECRET_DESCRIPTION]
    );
}

async function setJwtSecretSource(db, source) {
    await db.executeQuery(
        `
            INSERT OR REPLACE INTO config (cle, valeur, description, modifieLe)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `,
        [JWT_SECRET_SOURCE_CONFIG_KEY, source, 'Origine du secret JWT actif (env|db|generated)']
    );
}

async function getJwtSecret(db) {
    const envSecret = process.env.JWT_SECRET?.trim();
    if (envSecret) {
        await ensureConfigTable(db);
        await setJwtSecretSource(db, 'env');
        return { secret: envSecret, source: 'env' };
    }

    await ensureConfigTable(db);
    const rows = await db.executeQuery(
        'SELECT valeur FROM config WHERE cle = ? LIMIT 1',
        [JWT_SECRET_CONFIG_KEY]
    );

    const dbSecret = rows[0]?.valeur?.trim();
    if (dbSecret) {
        await setJwtSecretSource(db, 'db');
        return { secret: dbSecret, source: 'db' };
    }

    const generatedSecret = generateJwtSecret();
    await persistJwtSecret(db, generatedSecret);
    await setJwtSecretSource(db, 'generated');
    return { secret: generatedSecret, source: 'generated' };
}

module.exports = {
    getJwtSecret
};
