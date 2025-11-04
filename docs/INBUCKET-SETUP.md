# Configuration Inbucket pour tests d'emails en local

## Qu'est-ce qu'Inbucket ?

Inbucket est un serveur SMTP de test qui capture tous les emails envoyés et les affiche dans une interface web. Parfait pour tester les emails d'inscription/vérification en développement local.

## Installation sur Windows (sans Docker)

### Option 1 : Téléchargement direct (Recommandé)

1. **Télécharger Inbucket**
   - Aller sur : https://github.com/inbucket/inbucket/releases
   - Télécharger la dernière version : `inbucket_x.x.x_windows_amd64.zip`
   - Extraire le fichier ZIP dans `C:\projets\inbucket\`

2. **Lancer Inbucket**
   - Ouvrir PowerShell ou CMD
   - Aller dans le dossier :
   ```bash
   cd C:\projets\inbucket
   ```
   - Lancer l'exécutable :
   ```bash
   .\inbucket.exe
   ```

3. **Vérifier que c'est actif**
   - Interface web : http://localhost:9000
   - SMTP Port : 2500

### Option 2 : Via NPM (Alternative)

Si vous préférez une solution NPM :

```bash
npm install -g inbucket
inbucket
```

## Configuration avec Supabase

### Étape 1 : Accéder aux paramètres SMTP Supabase

1. Connectez-vous sur https://supabase.com
2. Sélectionnez votre projet **PronoHub**
3. Allez dans **Project Settings** (icône engrenage en bas à gauche)
4. Cliquez sur **Auth** dans le menu latéral
5. Scrollez jusqu'à la section **SMTP Settings**

### Étape 2 : Configurer le serveur SMTP

Activez "Enable Custom SMTP" et remplissez :

| Paramètre | Valeur |
|-----------|--------|
| **Host** | `localhost` ou `127.0.0.1` |
| **Port** | `2500` |
| **Username** | (laisser vide) |
| **Password** | (laisser vide) |
| **Sender email** | `noreply@pronohub.local` |
| **Sender name** | `PronoHub` |

### Étape 3 : Configurer les templates d'email

Dans **Authentication > Email Templates** :

#### Template "Confirm signup" (Magic Link)

```html
<h2>Bienvenue sur PronoHub !</h2>
<p>Votre code de vérification est :</p>
<h1 style="font-size: 32px; letter-spacing: 5px; text-align: center; font-family: monospace; background: #f3f4f6; padding: 20px; border-radius: 8px;">{{ .Token }}</h1>
<p>Ce code expire dans 1 heure.</p>
<p>Si vous n'avez pas demandé ce code, ignorez cet email.</p>
```

#### Variables disponibles dans les templates

- `{{ .Token }}` : Code OTP ou token de vérification
- `{{ .Email }}` : Email de l'utilisateur
- `{{ .SiteURL }}` : URL de votre site
- `{{ .ConfirmationURL }}` : URL de confirmation (si utilisée)

### Étape 4 : Sauvegarder et tester

1. Cliquez sur **Save** en bas de la page
2. Attendez quelques secondes que Supabase applique les changements

## Utilisation pour les tests

### Lancer Inbucket

Avant de tester, assurez-vous qu'Inbucket est lancé :

```bash
cd C:\projets\inbucket
.\inbucket.exe
```

Vous devriez voir :
```
Inbucket is running
Web interface: http://localhost:9000
SMTP listening on: 0.0.0.0:2500
```

### Tester l'inscription

1. Lancez votre application PronoHub :
   ```bash
   npm run dev
   ```

2. Allez sur http://localhost:3000/auth/signup

3. Inscrivez-vous avec un email (peu importe lequel, ex: `test@example.com`)

4. Ouvrez l'interface Inbucket : http://localhost:9000

5. Vous devriez voir l'email avec le code OTP dans la liste

6. Cliquez sur l'email pour voir le contenu et copier le code

### Interface Inbucket

- **Liste des emails** : Tous les emails envoyés apparaissent sur la page d'accueil
- **Recherche** : Cherchez par destinataire ou sujet
- **Visualisation** : Cliquez sur un email pour voir le HTML/texte
- **Suppression** : Les emails persistent jusqu'à suppression manuelle

## Troubleshooting

### Problème : Inbucket ne démarre pas

**Erreur** : `bind: address already in use`

**Solution** : Un autre programme utilise le port 2500 ou 9000

Vérifiez les ports utilisés :
```bash
netstat -ano | findstr :2500
netstat -ano | findstr :9000
```

Tuez le processus si nécessaire :
```bash
taskkill /PID <numero_du_pid> /F
```

### Problème : Les emails n'arrivent pas dans Inbucket

**Vérifications** :

1. Inbucket est-il bien lancé ?
   - Testez http://localhost:9000

2. La configuration SMTP Supabase est-elle correcte ?
   - Host : `localhost`
   - Port : `2500`

3. Supabase est-il configuré pour utiliser le SMTP custom ?
   - "Enable Custom SMTP" doit être activé

### Problème : "Connection refused" dans les logs Supabase

**Cause** : Supabase ne peut pas se connecter à `localhost` car il tourne sur leurs serveurs

**Solution** : Pour un vrai test local avec SMTP local, vous devez utiliser :
- **Supabase CLI local** (`supabase start`) qui inclut Inbucket
- OU utiliser un service SMTP accessible depuis internet (Mailtrap, SendGrid test)

## Alternative : Supabase CLI Local (Recommandé pour dev)

Si vous voulez un environnement complètement local :

```bash
# Installer Supabase CLI
npm install -g supabase

# Initialiser Supabase dans le projet
supabase init

# Démarrer l'instance locale (inclut Inbucket)
supabase start
```

Avec Supabase local :
- Interface Inbucket : http://localhost:54324
- Supabase Studio : http://localhost:54323
- API locale : http://localhost:54321

## Configuration pour la production

Pour la production, vous devrez configurer un vrai serveur SMTP :

- **SendGrid** (100 emails/jour gratuit)
- **Mailgun** (5000 emails/mois gratuit)
- **AWS SES** (62000 emails/mois gratuit première année)
- **Resend** (3000 emails/mois gratuit)

Ne jamais utiliser Inbucket en production !

## Scripts utiles

### Lancer Inbucket automatiquement (Windows)

Créez un fichier `start-inbucket.bat` :

```batch
@echo off
cd C:\projets\inbucket
start "" inbucket.exe
echo Inbucket démarré ! Interface : http://localhost:9000
timeout 3
```

Double-cliquez dessus pour lancer Inbucket rapidement.

## Résumé

✅ **Inbucket local** : Pour tests rapides sans configuration cloud
✅ **Supabase SMTP custom** : Pointant vers Inbucket (localhost:2500)
✅ **Interface web** : http://localhost:9000 pour voir les emails
⚠️ **Attention** : Fonctionne uniquement si Supabase tourne aussi en local

Pour un setup production-ready, utilisez Supabase CLI local (`supabase start`) ou un vrai service SMTP.
