# Workflow Git pour travailler sur 2 ordinateurs

## Configuration initiale sur le 2ème ordinateur

1. Installer Node.js (https://nodejs.org/)
2. Installer Git (https://git-scm.com/)
3. Configurer Git :
```bash
git config --global user.email "kochroman6@gmail.com"
git config --global user.name "Oufdeladingue"
```

4. Cloner le projet :
```bash
cd c:\projets
git clone https://github.com/Oufdeladingue/PronoHub.git
cd PronoHub
```

5. Installer les dépendances :
```bash
npm install
```

6. Créer le fichier `.env.local` (copier depuis `.env.example`)
```bash
cp .env.example .env.local
```

7. Lancer le projet :
```bash
npm run dev
```

## Workflow quotidien

### Avant de commencer à travailler (PC 1 ou PC 2)
```bash
git pull
```
Cette commande récupère les dernières modifications depuis GitHub.

### Pendant le travail
Travaillez normalement sur vos fichiers.

### À la fin de votre session
```bash
# Voir les fichiers modifiés
git status

# Ajouter tous les fichiers modifiés
git add .

# Créer un commit avec un message descriptif
git commit -m "Description de vos modifications"

# Envoyer sur GitHub
git push
```

## Résolution de conflits

Si vous obtenez une erreur lors du `git pull` car vous avez oublié de push depuis l'autre PC :

```bash
# Sauvegarder vos modifications locales
git stash

# Récupérer les modifications distantes
git pull

# Réappliquer vos modifications
git stash pop

# Résoudre les conflits si nécessaire, puis :
git add .
git commit -m "Résolution des conflits"
git push
```

## Bonnes pratiques

1. **Toujours pull avant de commencer** à travailler
2. **Toujours push à la fin** de votre session
3. **Commit régulièrement** avec des messages clairs
4. **Ne jamais commit** le dossier `node_modules` (déjà dans .gitignore)
5. **Ne jamais commit** les fichiers `.env.local` (déjà dans .gitignore)

## Commandes utiles

```bash
# Voir l'historique des commits
git log --oneline

# Voir les modifications non commitées
git diff

# Annuler les modifications d'un fichier
git checkout -- nom-du-fichier

# Créer une nouvelle branche
git checkout -b nom-de-la-branche

# Changer de branche
git checkout nom-de-la-branche
```

## En cas de problème

Si vous êtes bloqué, vous pouvez toujours :
1. Sauvegarder vos fichiers modifiés ailleurs
2. Supprimer le dossier du projet
3. Re-cloner depuis GitHub : `git clone https://github.com/Oufdeladingue/PronoHub.git`
4. Réappliquer vos modifications
