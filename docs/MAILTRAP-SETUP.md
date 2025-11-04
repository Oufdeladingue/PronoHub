# Configuration Mailtrap pour tests d'emails (Sans Docker)

## Solution alternative sans virtualisation

Si vous ne pouvez pas activer la virtualisation ou si Docker ne fonctionne pas, **Mailtrap** est la solution idéale.

## Avantages de Mailtrap

- ✅ **Aucune installation locale** requise
- ✅ **Pas besoin de Docker** ou virtualisation
- ✅ **Interface web élégante** pour voir les emails
- ✅ **Gratuit** : 100 emails/mois + 1 inbox
- ✅ **Fonctionne immédiatement** avec Supabase cloud
- ✅ **Même sur les 2 PC** : Même configuration partagée

## Installation (5 minutes)

### Étape 1 : Créer un compte Mailtrap

1. Allez sur : https://mailtrap.io
2. Cliquez sur "Sign Up" (Inscription gratuite)
3. Créez un compte avec votre email ou Google

### Étape 2 : Obtenir les identifiants SMTP

1. Une fois connecté, cliquez sur "Email Testing" dans le menu
2. Vous verrez une inbox par défaut "My Inbox"
3. Cliquez dessus
4. Dans l'onglet "SMTP Settings", sélectionnez "Nodemailer" ou "Generic SMTP"
5. Notez les informations affichées :

```
Host: sandbox.smtp.mailtrap.io
Port: 2525 (ou 25, 465, 587)
Username: [votre_username]
Password: [votre_password]
```

### Étape 3 : Configurer Supabase Cloud

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet **PronoHub**
3. Cliquez sur **⚙️ Project Settings** (en bas à gauche)
4. Dans le menu, cliquez sur **Auth**
5. Scrollez jusqu'à **SMTP Settings**
6. Activez "Enable Custom SMTP"

**Remplissez avec vos credentials Mailtrap :**

| Paramètre | Valeur |
|-----------|--------|
| **Enable Custom SMTP** | ✅ Activé |
| **Sender name** | `PronoHub` |
| **Sender email** | `noreply@pronohub.app` |
| **Host** | `sandbox.smtp.mailtrap.io` |
| **Port Number** | `2525` |
| **Username** | `<votre_username_mailtrap>` |
| **Password** | `<votre_password_mailtrap>` |

7. Cliquez sur **Save** en bas

### Étape 4 : Tester

1. Lancez votre application : `npm run dev`
2. Allez sur http://localhost:3000/auth/signup
3. Inscrivez-vous avec un email quelconque
4. Allez sur https://mailtrap.io dans votre navigateur
5. Ouvrez votre inbox
6. **L'email avec le code OTP devrait apparaître !**

## Utilisation quotidienne

### Voir les emails reçus

1. Allez sur https://mailtrap.io
2. Cliquez sur votre inbox
3. Tous les emails envoyés par Supabase apparaissent ici

### Visualiser le code OTP

- Cliquez sur l'email dans la liste
- Le code à 6 chiffres est affiché dans le contenu
- Vous pouvez voir le HTML et le texte brut

### Supprimer les emails de test

- Bouton "Clear Inbox" pour tout supprimer
- Ou supprimez individuellement

## Avantages vs Supabase Local

| Aspect | Supabase Local + Inbucket | Mailtrap |
|--------|---------------------------|----------|
| **Installation** | Docker + Virtualisation | Aucune |
| **Configuration PC** | BIOS (virtualisation) | Rien |
| **Temps de setup** | 30 min + redémarrage | 5 minutes |
| **Fonctionne sur 2 PC** | Config sur chaque PC | Même config partout |
| **Base de données locale** | Oui | Non (utilise Supabase cloud) |
| **Emails de test** | Localhost:54324 | mailtrap.io |
| **Gratuit** | Oui | Oui (100 emails/mois) |

## Configuration pour les 2 PC

**Avantage majeur** : Vous configurez Mailtrap **une seule fois** dans Supabase cloud, et **ça fonctionne sur vos 2 PC** sans aucune configuration supplémentaire !

### Sur PC 1 et PC 2

```bash
# Aucune configuration locale nécessaire !
# Utilisez simplement votre .env.local existant
npm run dev
```

Les emails iront directement dans Mailtrap, accessible depuis n'importe où.

## Différences avec la production

En production, vous remplacerez simplement les credentials Mailtrap par un vrai service SMTP :

- **Resend** : 3000 emails/mois gratuit
- **SendGrid** : 100 emails/jour gratuit
- **AWS SES** : 62000 emails/mois gratuit (première année)

Il suffit de changer les paramètres SMTP dans Supabase Dashboard, **aucun changement de code** nécessaire.

## Templates d'email

Pour personnaliser vos emails dans Supabase :

1. Supabase Dashboard > Authentication > Email Templates
2. Modifiez les templates :
   - **Magic Link** : Pour les codes OTP
   - **Confirm Signup** : Email de confirmation
   - **Reset Password** : Réinitialisation de mot de passe

### Exemple de template OTP

```html
<h2>Bienvenue sur PronoHub !</h2>
<p>Votre code de vérification est :</p>
<h1 style="
  font-size: 32px;
  letter-spacing: 5px;
  text-align: center;
  font-family: monospace;
  background: #f3f4f6;
  padding: 20px;
  border-radius: 8px;
  color: #1f2937;
">{{ .Token }}</h1>
<p style="color: #6b7280;">Ce code expire dans 1 heure.</p>
<p style="color: #6b7280;">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
```

## Limites du plan gratuit

- **100 emails/mois**
- **1 inbox**
- **Emails supprimés après 1 mois**

Pour le développement, c'est largement suffisant. Si vous dépassez, vous pouvez créer un nouveau compte ou passer au plan payant (10$/mois pour 1000 emails).

## Troubleshooting

### Problème : Les emails n'arrivent pas

**Vérifications :**

1. ✅ "Enable Custom SMTP" est bien activé dans Supabase ?
2. ✅ Les credentials Mailtrap sont corrects ?
3. ✅ Vous utilisez le bon port (2525) ?
4. ✅ Vous avez sauvegardé les paramètres dans Supabase ?

### Problème : "SMTP Authentication failed"

**Cause** : Username ou Password incorrect

**Solution** : Recopiez exactement les credentials depuis Mailtrap (attention aux espaces)

### Problème : "Connection timeout"

**Cause** : Port bloqué par un firewall

**Solution** : Essayez un autre port (587 ou 465 au lieu de 2525)

## Passer à la production

Quand vous déployez votre application :

1. Créez un compte sur un service SMTP de production (Resend recommandé)
2. Dans Supabase Dashboard > Project Settings > Auth > SMTP Settings
3. Remplacez les credentials Mailtrap par ceux de Resend
4. **C'est tout !** Aucun changement de code

### Exemple avec Resend (production)

| Paramètre | Valeur |
|-----------|--------|
| **Host** | `smtp.resend.com` |
| **Port** | `587` |
| **Username** | `resend` |
| **Password** | `<votre_clé_API_resend>` |
| **Sender email** | `noreply@votredomaine.com` |

## Résumé

✅ **Pas besoin de Docker ou virtualisation**
✅ **Configuration en 5 minutes**
✅ **Fonctionne sur 2 PC sans config supplémentaire**
✅ **Interface élégante pour voir les emails**
✅ **Gratuit pour le développement**
✅ **Facile à remplacer pour la production**

---

**Cette solution est parfaite si vous ne pouvez pas activer la virtualisation dans votre BIOS !**
