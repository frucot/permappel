const jwt = require('jsonwebtoken');

const JWT_EXPIRES_IN = '12h';
const DUMMY_BCRYPT_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
let runtimeJwtSecret = null;

function setJwtSecret(secret) {
    runtimeJwtSecret = secret;
}

function getJwtSecretOrThrow() {
    if (!runtimeJwtSecret) {
        throw new Error('JWT secret non initialisé');
    }
    return runtimeJwtSecret;
}

function signToken(user) {
    return jwt.sign(
        { id: user.id, role: user.role },
        getJwtSecretOrThrow(),
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function verifyToken(token) {
    const secret = runtimeJwtSecret;
    if (!secret) {
        return null;
    }
    try {
        return jwt.verify(token, secret);
    } catch (error) {
        return null;
    }
}

module.exports = {
    JWT_EXPIRES_IN,
    DUMMY_BCRYPT_HASH,
    setJwtSecret,
    signToken,
    verifyToken
};
