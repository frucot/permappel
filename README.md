# PERMAPPEL - Système de Gestion des Appels

## 📋 Description

PERMAPPEL est une application de gestion des appels scolaires développée avec Electron et Node.js. Elle permet de créer, gérer et suivre les feuilles d'appel en temps réel avec synchronisation multi-utilisateurs.

**En bref — qui lit ce guide ?**
- **Personnel de l’établissement (administrateur, vie scolaire, enseignants)** : connectez-vous à l’interface principale pour les appels, les élèves et l’administration. Les **AED**, **CPE** et **documentalistes** ont le même type d’accès applicatif selon les comptes créés (seul le rôle **administrateur** gère l’administration complète).
- **Élèves** : uniquement la **borne d’inscription CDI** (page simplifiée), après connexion avec un compte au rôle « Élève ».
- **Déploiement technique** : consultez aussi [DEPLOYMENT.md](DEPLOYMENT.md) pour les chemins de base de données et la mise en production.

## ✨ Fonctionnalités principales

### 🎯 Gestion des Appels
- **Création d'appels** avec sélection de créneaux, classes et groupes
- **Appels récurrents** (hebdomadaire, bi-hebdomadaire)
- **Feuilles d'appel en temps réel** avec synchronisation Socket.IO
- **Chat collaboratif par feuille d'appel** pour échanger entre utilisateurs connectés
- **Synchronisation automatique** des élèves (ajout/suppression selon critères)
- **Mode lecture seule** pour les appels passés
- **Export PDF** des feuilles d'appel (génération dans l’interface avec jsPDF)

### 📚 Borne CDI (Centre de documentation et d’information)
- **Page dédiée** `cdi-kiosk.html` : recherche d’élève, choix d’une **activité CDI**, inscription sur la feuille d’appel du créneau en cours (statut type présence CDI)
- **Comptes « Élève »** : après connexion, accès **uniquement** à cette borne (pas au reste de l’application)
- **Raccourci pour le personnel** : depuis la liste des appels, bouton **« Borne CDI »** pour ouvrir la page dans un nouvel onglet (utile sur un poste salle / CDI)
- **Administration** : liste des activités CDI en base, **restriction optionnelle par adresse IP** des postes autorisés à utiliser la borne (réglage distinct de la restriction IP globale de l’application)

### 👥 Gestion des Utilisateurs
- **Authentification** : connexion avec mot de passe ; après validation, un **jeton** (identifiant utilisateur) est stocké côté client et envoyé dans l’en-tête `Authorization` pour les requêtes protégées — ce n’est **pas** un JWT signé
- **Gestion des rôles** : administrateur, AED, CPE, documentaliste, élève (voir le guide administrateur ci-dessous)
- **Synchronisation multi-utilisateurs** sur la même feuille d'appel

### 🎓 Gestion des Données
- **Import/Export** des données élèves (CSV)
- **Gestion des classes et groupes**
- **Sélection avancée** des élèves avec critères multiples
- **Actions en lot** (assignation de groupes, autorisations de sortie)

### 📊 Statistiques et Rapports
- **Tableau de bord** avec statistiques
- **Historique des appels**
- **Export de données** au format PDF

## 🛠️ Technologies Utilisées

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Base de données**: SQLite
- **Communication temps réel**: Socket.IO
- **Application desktop**: Electron
- **Authentification**: jeton basé sur l’identifiant utilisateur (header `Authorization`), mots de passe hashés avec bcrypt
- **Export PDF**: jsPDF (navigateur / Electron ; chargement possible via CDN avec repli sur copie locale)

*Note : le serveur liste parfois la dépendance `puppeteer` dans `server/package.json`, mais l’export PDF utilisateur passe par jsPDF côté client, pas par Puppeteer.*

## 📦 Installation

### Prérequis
- Node.js (version 16 ou supérieure)
- npm ou yarn

### Installation des dépendances

```bash
# Installer les dépendances principales
npm install

# Les dépendances du serveur sont installées automatiquement via postinstall
# Sinon, installer manuellement :
cd server
npm install
cd ..
```

