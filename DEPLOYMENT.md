# Guide de déploiement PERMAPPEL

## 🚀 Déploiement rapide

Ce guide couvre deux situations : **utiliser l’application depuis les sources** (dépôt cloné) ou **construire un installable** (sections Empaquetage). Les utilisateurs finaux reçoivent en général un `.exe` (NSIS ou portable) et n’ont pas besoin de Node.js sur le poste.

### 1. Prérequis
- Windows 10/11 (64-bit) pour les builds Electron ciblés dans ce dépôt
- Node.js 16.x ou supérieur (uniquement pour cloner le dépôt et lancer / construire depuis les sources)
- Environ 500 Mo d’espace disque libre pour les dépendances et les builds

### 2. Installation depuis le dépôt (développement ou test)

À la racine du projet, la commande `npm start` lance **Electron**, qui démarre l’application avec le serveur intégré (voir `package.json`). Ce n’est pas la même chose qu’installer uniquement le binaire généré par `electron-builder`.

```bash
# Cloner ou télécharger le projet
git clone <repository-url>
cd PERMAPPEL_BUILD_2

# Installer les dépendances (postinstalle aussi server/)
npm install

# (Optionnel, développement uniquement) SQLite local server/permappel.db — pas la base « réelle »
# Voir section « Base de données »
# npm run init-db

# Lancer l’app Electron (la base réelle est créée au premier lancement, voir ci-dessous)
npm start
```

Pour travailler avec le serveur dans un terminal séparé (mode développement classique), voir le [README.md](README.md) (serveur + `npm run dev`).

## 📦 Empaquetage

### Version portable (recommandée)
```bash
npm run build-portable
```

### Installateur Windows (NSIS)
```bash
npm run build-installer
# ou les cibles Windows multiples :
npm run build-win
```

### Build complet (configuration electron-builder)
```bash
npm run build
```

## 🔧 Configuration de production

Le dépôt **ne fournit pas** de fichiers `production.env`, `.env` ni `config.json` à la racine. Le comportement par défaut est défini dans le code ([server/server.js](server/server.js), [server/database.js](server/database.js)) :

- **Port du serveur** : 3001 par défaut au démarrage.
- **Base SQLite** : créée sous un répertoire partagé système (voir section Base de données), pas via `DB_PATH` dans un fichier livré avec le projet.
- **Sauvegardes automatiques** : déclenchées côté serveur (intervalle d’une heure dans `setupAutoBackup`), fichiers dans le dossier `backups/` à côté de `permappel.db`.

Si vous hébergez ou adaptez le serveur vous-même, vous pouvez introduire des variables d’environnement **dans votre propre infrastructure** ; il faudra alors les lire explicitement dans le code ou un fichier de config que vous ajoutez. Ne vous fiez pas à d’anciens exemples de doc mentionnant `JWT_SECRET` ou `config.json` : ils ne correspondent pas aux fichiers actuels du dépôt.

**Windows** : `PROGRAMDATA` peut influencer les chemins (ex. `C:\ProgramData\PERMAPPEL`), comme implémenté dans `database.js`.

## 🗄️ Base de données

### Base « réelle » (production / usage installé)

Au premier démarrage de l’application, le serveur crée et met à jour automatiquement la base SQLite dans un répertoire **partagé système** (logique définie dans `server/database.js`), par exemple :

- **Windows** : `C:\ProgramData\PERMAPPEL\permappel.db`
- **macOS** : `/Library/Application Support/PERMAPPEL/permappel.db`
- **Linux** : `/opt/PERMAPPEL/permappel.db`

Aucun script d’initialisation manuel n’est requis pour cette base en déploiement normal.

### Script `init-database.js` (développement uniquement)

Le fichier `init-database.js` à la racine du dépôt **ne crée pas** la base ci-dessus. Il génère uniquement un fichier local `server/permappel.db`, utile pour le **développement** (tests, inspection SQL). En production, ne pas confondre ce fichier avec la base utilisée par l’app.

```bash
# Uniquement si vous avez besoin de ce fichier local de dev (npm run init-db)
node init-database.js
```

### Sauvegarde

