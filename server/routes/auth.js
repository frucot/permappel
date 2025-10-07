const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

module.exports = (db) => {
    // Connexion
    router.post('/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            
            if (!username || !password) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Nom d\'utilisateur et mot de passe requis' 
                });
            }

            // Rechercher l'utilisateur
            const users = await db.executeQuery(
                'SELECT * FROM utilisateurs WHERE nomUtilisateur = ? AND actif = 1',
                [username]
            );

            if (users.length === 0) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Identifiants invalides' 
                });
            }

            const user = users[0];

            // Vérifier le mot de passe
            const isValidPassword = await bcrypt.compare(password, user.motDePasse);
            
            if (!isValidPassword) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Identifiants invalides' 
                });
            }

            // Retourner les informations utilisateur (sans le mot de passe)
            const { motDePasse, ...userInfo } = user;
            
            res.json({
                success: true,
                user: userInfo,
                token: user.id.toString() // Token simple basé sur l'ID
            });

        } catch (error) {
            console.error('Erreur de connexion:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    // Vérifier le token
    router.get('/me', async (req, res) => {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');
            
            if (!token) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Token manquant' 
                });
            }

            const users = await db.executeQuery(
                'SELECT id, nomUtilisateur, nom, prenom, email, role FROM utilisateurs WHERE id = ? AND actif = 1',
                [token]
            );

            if (users.length === 0) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Token invalide' 
                });
            }

            res.json({
                success: true,
                user: users[0]
            });

        } catch (error) {
            console.error('Erreur vérification token:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Erreur serveur' 
            });
        }
    });

    return router;
};