### Script `init-database.js` (développement uniquement)

**Important :** ce script **ne crée pas** la base de données utilisée par l’application PERMAPPEL en usage normal (mode production / installeur). Au premier lancement, le serveur crée et met à jour automatiquement la base **réelle** via `server/database.js`, dans le répertoire partagé système (chemins indiqués plus bas dans *Base de données*).

`init-database.js` sert uniquement au **développement** : il génère un fichier SQLite local `server/permappel.db` (pratique pour tests ou inspection SQL). Le serveur PERMAPPEL **n’utilise pas** ce chemin par défaut — il ouvre la base dans le répertoire partagé système. Vous pouvez l’exécuter avec `npm run init-db` ou :

```bash
node init-database.js
```

**Compte administrateur par défaut :**
- **Nom d'utilisateur** : `admin`
- **Mot de passe** : `admin123`
- ⚠️ **IMPORTANT** : Changez le mot de passe après la première connexion !

## 🚀 Utilisation

### Mode Développement vs Mode Production

#### 🔧 Mode Développement
Le mode développement est utilisé pour **développer et tester** l'application :

**Caractéristiques :**
- Code source non compilé
- Serveur Node.js séparé de l'application Electron
- Hot-reload et débogage facilités
- Accès aux outils de développement (DevTools)

**Démarrage :**
```bash
# Terminal 1 : Démarrer le serveur
cd server
npm start

# Terminal 2 : Démarrer l'application Electron
npm run dev
```

**Quand utiliser :**
- Développement de nouvelles fonctionnalités
- Tests et débogage
- Modification du code

#### 📦 Mode Production
Le mode production est l'application **compilée et empaquetée** prête à être distribuée :

**Caractéristiques :**
- Application compilée en exécutable (.exe)
- Serveur intégré dans l'application
- Optimisations activées
- Pas d'accès aux outils de développement

**Démarrage :**
```bash
# Lancer l'application compilée
npm start
```

**Quand utiliser :**
- Utilisation normale par les utilisateurs finaux
- Distribution de l'application

### 🏗️ Construction de l'Installeur Electron

Pour créer l'installeur Windows (.exe) de l'application :

#### 1. Préparer la version
```bash
# Mettre à jour la version dans package.json (ligne 3)
# Exemple : "version": "1.0.4"
```

#### 2. Nettoyer les anciens builds
```bash
# Supprimer le dossier dist (anciens builds)
Remove-Item -Recurse -Force dist\* -ErrorAction SilentlyContinue
```

#### 3. Construire l'installeur

**Option A : Installer NSIS uniquement**
```bash
npm run build-installer
```
Génère : `dist/PERMAPPEL Setup 1.0.4.exe` (selon la version dans package.json)

**Option B : Version portable uniquement**
```bash
npm run build-portable
```
Génère : `dist/PERMAPPEL-1.0.4-Portable.exe` (selon la version dans package.json)

**Option C : Les deux versions**
```bash
npm run build-win
```
Génère les deux fichiers dans `dist/`

**Option D : Build complet (toutes plateformes)**
```bash
npm run build
```

