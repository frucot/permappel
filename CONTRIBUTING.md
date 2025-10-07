# Guide de Contribution - PERMAPPEL

## 🚀 Comment contribuer

### 📋 Avant de commencer

1. **Fork** le projet sur GitHub
2. **Clone** votre fork localement
3. **Installer** les dépendances : `npm install`
4. **Créer une branche** pour votre fonctionnalité

### 🔧 Processus de développement

#### 1. Créer une branche
```bash
git checkout -b feature/nom-de-votre-fonctionnalite
```

#### 2. Développer
- Respecter les conventions de code existantes
- Ajouter des commentaires pour les fonctions complexes
- Tester vos modifications

#### 3. Commit
```bash
git add .
git commit -m "Type: Description claire de la modification"
```

**Types de commits :**
- `feat:` Nouvelle fonctionnalité
- `fix:` Correction de bug
- `docs:` Documentation
- `style:` Formatage, style
- `refactor:` Refactorisation
- `test:` Tests
- `chore:` Maintenance

#### 4. Push
```bash
git push origin feature/nom-de-votre-fonctionnalite
```

#### 5. Pull Request
- Créer une Pull Request sur GitHub
- Décrire clairement les modifications
- Attendre la review

### 📝 Standards de code

#### JavaScript
- Utiliser des noms de variables explicites
- Commenter les fonctions complexes
- Respecter l'indentation (2 espaces)

#### CSS
- Utiliser les variables CSS définies
- Organiser les styles par composant
- Utiliser des noms de classes BEM

#### HTML
- Utiliser une structure sémantique
- Ajouter des attributs `aria-` pour l'accessibilité
- Valider le HTML

### 🧪 Tests

Avant de soumettre une PR :
- Tester manuellement les fonctionnalités
- Vérifier que l'application se lance correctement
- Tester sur différents navigateurs (si applicable)

### 📋 Checklist avant soumission

- [ ] Code testé et fonctionnel
- [ ] Pas d'erreurs de linting
- [ ] Documentation mise à jour si nécessaire
- [ ] Commit message descriptif
- [ ] Branche à jour avec `main`

### 🐛 Signaler un bug

Utiliser le template d'issue GitHub :
- Description du problème
- Étapes pour reproduire
- Comportement attendu vs réel
- Captures d'écran si applicable

### 💡 Proposer une fonctionnalité

- Décrire le besoin
- Expliquer la solution proposée
- Discuter de l'implémentation
- Considérer les impacts sur l'existant

Merci de contribuer à PERMAPPEL ! 🎉
