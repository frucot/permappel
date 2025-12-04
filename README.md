# PERMAPPEL - Système de Gestion des Appels

## 📋 Description

PERMAPPEL est une application de gestion des appels scolaires développée avec Electron et Node.js. Elle permet de créer, gérer et suivre les feuilles d'appel en temps réel avec synchronisation multi-utilisateurs.

## ✨ Fonctionnalités principales

### 🎯 Gestion des Appels
- **Création d'appels** avec sélection de créneaux, classes et groupes
- **Appels récurrents** (hebdomadaire, bi-hebdomadaire)
- **Feuilles d'appel en temps réel** avec synchronisation Socket.IO
- **Synchronisation automatique** des élèves (ajout/suppression selon critères)
- **Mode lecture seule** pour les appels passés
- **Export PDF** des feuilles d'appel

### 👥 Gestion des Utilisateurs
- **Authentification** sécurisée avec JWT
- **Gestion des rôles** (administrateur, utilisateur)
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
- **Authentification**: JWT
- **Export PDF**: jsPDF

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

### Initialisation de la base de données

```bash
# Créer la base de données avec les données par défaut
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
# Exemple : "version": "1.0.2"
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
Génère : `dist/PERMAPPEL Setup 1.0.2.exe`

**Option B : Version portable uniquement**
```bash
npm run build-portable
```
Génère : `dist/PERMAPPEL-1.0.2-Portable.exe`

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

**Rôles disponibles :**
- **Admin** : Accès complet à toutes les fonctionnalités
- **Professeur** : Accès aux appels et élèves (pas d'administration)

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
- **Ajouter des groupes/classes** : Bouton "Ajouter des groupes" ou "Ajouter des classes"
- **Synchroniser les élèves** : Bouton "Synchroniser les élèves" pour ajouter/supprimer automatiquement selon les critères
- **Vérifier l'appel** : Vérifier qu'aucun élève n'a été oublié
- **Export PDF** : Générer un PDF de la feuille d'appel

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
│   │   └── ...
│   ├── styles.css         # Styles CSS
│   ├── index.html         # Page principale
│   └── attendance.html    # Page feuille d'appel
├── server/                # Serveur backend
│   ├── routes/           # Routes API
│   │   ├── auth.js       # Authentification
│   │   ├── attendance.js # Gestion des appels
│   │   ├── students.js   # Gestion des élèves
│   │   └── ...
│   ├── database.js       # Gestion base de données
│   ├── server.js         # Serveur principal
│   └── permappel.db      # Base de données SQLite
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

La base de données SQLite est créée automatiquement au premier démarrage dans :
- **Windows** : `C:\ProgramData\PERMAPPEL\permappel.db`
- **macOS** : `/Library/Application Support/PERMAPPEL/permappel.db`
- **Linux** : `/opt/PERMAPPEL/permappel.db`

Les tables sont initialisées automatiquement avec les structures nécessaires.

### Sauvegarde automatique

La base de données est sauvegardée automatiquement toutes les heures dans :
- `server/backups/permappel_backup_[timestamp].db`

## 🔒 Sécurité

- **Authentification JWT** pour toutes les requêtes
- **Validation des données** côté serveur
- **Protection CORS** configurée
- **Chiffrement** des mots de passe avec bcrypt
- **Sessions** avec timeout automatique

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

**Version actuelle** : 1.0.2  
**Dernière mise à jour** : 2025