#### 4. Résultat
Les fichiers générés se trouvent dans le dossier `dist/` :
- **PERMAPPEL Setup X.X.X.exe** : Installer Windows (NSIS)
- **PERMAPPEL-X.X.X-Portable.exe** : Version portable (pas d'installation)

#### Notes importantes
- Le numéro de version est lu depuis `package.json` (ligne 3)
- Assurez-vous que `package-lock.json` est à jour : `npm version X.X.X --no-git-tag-version`
- La compilation peut prendre plusieurs minutes
- L'installeur inclut toutes les dépendances nécessaires

## 👨‍💼 Guide Utilisateur - Administrateur

### Première connexion

1. **Lancer l'application**
   - Double-cliquer sur `PERMAPPEL Setup X.X.X.exe` (ou la version portable)
   - L'application démarre automatiquement

2. **Se connecter**
   - Utiliser les identifiants par défaut : `admin` / `admin123`
   - ⚠️ **Changer immédiatement le mot de passe** dans la section Administration

### Configuration initiale

#### 1. Gestion des utilisateurs
**Menu : Administration → Utilisateurs**

- **Créer des utilisateurs** : Ajouter les comptes des professeurs/utilisateurs
- **Modifier les utilisateurs** : Changer les informations ou les rôles
- **Supprimer des utilisateurs** : Retirer un compte (attention : action irréversible)

**Rôles disponibles** (lors de la création ou modification d’un utilisateur) :
- **Administrateur** : accès complet, y compris administration (utilisateurs, sécurité, base de données, groupes, créneaux, etc.)
- **AED**, **CPE**, **Documentaliste** : accès à l’interface principale (appels, élèves, etc.) **sans** le panneau d’administration réservé aux administrateurs
- **Élève** : après connexion, redirection **automatique** vers la **borne CDI** uniquement (pas d’accès aux menus appels / élèves du personnel)

#### 2. Import des élèves
**Menu : Élèves → Import CSV**

1. **Télécharger le modèle** : Cliquer sur "Télécharger le modèle CSV"
2. **Remplir le fichier** : Voir section "Structure du fichier CSV" ci-dessous
3. **Importer** : Sélectionner le fichier et cliquer sur "Importer"
4. **Vérifier les résultats** : Consulter le nombre d'élèves créés/mis à jour

#### 3. Gestion des groupes
**Menu : Administration → Groupes**

- **Créer des groupes** : Ex. "6 Franc 1", "Chorale", "Option Maths"
- **Modifier des groupes** : Renommer un groupe existant
- **Supprimer des groupes** : Retirer un groupe (les élèves associés perdent cette association)

#### 4. Configuration des créneaux
**Menu : Administration → Créneaux**

- **Créer des créneaux** : Définir les horaires (ex. M1: 08:00-09:00)
- **Modifier des créneaux** : Ajuster les horaires
- **Supprimer des créneaux** : Retirer un créneau (attention : affecte les appels existants)

#### 5. Configuration de l'établissement
**Menu : Administration → Établissement**

- Renseigner les informations de l'établissement (nom, adresse, etc.)
- Ces informations apparaissent sur les exports PDF

#### 6. Bornes CDI (optionnel)
**Menu : Administration → section « Bornes CDI »** (dans la zone sécurité / administration)

- **Restriction IP** : vous pouvez **désactiver** (par défaut) ou **activer** la limitation des postes pouvant utiliser l’auto-inscription CDI (recherche élève, activité, validation). Utile pour n’autoriser que les PC du CDI.
- **Liste d’adresses IP** : ajoutez les IP des postes « borne » ; enregistrez la configuration après modification.
- **Important** : ce réglage est **indépendant** de la restriction IP globale de l’application (section *Restriction d'accès par adresse IP* plus bas dans ce document). Les deux peuvent coexister avec des règles différentes.

Créez des **comptes élèves** (rôle « Élève ») si les élèves doivent se connecter eux-mêmes sur la borne ; sinon, un compte personnel peut ouvrir la page `cdi-kiosk.html` selon votre organisation.

### Utilisation quotidienne

#### Créer une feuille d'appel

1. **Menu : Appels → Nouvel appel**
2. **Sélectionner la date** : Date de l'appel
3. **Choisir le créneau** : Créneau horaire
4. **Sélectionner les classes et/ou groupes** :
   - Classes : Tous les élèves de ces classes
   - Groupes : Tous les élèves de ces groupes
   - Peut combiner classes ET groupes
5. **Option récurrence** (optionnel) :
   - Activer la récurrence
   - Choisir le type (hebdomadaire, bi-hebdomadaire)
   - Définir la fin (date ou nombre d'occurrences)
6. **Créer** : La feuille d'appel s'ouvre automatiquement

#### Gérer une feuille d'appel

**Fonctionnalités disponibles :**
- **Marquer les présences** : Cliquer sur les boutons (Présent, Absent, CDI, Excusé)
- **Synchronisation automatique** : Les modifications sont visibles en temps réel par tous les utilisateurs
- **Chat de la feuille d'appel** : Permet aux utilisateurs connectés à la même feuille d'échanger des messages en temps réel
- **Ajouter des groupes/classes** : Bouton "Ajouter des groupes" ou "Ajouter des classes"
- **Synchroniser les élèves** : Bouton "Synchroniser les élèves" pour ajouter/supprimer automatiquement selon les critères
- **Vérifier l'appel** : Vérifier qu'aucun élève n'a été oublié
- **Export PDF** : Générer un PDF de la feuille d'appel
- **Borne CDI** (personnel) : depuis l’écran de gestion des appels, bouton pour ouvrir la page d’inscription CDI dans un nouvel onglet ; les inscriptions peuvent mettre à jour la feuille ouverte en temps réel

**Utiliser le chat dans une feuille d'appel :**
1. Ouvrir la feuille d'appel concernée
2. Saisir un message dans la zone de chat
3. Envoyer le message pour qu'il soit visible instantanément par les autres utilisateurs connectés à cette feuille
4. Utiliser le chat pour coordonner les mises à jour de présence et partager les informations de suivi

**Synchronisation automatique des élèves :**
- À l'ouverture d'une feuille d'appel, les élèves sont automatiquement synchronisés
- Les nouveaux élèves correspondant aux critères sont ajoutés
- Les élèves qui ne correspondent plus aux critères sont supprimés
- Utilisation manuelle possible via le bouton "Synchroniser les élèves"

#### Gestion des élèves

**Menu : Élèves**

- **Voir la liste** : Consulter tous les élèves
- **Filtrer** : Par classe, groupe, ou recherche textuelle
- **Modifier un élève** : Cliquer sur "Modifier"
- **Sélection avancée** : Critères multiples pour sélectionner des élèves
- **Actions en lot** : Assigner des groupes ou autorisations de sortie à plusieurs élèves

#### Export de données

**Menu : Appels → Export**

- **Export journée** : Toutes les feuilles d'appel d'une date
- **Export période** : Feuilles d'appel sur une période
- **Export feuille unique** : Depuis la feuille d'appel ouverte

## 📄 Structure du fichier CSV pour l'import des élèves

### Format du fichier

Le fichier CSV doit respecter la structure suivante :

**En-têtes (première ligne) :**
```
Nom,Prénom,Classe,Groupes,Régime,Date de naissance
```

### Colonnes détaillées

| Colonne | Obligatoire | Description | Format | Exemple |
|---------|-------------|-------------|--------|---------|
| **Nom** | ✅ Oui | Nom de famille de l'élève | Texte | `DUPONT` |
| **Prénom** | ✅ Oui | Prénom de l'élève | Texte | `Jean` |
| **Classe** | ✅ Oui | Classe de l'élève | Texte | `6 A` |
| **Groupes** | ❌ Non | Groupes de l'élève (séparés par virgule) | Texte | `6 Franc 1,Chorale` |
| **Régime** | ❌ Non | Régime de l'élève | Texte | `Demi-pensionnaire` |
| **Date de naissance** | ❌ Non | Date de naissance | DD/MM/YYYY | `15/03/2010` |

### Exemple de fichier CSV

```csv
Nom,Prénom,Classe,Groupes,Régime,Date de naissance
DUPONT,Jean,6 A,"6 Franc 1,Chorale",Demi-pensionnaire,15/03/2010
MARTIN,Marie,3 B,"3 BIL,3ANG2 gp1",Externe,22/07/2011
DURAND,Pierre,5 C,Option Maths,Externe,10/11/2009
BERNARD,Sophie,4 A,Chorale,Demi-pensionnaire,05/02/2010
```

### Règles importantes

1. **Séparateur** : Utiliser la virgule (`,`) comme séparateur
2. **Encodage** : UTF-8 recommandé
3. **Groupes multiples** : Séparer par des virgules, entourer de guillemets si nécessaire
   - ✅ Correct : `"6 Franc 1,Chorale"`
   - ✅ Correct : `6 Franc 1,Chorale` (si pas d'espaces problématiques)
4. **Date de naissance** : Format `DD/MM/YYYY` (ex: `15/03/2010`)
5. **Régime** : Valeurs courantes : `Externe`, `Demi-pensionnaire`, `Interne`
6. **Champs vides** : Les colonnes optionnelles peuvent être laissées vides

### Comportement de l'import

- **Création** : Si l'élève n'existe pas (nom + prénom + classe), il est créé
- **Mise à jour** : Si l'élève existe déjà, ses informations sont mises à jour
- **Groupes** : Les groupes sont créés automatiquement s'ils n'existent pas
- **Erreurs** : Les lignes en erreur sont listées avec le numéro de ligne et la raison

### Télécharger le modèle

Dans l'interface, cliquez sur **"Télécharger le modèle CSV"** pour obtenir un fichier exemple prêt à remplir.

## 📁 Structure du Projet

```
PERMAPPEL_BUILD_2/
├── public/                 # Interface utilisateur
│   ├── js/                # Scripts JavaScript
│   │   ├── app.js         # Application principale
│   │   ├── attendance.js  # Gestion des appels
│   │   ├── students.js    # Gestion des élèves
│   │   ├── cdi-kiosk.js   # Borne CDI (API /cdi, /students)
│   │   └── ...
│   ├── styles.css         # Styles CSS
│   ├── index.html         # Page principale
│   ├── cdi-kiosk.html     # Borne d'inscription CDI
│   └── attendance.html    # Page feuille d'appel
├── server/                # Serveur backend
│   ├── routes/           # Routes API
│   │   ├── auth.js       # Authentification
│   │   ├── attendance.js # Gestion des appels
│   │   ├── students.js   # Gestion des élèves
│   │   └── ...
│   ├── database.js       # Gestion base de données
│   ├── server.js         # Serveur principal
│   └── permappel.db      # (optionnel) SQLite local si vous avez lancé init-database.js — pas la base « réelle » de l’app installée
├── assets/                # Ressources (icônes, etc.)
├── dist/                  # Fichiers compilés (après build)
├── main.js               # Processus principal Electron
├── preload.js           # Script de préchargement
├── package.json         # Configuration npm
├── electron-builder.json # Configuration Electron Builder
└── README.md            # Ce fichier
```

## 🔧 Configuration

### Base de données

La base de données SQLite **réelle** est créée automatiquement au premier démarrage du serveur (application Electron ou `cd server && npm start`) dans :
- **Windows** : `C:\ProgramData\PERMAPPEL\permappel.db`
- **macOS** : `/Library/Application Support/PERMAPPEL/permappel.db`
- **Linux** : `/opt/PERMAPPEL/permappel.db`

Les tables sont initialisées automatiquement avec les structures nécessaires (y compris migrations gérées dans `server/database.js`).

Le script racine `init-database.js` **n’alimente pas** ce fichier : il ne concerne que `server/permappel.db` à des fins de **développement** (voir la section *Script init-database.js (développement uniquement)* plus haut).

### Sauvegarde automatique

La base de données est sauvegardée automatiquement toutes les heures pour protéger vos données contre les pertes accidentelles.

#### Fonctionnement

- **Fréquence** : Une sauvegarde est créée automatiquement toutes les heures
- **Emplacement** : Les sauvegardes sont stockées dans le dossier `backups/` du répertoire de la base de données :
  - **Windows** : `C:\ProgramData\PERMAPPEL\backups\`
  - **macOS** : `/Library/Application Support/PERMAPPEL/backups/`
  - **Linux** : `/opt/PERMAPPEL/backups/`
- **Nommage** : Chaque sauvegarde est nommée `permappel_backup_[timestamp].db` (ex: `permappel_backup_1759481272614.db`)

#### Nettoyage automatique

Pour éviter que l'espace disque ne soit saturé, le système nettoie automatiquement les anciennes sauvegardes :

- **Conservation** : Les sauvegardes sont conservées pendant **30 jours maximum**
- **Limite** : Un maximum de **100 sauvegardes** est conservé (les plus récentes)
- **Suppression** : Les sauvegardes de plus de 30 jours ou au-delà de la limite de 100 sont automatiquement supprimées après chaque nouvelle sauvegarde

**Exemple** :
- Avec une sauvegarde par heure, cela représente environ **24 sauvegardes par jour**
- Le système conserve automatiquement les **100 dernières sauvegardes** (≈ 4 jours) + toutes celles de moins de 30 jours
- Les sauvegardes de plus de 30 jours sont supprimées automatiquement

#### Sauvegarde manuelle

Vous pouvez également créer une sauvegarde manuelle depuis l'interface d'administration :

**Menu : Administration → Base de données → Sauvegarder**

La sauvegarde sera téléchargée directement sur votre ordinateur.

#### Restauration

Pour restaurer une sauvegarde sur la **base réelle** utilisée par l’application :

1. **Arrêter** complètement PERMAPPEL (toutes les fenêtres / instances).
2. Ouvrir le dossier qui contient le fichier de base (exemples) :
   - **Windows** : `C:\ProgramData\PERMAPPEL\`
   - **macOS** : `/Library/Application Support/PERMAPPEL/`
   - **Linux** : `/opt/PERMAPPEL/`
3. **Renommer ou copier** l’ancien `permappel.db` par précaution (ex. `permappel.db.old`).
4. Copier votre fichier de sauvegarde à la place de `permappel.db` (même nom exact).
5. **Redémarrer** l'application.

⚠️ **Attention** : la restauration remplace toute la base actuelle. Ne confondez pas ce fichier avec `server/permappel.db` (fichier local optionnel créé uniquement par `init-database.js` en développement).

## 🔒 Sécurité

### Mesures de sécurité générales

- **Authentification** : les routes sensibles de l’API attendent un jeton (identifiant utilisateur) dans l’en-tête `Authorization` après connexion
- **Validation des données** côté serveur
- **Protection CORS** configurée
- **Hachage** des mots de passe avec bcrypt

### 🔐 Restriction d'accès par adresse IP

PERMAPPEL inclut un système de restriction d'accès par adresse IP pour limiter l'accès à l'application aux postes autorisés uniquement.

#### Fonctionnement

La restriction par IP permet de :
- **Autoriser uniquement certaines adresses IP** à accéder à l'application
- **Définir des plages d'adresses IP** pour autoriser un réseau entier
- **Protéger l'application** contre les accès non autorisés depuis le réseau local

#### Configuration

**Menu : Administration → Gestion de la sécurité**

##### 1. Activer/Désactiver la restriction

- Cochez la case **"Activer la restriction par adresse IP"** pour activer la fonctionnalité
- Par défaut, la restriction est **désactivée** (tous les postes peuvent accéder)

⚠️ **Attention** : Si vous activez la restriction sans avoir configuré d'IPs autorisées, vous risquez de vous bloquer vous-même !

##### 2. Configurer les adresses IP individuelles

Pour autoriser des postes spécifiques :

1. Dans la section **"Adresses IP autorisées"**
2. Saisir l'adresse IP (ex: `192.168.1.100`)
3. Cliquer sur **"Ajouter"**
4. Répéter pour chaque poste à autoriser

**Formats acceptés :**
- IPv4 : `192.168.1.100`
- Localhost IPv6 : `::1` ou `::ffff:127.0.0.1`

##### 3. Configurer les plages d'adresses IP

Pour autoriser un réseau entier (recommandé pour les réseaux locaux) :

1. Dans la section **"Plages d'adresses IP autorisées"**
2. Saisir la **base** de la plage (ex: `10.131.100`)
3. Définir le **début** et la **fin** de la plage (ex: 1 à 254)
4. Cliquer sur **"Ajouter"**

**Exemple :**
- Base : `10.131.100`
- Début : `1`
- Fin : `254`
- Résultat : Autorise toutes les IPs de `10.131.100.1` à `10.131.100.254`

##### 4. Enregistrer la configuration

Après avoir configuré les IPs et plages :
1. Cliquer sur **"Enregistrer la configuration"**
2. La configuration est appliquée **immédiatement** (pas besoin de redémarrer)

#### Configuration par défaut

Lors de la première initialisation, la configuration par défaut inclut :
- **Restriction désactivée** : Tous les postes peuvent accéder
- **IPs par défaut** : `127.0.0.1`, `::1`, `::ffff:127.0.0.1` (localhost)
- **Plage par défaut** : `10.131.100.1` à `10.131.100.254`

#### Précautions importantes

⚠️ **Avant d'activer la restriction :**

1. **Vérifiez votre adresse IP** : Assurez-vous de connaître l'adresse IP du poste depuis lequel vous configurez
2. **Ajoutez votre IP** : Ajoutez votre propre adresse IP dans la liste autorisée AVANT d'activer
3. **Testez avec une plage** : Pour un réseau local, utilisez une plage plutôt que des IPs individuelles
4. **Gardez localhost** : Conservez toujours `127.0.0.1` dans la liste pour l'accès local

⚠️ **Si vous vous êtes bloqué :**

Si vous activez la restriction et que vous ne pouvez plus accéder :
1. Redémarrer le serveur peut réinitialiser temporairement la configuration
2. Modifier directement la base de données (avancé) : Table `config`, clés `security_enabled`, `security_allowedIPs`, `security_allowedRanges`

#### Application de la restriction

La restriction s'applique à :
- ✅ **Toutes les requêtes HTTP** (API, pages web)
- ✅ **Connexions Socket.IO** (communication temps réel)
- ✅ **Tous les utilisateurs** (même administrateurs)

La restriction est vérifiée **avant** l'authentification, donc même avec des identifiants valides, l'accès sera refusé si l'IP n'est pas autorisée.

#### Logs et débogage

Les tentatives d'accès refusées sont enregistrées dans les logs du serveur :
```
🚫 Accès refusé depuis IP non autorisée: 192.168.1.50 - GET /api/students
```

Ces logs permettent d'identifier les tentatives d'accès non autorisées.

### Bornes CDI et adresse IP (séparé de la restriction ci-dessus)

Une **deuxième option**, décrite dans le guide administrateur ([Bornes CDI](#6-bornes-cdi-optionnel)), limite **uniquement** les fonctionnalités de la **page borne CDI** (auto-inscription avec activité). Elle utilise ses propres clés dans la table `config` et une liste d’IP dédiée. Vous pouvez ainsi laisser l’application accessible au réseau de l’établissement tout en réservant la borne à quelques postes fixes.

## 🐛 Dépannage

### Problème de connexion
- Vérifier que le serveur est démarré (port 3001)
- Vérifier les identifiants (admin/admin123 par défaut)
- Utiliser le script `fix-admin.js` pour réinitialiser le compte admin

### Problème d'import CSV
- Vérifier le format du fichier (UTF-8, séparateur virgule)
- Vérifier que les colonnes obligatoires sont remplies
- Consulter les erreurs dans le rapport d'import

### Problème de compilation
- Vérifier que la version dans `package.json` est correcte
- Nettoyer le dossier `dist` avant de rebuilder
- Vérifier que `package-lock.json` est à jour

## 🤝 Contribution

Voir le guide détaillé [CONTRIBUTING.md](CONTRIBUTING.md) (environnement local, base de données, conventions). En résumé :

1. **Fork** le projet
2. **Créer une branche** pour votre fonctionnalité (`git checkout -b feature/nouvelle-fonctionnalite`)
3. **Commit** vos changements (`git commit -am 'Ajout nouvelle fonctionnalité'`)
4. **Push** vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. **Créer une Pull Request**

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 📞 Support

Pour signaler un bug ou demander une fonctionnalité, utilisez les [Issues GitHub](https://github.com/frucot/permappel/issues).

---

**Version actuelle** : voir le champ `version` dans [package.json](package.json) (ex. 1.0.4).  
**Dernière mise à jour de cette documentation** : 2026
