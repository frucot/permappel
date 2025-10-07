# Guide de déploiement PERMAPPEL

## 🚀 Déploiement rapide

### 1. Prérequis
- Windows 10/11 (64-bit)
- Node.js 16.x ou supérieur
- 500 MB d'espace disque libre

### 2. Installation
```bash
# Cloner ou télécharger le projet
git clone <repository-url>
cd permappel

# Installer les dépendances
npm install
cd server && npm install && cd ..

# Initialiser la base de données
node init-database.js

# Démarrer l'application
npm start
```

## 📦 Empaquetage

### Version portable (recommandée)
```bash
# Construire la version portable
npm run build-portable

# Ou utiliser le script PowerShell
.\build.ps1 -Type portable
```

### Installateur Windows
```bash
# Construire l'installateur
npm run build-win

# Ou utiliser le script PowerShell
.\build.ps1 -Type installer
```

### Les deux versions
```bash
# Construire les deux versions
npm run build

# Ou utiliser le script PowerShell
.\build.ps1 -Type both
```

## 🔧 Configuration de production

### Variables d'environnement
Copiez `production.env` vers `.env` et modifiez les valeurs :

```bash
# Sécurité (IMPORTANT: Changez ces valeurs)
SESSION_SECRET=your-unique-secret-key
JWT_SECRET=your-unique-jwt-secret

# Base de données
DB_PATH=./server/permappel.db
DB_AUTO_BACKUP=true

# Performance
MAX_CONCURRENT_REQUESTS=100
REQUEST_TIMEOUT=30000
```

### Configuration de l'application
Modifiez `config.json` selon vos besoins :

```json
{
  "server": {
    "port": 3001,
    "host": "localhost"
  },
  "database": {
    "autoBackup": true,
    "backupInterval": 24
  },
  "security": {
    "sessionTimeout": 3600,
    "maxLoginAttempts": 5
  }
}
```

## 🗄️ Base de données

### Initialisation
```bash
# Créer la base de données avec les données par défaut
node init-database.js
```

### Sauvegarde
```bash
# Sauvegarde manuelle
cp server/permappel.db server/backups/permappel-backup-$(date +%Y%m%d).db
```

### Restauration
```bash
# Restaurer depuis une sauvegarde
cp server/backups/permappel-backup-YYYYMMDD.db server/permappel.db
```

## 🔐 Sécurité

### Comptes par défaut
- **Admin:** `admin` / `admin123`
- **Email:** `admin@etablissement.fr`

⚠️ **IMPORTANT:** Changez immédiatement le mot de passe administrateur !

### Bonnes pratiques
1. Changez tous les mots de passe par défaut
2. Utilisez des clés secrètes uniques
3. Activez les sauvegardes automatiques
4. Limitez l'accès réseau si nécessaire
5. Surveillez les logs d'activité

## 📊 Monitoring

### Logs
- **Console:** Logs en temps réel
- **Fichier:** `logs/app.log` (si configuré)
- **Niveau:** `info` en production

### Métriques
- Utilisateurs connectés
- Requêtes par minute
- Utilisation de la base de données
- Erreurs et exceptions

## 🚨 Dépannage

### Problèmes courants

#### L'application ne démarre pas
1. Vérifiez Node.js : `node --version`
2. Vérifiez les dépendances : `npm list`
3. Vérifiez le port 3001 : `netstat -an | findstr 3001`
4. Vérifiez les logs d'erreur

#### Erreur de base de données
1. Vérifiez les permissions du dossier `server/`
2. Vérifiez l'espace disque disponible
3. Réinitialisez : `node init-database.js`
4. Vérifiez la configuration dans `config.json`

#### Problème d'export PDF
1. Vérifiez Puppeteer : `npm list puppeteer`
2. Vérifiez la connexion internet
3. Vérifiez l'espace disque pour les exports
4. Vérifiez les permissions d'écriture

#### Performance lente
1. Vérifiez l'utilisation CPU/RAM
2. Vérifiez la taille de la base de données
3. Optimisez les requêtes
4. Augmentez les limites dans `config.json`

### Logs d'erreur
```bash
# Afficher les logs en temps réel
npm start 2>&1 | tee app.log

# Analyser les logs d'erreur
grep -i error app.log
grep -i warning app.log
```

## 🔄 Mise à jour

### Mise à jour de l'application
1. Arrêtez l'application
2. Sauvegardez la base de données
3. Remplacez les fichiers
4. Redémarrez l'application

### Mise à jour de la base de données
```bash
# Sauvegarde avant mise à jour
cp server/permappel.db server/backups/permappel-pre-update.db

# Mise à jour (si nécessaire)
node update-database.js
```

## 📋 Checklist de déploiement

### Avant le déploiement
- [ ] Node.js installé et configuré
- [ ] Dépendances installées
- [ ] Base de données initialisée
- [ ] Configuration de production appliquée
- [ ] Mots de passe par défaut changés
- [ ] Tests de fonctionnement effectués

### Après le déploiement
- [ ] Application démarre correctement
- [ ] Interface utilisateur accessible
- [ ] Authentification fonctionnelle
- [ ] Création d'appel testée
- [ ] Export PDF testé
- [ ] Sauvegarde automatique active
- [ ] Logs d'erreur surveillés

### Maintenance régulière
- [ ] Sauvegardes vérifiées
- [ ] Logs analysés
- [ ] Performance surveillée
- [ ] Mises à jour de sécurité
- [ ] Nettoyage des fichiers temporaires

## 📞 Support

En cas de problème :
1. Consultez les logs d'erreur
2. Vérifiez la configuration
3. Testez avec une base de données vide
4. Contactez l'équipe de support

---

**PERMAPPEL v1.0.0** - Guide de déploiement