**Production :** privilégier la sauvegarde depuis l’interface d’administration ou une copie du fichier `permappel.db` dans le répertoire partagé (ex. `C:\ProgramData\PERMAPPEL\` sous Windows).

```bash
# Exemple si vous travaillez sur la copie locale de développement server/permappel.db
cp server/permappel.db server/backups/permappel-backup-$(date +%Y%m%d).db
```

### Restauration

**Production :** arrêter l’application, remplacer le `permappel.db` du répertoire partagé par la sauvegarde, puis redémarrer.

```bash
# Exemple pour la base locale de développement uniquement
cp server/backups/permappel-backup-YYYYMMDD.db server/permappel.db
```

## 🔐 Sécurité

### Comptes par défaut
- **Admin:** `admin` / `admin123`
- **Email:** `admin@etablissement.fr`

⚠️ **IMPORTANT:** Changez immédiatement le mot de passe administrateur !

### Bonnes pratiques
1. Changez tous les mots de passe par défaut
2. Si vous ajoutez des secrets ou variables d’environnement personnalisés, documentez-les et évitez les valeurs par défaut publiques
3. Les sauvegardes automatiques côté serveur sont déjà prévues (dossier `backups/` à côté de la base) ; conservez aussi des copies hors machine si possible
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
1. Vérifiez les permissions du répertoire de la base **réelle** (ex. `C:\ProgramData\PERMAPPEL\` sous Windows), pas seulement `server/`
2. Vérifiez l'espace disque disponible
3. En **développement uniquement**, vous pouvez recréer `server/permappel.db` avec `npm run init-db` — cela **n’affecte pas** la base de production dans ProgramData
4. Vérifiez les logs du serveur et l’absence de verrouillage du fichier `.db` (autre instance de l’app)

#### Problème d'export PDF
Les PDF sont générés **dans le navigateur / la fenêtre Electron** avec **jsPDF** (`public/js/pdf-export.js`). Il n’y a pas d’export PDF serveur via Puppeteer dans ce projet (Puppeteer est listé dans les dépendances serveur mais n’est pas utilisé pour cette fonctionnalité).

1. Vérifiez la **connexion Internet** au premier chargement si jsPDF est chargé depuis le CDN (unpkg) ; en cas d’échec, l’app tente le fichier local `public/js/jspdf.umd.min.js`
2. Ouvrez les outils de développement (F12) pour voir d’éventuelles erreurs JavaScript
3. Vérifiez l’espace disque si vous enregistrez le fichier manuellement
4. Testez depuis un autre poste pour isoler un blocage réseau ou pare-feu

#### Performance lente
1. Vérifiez l'utilisation CPU/RAM
2. Vérifiez la taille de la base de données et l’historique des sauvegardes dans `backups/`
3. Réduisez le nombre de clients simultanés sur une même feuille d’appel si le réseau est saturé

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

Sauvegardez toujours le fichier `permappel.db` **réel** (répertoire partagé, ex. `C:\ProgramData\PERMAPPEL\`) avant une mise à jour de l’application.

Les **évolutions de schéma** (nouvelles tables, colonnes) sont en principe appliquées **au démarrage** du serveur via `DatabaseManager` dans [server/database.js](server/database.js) (par ex. `ensureCdiSchema` et créations `CREATE TABLE IF NOT EXISTS`). Il n’existe pas de script `update-database.js` dans ce dépôt.

```bash
# Exemple : sauvegarde manuelle de la copie locale de développement uniquement
cp server/permappel.db server/backups/permappel-pre-update.db
```

## 📋 Checklist de déploiement

### Avant le déploiement
- [ ] Node.js installé et configuré (si build ou run depuis les sources)
- [ ] Dépendances installées
- [ ] Compris que la base « réelle » est créée au premier lancement (pas via `init-database.js`)
- [ ] Mots de passe par défaut changés après la première connexion
- [ ] Tests de fonctionnement effectués
- [ ] Si vous utilisez la **borne CDI** : comptes « Élève » testés, restriction IP bornes configurée si besoin (voir README, administration)

### Après le déploiement
- [ ] Application démarre correctement
- [ ] Interface utilisateur accessible (y compris depuis le réseau local si prévu)
- [ ] Authentification fonctionnelle
- [ ] Création d'appel testée
- [ ] Export PDF testé (jsPDF / réseau ou copie locale)
- [ ] Sauvegarde automatique active (fichiers dans `backups/` à côté de la base)
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

**PERMAPPEL** — Guide de déploiement (version applicative : voir `package.json`, ex. 1.0.4)
