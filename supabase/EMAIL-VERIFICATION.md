# Configuration de la vérification par email

## Étape 1 : Configuration dans Supabase Dashboard

### 1.1 Activer la confirmation par email
1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet **PronoHub**
3. **Authentication** → **Providers** → **Email**
4. ✅ Cochez **"Confirm email"**
5. Cliquez sur **Save**

### 1.2 Configurer les URLs de redirection
1. **Authentication** → **URL Configuration**
2. **Site URL** : `http://localhost:3000`
3. **Redirect URLs** : Ajoutez les URLs suivantes (une par ligne) :
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/**
   ```
4. Cliquez sur **Save**

### 1.3 Personnaliser l'email (optionnel)
1. **Authentication** → **Email Templates** → **Confirm signup**
2. Vous pouvez personnaliser :
   - Le sujet de l'email
   - Le contenu HTML
   - Le bouton de confirmation

**Variables disponibles :**
- `{{ .ConfirmationURL }}` : Lien de confirmation
- `{{ .Token }}` : Token de confirmation (pour code manuel)
- `{{ .SiteURL }}` : URL de votre site

## Étape 2 : Exécuter le trigger SQL

1. Allez dans **SQL Editor**
2. Cliquez sur **New query**
3. Copiez le contenu de `trigger-create-profile.sql`
4. Exécutez le script (bouton Run ou Ctrl+Enter)

Ce trigger créera automatiquement le profil utilisateur dans la table `profiles` après la confirmation de l'email.

## Étape 3 : Configuration pour la production

Quand vous déployez en production (ex: Vercel), ajoutez dans Supabase :

**Site URL** : `https://votre-domaine.com`

**Redirect URLs** :
```
https://votre-domaine.com/auth/callback
https://votre-domaine.com/**
```

## Flux d'inscription

1. **Utilisateur remplit le formulaire** `/auth/signup`
2. **Email envoyé** par Supabase avec un lien de confirmation
3. **Utilisateur clique sur le lien** dans l'email
4. **Redirection vers** `/auth/callback?code=...`
5. **Échange du code** contre une session
6. **Trigger exécuté** : création du profil dans `profiles`
7. **Redirection vers** `/dashboard`

## Test en développement

⚠️ **Important** : En développement, Supabase peut envoyer des emails réels ou afficher un lien de confirmation dans les logs.

### Option 1 : Emails réels (recommandé pour tester)
- Utilisez votre vraie adresse email
- Vérifiez votre boîte de réception
- Cliquez sur le lien

### Option 2 : Désactiver temporairement
Pour tester sans emails :
1. Dans Supabase : **Authentication** → **Providers** → **Email**
2. ❌ Décochez **"Confirm email"**
3. N'oubliez pas de le réactiver après !

## Résolution de problèmes

### L'email n'arrive pas
- Vérifiez le dossier spam
- Vérifiez les logs Supabase : **Logs** → **Auth Logs**
- En développement, le lien peut apparaître dans les logs

### Erreur "Email not confirmed"
- L'utilisateur doit cliquer sur le lien dans l'email
- Vérifiez que le trigger SQL a bien été exécuté

### Le profil n'est pas créé
- Vérifiez que le trigger `on_auth_user_created` existe
- Allez dans **Database** → **Functions** pour voir les fonctions
- Vérifiez les logs d'erreur dans **Logs** → **Database**
