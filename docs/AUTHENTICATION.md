# Documentation - Système d'Authentification

## Vue d'ensemble

Le système d'authentification de PronoHub utilise Supabase Auth avec un flux d'inscription en 3 étapes :

1. **Saisie Email/Password** : L'utilisateur entre ses informations
2. **Vérification OTP** : Réception d'un code à 6 chiffres par email
3. **Choix du pseudo** : Sélection du nom d'utilisateur avec prévisualisation sur maillot

## Flux d'Inscription

### Étape 1 : Page d'inscription (`/auth/signup`)

**Fichier** : `app/auth/signup/page.tsx`

**Fonctionnalités** :
- Validation du mot de passe en temps réel avec indicateur de force
- Critères de sécurité :
  - Minimum 8 caractères
  - Au moins une majuscule
  - Au moins une minuscule
  - Au moins un chiffre
- Confirmation du mot de passe avec vérification visuelle
- Ajustement automatique de la taille du titre pour s'adapter à la largeur
- Option de connexion via Google OAuth

**Flux technique** :
```typescript
// 1. Stockage temporaire des identifiants
sessionStorage.setItem('pendingEmail', email)
sessionStorage.setItem('pendingPassword', password)

// 2. Envoi OTP sans créer le compte
await supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: false }
})

// 3. Redirection vers vérification
router.push('/auth/verify-code')
```

**Important** : Le compte n'est PAS créé à cette étape. Seul un code OTP est envoyé.

### Étape 2 : Vérification OTP (`/auth/verify-code`)

**Fichier** : `app/auth/verify-code/page.tsx`

**Fonctionnalités** :
- 6 champs numériques pour le code
- Auto-focus et navigation automatique entre champs
- Support du copier-coller de code complet
- Navigation au clavier (Backspace revient au champ précédent)
- Bouton "Renvoyer le code" avec délai de sécurité
- Validation du format (exactement 6 chiffres)

**Flux technique** :
```typescript
// 1. Vérification du code OTP
await supabase.auth.verifyOtp({
  email,
  token: verificationCode,
  type: 'email'
})

// 2. Création du compte APRÈS validation du code
await supabase.auth.signUp({
  email,
  password: pendingPassword
})

// 3. Redirection vers choix du pseudo
router.push('/auth/choose-username')
```

**Important** : Le compte utilisateur est créé uniquement après validation réussie du code OTP.

### Étape 3 : Choix du pseudo (`/auth/choose-username`)

**Fichier** : `app/auth/choose-username/page.tsx`

**Fonctionnalités** :
- Saisie limitée à 12 caractères
- Vérification en temps réel de la disponibilité (avec debounce de 500ms)
- Prévisualisation du pseudo sur un maillot
- Ajustement automatique de l'espacement des lettres selon la longueur
- Validation :
  - Minimum 3 caractères
  - Pseudo unique (vérification en base)

**Flux technique** :
```typescript
// 1. Vérification de disponibilité
const { data } = await supabase
  .from('profiles')
  .select('username')
  .ilike('username', username)
  .limit(1)

// 2. Création du profil
await supabase
  .from('profiles')
  .upsert({
    id: user.id,
    username: username,
    updated_at: new Date().toISOString()
  })

// 3. Redirection vers dashboard
router.push('/')
```

## OAuth Google

**Fichier** : `app/auth/signup/page.tsx`

**Configuration** :
```typescript
const handleOAuthSignIn = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
}
```

**Callback** : `app/auth/callback/route.ts`

Le callback exchange le code OAuth contre une session et redirige vers la page d'accueil.

## Configuration Supabase Requise

### 1. Email Templates

Dans **Authentication > Email Templates > Magic Link** :

```html
<h2>Code de vérification PronoHub</h2>
<p>Votre code de vérification est :</p>
<h1 style="font-size: 32px; letter-spacing: 5px; text-align: center; font-family: monospace;">
  {{ .Token }}
</h1>
<p>Ce code expire dans 1 heure.</p>
```

### 2. Providers

Dans **Authentication > Providers** :

- **Email** : Activé avec "Enable Email OTP" ✓
- **Google OAuth** : Configurer avec :
  - Client ID de Google Cloud Console
  - Client Secret de Google Cloud Console
  - Redirect URL : `https://votre-projet.supabase.co/auth/v1/callback`

### 3. Settings

Dans **Authentication > Settings** :

- **User Signups** : Enabled ✓
- **Confirm email** : Enabled ✓ (pour l'OTP)

## Schéma de Base de Données

### Table `profiles`

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX idx_profiles_username ON profiles(username);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);
```

## Sécurité

### Validation Côté Client

- **Mot de passe** :
  - Longueur minimale : 8 caractères
  - Complexité : majuscule + minuscule + chiffre
  - Indicateur visuel de force (Faible/Moyen/Bon/Fort)

- **Code OTP** :
  - Format strict : exactement 6 chiffres
  - Pas de caractères spéciaux acceptés

- **Username** :
  - Longueur : 3-12 caractères
  - Vérification d'unicité en temps réel

### Validation Côté Serveur

- **Supabase Auth** gère :
  - Format et complexité du mot de passe
  - Expiration des codes OTP (1 heure)
  - Rate limiting sur envoi d'OTP
  - Détection de tentatives multiples

### Stockage Temporaire

Les identifiants sont stockés temporairement dans `sessionStorage` :
- `pendingEmail` : Email saisi
- `pendingPassword` : Mot de passe (nettoyé après création du compte)

**Important** : Ces données sont automatiquement supprimées :
- Après création réussie du compte
- À la fermeture de l'onglet/navigateur
- En cas d'erreur nécessitant un redémarrage du processus

## Gestion des Erreurs

### Erreurs Communes

1. **Code OTP invalide ou expiré**
   - Message : "Code invalide ou expiré. Veuillez réessayer."
   - Solution : Renvoyer un nouveau code

2. **Rate limiting**
   - Message : "For security purposes, you can only request this after XX seconds."
   - Solution : Attendre le délai indiqué

3. **Username déjà pris**
   - Message : "Ce nom d'utilisateur est déjà pris"
   - Solution : Choisir un autre pseudo

4. **Session expirée**
   - Message : "Session expirée. Veuillez recommencer l'inscription."
   - Solution : Retourner à la page d'inscription

## Assets Graphiques

### Icônes

- `/images/icons/eye-open.svg` : Afficher le mot de passe (20x20px)
- `/images/icons/eye-closed.svg` : Masquer le mot de passe (20x20px)

### Logos et Images

- `/images/logo.svg` : Logo principal PronoHub
- `/images/jersey-auth.png` : Maillot pour prévisualisation du pseudo

## Améliorations Futures

- [ ] Authentification à deux facteurs (2FA)
- [ ] Connexion via Facebook/Apple
- [ ] Récupération de mot de passe oublié
- [ ] Changement d'email avec vérification OTP
- [ ] Historique des connexions
- [ ] Révocation de sessions actives
