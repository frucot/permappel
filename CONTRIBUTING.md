# Guide de contribution — PERMAPPEL

Merci de contribuer au projet. Ce document complète le [README.md](README.md) (usage fonctionnel) et le [DEPLOYMENT.md](DEPLOYMENT.md) (mise en production et chemins de données).

## Environnement de développement local

1. **Cloner** le dépôt et installer les dépendances à la racine : `npm install` (installe aussi les dépendances du dossier `server/` via `postinstall`).
2. **Deux terminaux** sont en pratique nécessaires :
   - Terminal 1 : `cd server && npm start` — démarre l’API Express (port **3001** par défaut).
   - Terminal 2 : à la racine du dépôt, `npm run dev` — lance Electron en mode développement avec les DevTools.
3. **Base de données** : au premier lancement du serveur, la base SQLite **réelle** est créée dans le répertoire partagé système (voir README / DEPLOYMENT), pas dans `server/permappel.db`. Le script racine `init-database.js` (`npm run init-db`) ne sert qu’à générer un fichier **local** `server/permappel.db` pour tests ou inspection SQL ; alignez-le sur le schéma si vous modifiez les tables.

## Schéma SQL et migrations

- **Source de vérité** : [server/database.js](server/database.js) (`setupDatabase`, `insertDefaultData`, `ensureCdiSchema`, etc.). Toute nouvelle table ou colonne doit y être reflétée pour les bases existantes et neuves.
- Si vous maintenez [init-database.js](init-database.js), gardez-le **cohérent** avec `database.js` pour éviter la dérive entre environnements.

## Authentification (pour éviter les malentendus)

La documentation utilisateur parle d’un **jeton** après connexion : le serveur renvoie en pratique l’**identifiant utilisateur** sous forme de chaîne, stocké côté client et renvoyé dans `Authorization: Bearer …`. Ce n’est **pas** un JWT signé. Toute évolution vers de vrais JWT devrait mettre à jour à la fois le code et la doc.

## Standards de code

- **JavaScript** : noms explicites, indentation cohérente avec le fichier modifié (souvent 2 ou 4 espaces selon les modules), commentaires ciblés pour la logique non triviale.
- **CSS** : suivre les **conventions déjà présentes** dans [public/styles.css](public/styles.css) et l’interface existante ; le projet n’impose pas strictement BEM partout.
- **HTML** : structure sémantique ; attributs d’accessibilité (`aria-*`) lorsque c’est pertinent.

## Tests

Il n’y a **pas de suite de tests automatisés** documentée dans ce dépôt. Avant une pull request, prévoir au minimum des **tests manuels** :

- Connexion / déconnexion (admin et, si touché, compte **élève** / borne CDI).
- Création d’une feuille d’appel et mise à jour des présences.
- Export PDF (jsPDF ; connexion ou bundle local selon l’environnement).
- Si vous modifiez le CDI ou la sécurité IP : page `cdi-kiosk.html` et réglages administration associés.

## Processus Git

### Avant de commencer

1. **Fork** du dépôt (si contribution externe) ou branche depuis `main`.
2. **Branche dédiée** : `git checkout -b feature/nom-court`.

### Commits

Préfixer le message par un type lisible, par exemple :

- `feat:` nouvelle fonctionnalité  
- `fix:` correction de bug  
- `docs:` documentation  
- `style:` formatage  
- `refactor:` refactorisation  
- `test:` tests  
- `chore:` maintenance  

### Pull Request

1. `git push origin feature/nom-court`
2. Ouvrir une PR avec une description claire (contexte, fichiers impactés, comment tester).
3. Mettre à jour **README** / **DEPLOYMENT** / **CONTRIBUTING** si le comportement utilisateur ou le déploiement change.

## Checklist avant soumission

- [ ] Changements testés manuellement (scénarios ci-dessus selon la portée).
- [ ] Pas d’erreurs évidentes de lint dans les fichiers modifiés.
- [ ] Documentation mise à jour si le comportement ou les chemins changent.
- [ ] Messages de commit explicites.
- [ ] Branche à jour avec la branche principale du dépôt cible.

## Signaler un bug ou proposer une évolution

- **Bug** : description, étapes pour reproduire, comportement attendu vs observé, captures si utile.
- **Fonctionnalité** : besoin utilisateur, proposition de solution, impacts sur l’existant.

Merci de contribuer à PERMAPPEL.
