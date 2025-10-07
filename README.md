# PERMAPPEL - Système de Gestion des Appels

## 📋 Description

PERMAPPEL est une application de gestion des appels scolaires développée avec Electron et Node.js. Elle permet de créer, gérer et suivre les feuilles d'appel en temps réel avec synchronisation multi-utilisateurs.

## ✨ Fonctionnalités

### 🎯 Gestion des Appels
- **Création d'appels** avec sélection de créneaux, classes et groupes
- **Appels récurrents** (hebdomadaire, bi-hebdomadaire)
- **Feuilles d'appel en temps réel** avec synchronisation Socket.IO
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

# Installer les dépendances du serveur
cd server
npm install
cd ..
```

### Configuration

1. **Copier le fichier de configuration** :
```bash
cp config.example.js config.js
```

2. **Modifier la configuration** selon vos besoins dans `config.js`

## 🚀 Démarrage

### Mode développement

```bash
# Démarrer le serveur
cd server
npm start

# Dans un autre terminal, démarrer l'application Electron
npm run dev
```

### Mode production

```bash
# Construire l'application
npm run build

# Lancer l'application
npm start
```

## 📁 Structure du Projet

```
PERMAPPEL_BUILD_2/
├── public/                 # Interface utilisateur
│   ├── js/                # Scripts JavaScript
│   ├── styles.css         # Styles CSS
│   └── index.html         # Page principale
├── server/                # Serveur backend
│   ├── routes/           # Routes API
│   ├── database.js       # Gestion base de données
│   └── server.js         # Serveur principal
├── main.js               # Processus principal Electron
├── preload.js           # Script de préchargement
└── package.json         # Configuration npm
```

## 🔧 Configuration

### Variables d'environnement

Créez un fichier `.env` dans le répertoire `server/` :

```env
PORT=3001
JWT_SECRET=votre_secret_jwt
DB_PATH=./permappel.db
```

### Base de données

La base de données SQLite est créée automatiquement au premier démarrage. Les tables sont initialisées avec les structures nécessaires.

## 📖 Utilisation

### Première utilisation

1. **Lancer l'application**
2. **Créer un compte administrateur** via l'interface
3. **Importer les données élèves** (CSV)
4. **Configurer les créneaux** et groupes
5. **Créer votre première feuille d'appel**

### Gestion des appels

1. **Créer un appel** : Sélectionner date, créneau, classes/groupes
2. **Ouvrir la feuille d'appel** : Interface temps réel
3. **Marquer les présences** : Boutons de statut
4. **Synchronisation** : Automatique entre utilisateurs
5. **Exporter** : PDF de la feuille d'appel

## 🔒 Sécurité

- **Authentification JWT** pour toutes les requêtes
- **Validation des données** côté serveur
- **Protection CORS** configurée
- **Chiffrement** des mots de passe

## 🤝 Contribution

1. **Fork** le projet
2. **Créer une branche** pour votre fonctionnalité (`git checkout -b feature/nouvelle-fonctionnalite`)
3. **Commit** vos changements (`git commit -am 'Ajout nouvelle fonctionnalité'`)
4. **Push** vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. **Créer une Pull Request**

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🐛 Support

Pour signaler un bug ou demander une fonctionnalité, utilisez les [Issues GitHub](https://github.com/votre-username/PERMAPPEL/issues).

## 📞 Contact

- **Email** : votre-email@exemple.com
- **GitHub** : [@votre-username](https://github.com/votre-username)

---

**Version actuelle** : 1.0.0  
**Dernière mise à jour** : $(date)