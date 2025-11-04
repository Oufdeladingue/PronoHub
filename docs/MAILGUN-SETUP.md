# Configuration Mailgun pour tests d'emails

## Avantages de Mailgun

- ✅ **Vous avez déjà un compte** (pas de création nécessaire)
- ✅ **Gratuit** : 5000 emails/mois les 3 premiers mois, puis 1000/mois
- ✅ **Logs détaillés** : Traçabilité complète des emails
- ✅ **Même sur les 2 PC** : Configuration partagée via Supabase cloud
- ✅ **Production-ready** : Peut être utilisé en production

## Configuration (5 minutes)

### Étape 1 : Récupérer vos credentials SMTP Mailgun

1. Connectez-vous sur https://app.mailgun.com
2. Allez dans **Sending** > **Domain settings** (menu de gauche)
3. Sélectionnez votre domaine sandbox (ex: `sandbox123abc.mailgun.org`)
4. Cliquez sur **SMTP credentials** (ou **Domain information**)
5. Notez les informations suivantes :

**Pour le sandbox (développement) :**
```
Host: smtp.mailgun.org
Port: 587 (recommandé) ou 465
Username: postmaster@sandboxXXXXXXXX.mailgun.org
Password: [Cliquez sur "Reset Password" si besoin]
```

**Important** : Si vous n'avez pas encore de mot de passe SMTP, cliquez sur "Reset password" pour en générer un.

### Étape 2 : Autoriser votre email de test (sandbox uniquement)

Le sandbox Mailgun n'envoie des emails qu'aux adresses autorisées.

1. Dans **Sending** > **Domain settings**
2. Section **Authorized Recipients**
3. Cliquez sur **Add Recipient**
4. Ajoutez votre email personnel (celui que vous utilisez pour tester)
5. Vérifiez votre email et cliquez sur le lien de confirmation

**Note** : Avec un domaine vérifié (pas sandbox), cette étape n'est pas nécessaire.

### Étape 3 : Configurer Supabase

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet **PronoHub**
3. Cliquez sur **⚙️ Project Settings** (en bas à gauche)
4. Dans le menu, cliquez sur **Auth**
5. Scrollez jusqu'à **SMTP Settings**

**Configuration pour Mailgun :**

| Paramètre | Valeur |
|-----------|--------|
| **Enable Custom SMTP** | ✅ Activé |
| **Sender name** | `PronoHub` |
| **Sender email** | `noreply@sandbox[votre-id].mailgun.org` |
| **Host** | `smtp.mailgun.org` |
| **Port Number** | `587` |
| **Minimum TLS Version** | `TLS 1.2` (défaut) |
| **Username** | `postmaster@sandbox[votre-id].mailgun.org` |
| **Password** | `[votre-mot-de-passe-smtp]` |

6. Cliquez sur **Save** en bas de la page

### Étape 4 : Tester l'envoi

1. Lancez votre application : `npm run dev`
2. Allez sur http://localhost:3000/auth/signup
3. **Important** : Utilisez l'email que vous avez autorisé dans le sandbox
4. Vérifiez votre boîte mail

**Si vous utilisez un sandbox**, l'email n'arrivera que si vous avez autorisé l'adresse destinataire à l'étape 2.

## Vérifier les emails dans Mailgun

### Via les logs Mailgun

1. Connectez-vous sur https://app.mailgun.com
2. Allez dans **Sending** > **Logs**
3. Vous verrez tous les emails envoyés avec leur statut :
   - ✅ **Delivered** : Email reçu
   - ⚠️ **Queued** : En cours d'envoi
   - ❌ **Failed** : Échec (voir la raison)

### Voir le contenu de l'email

1. Dans les logs, cliquez sur un email
2. Vous verrez tous les détails :
   - Destinataire
   - Sujet
   - Corps de l'email (HTML/texte)
   - Code OTP visible directement

## Différence sandbox vs domaine vérifié

### Sandbox (par défaut)

- **Gratuit** : 5000 emails les 3 premiers mois, puis 1000/mois
- **Limitation** : Envoi uniquement vers les emails autorisés
- **Domaine** : `sandboxXXX.mailgun.org`
- **Usage** : Développement et tests

### Domaine vérifié (production)

- **Gratuit** : 5000 emails/mois les 3 premiers mois, puis 1000/mois
- **Aucune limitation** : Envoi vers n'importe quelle adresse
- **Domaine** : Votre propre domaine (ex: `pronohub.com`)
- **Usage** : Production

## Utilisation sur 2 PC

**Avantage majeur** : Configuration faite une seule fois dans Supabase Dashboard.

### Sur PC 1 et PC 2

```bash
# Aucune configuration locale nécessaire !
# Utilisez votre .env.local existant avec Supabase cloud
npm run dev
```

Les emails passent par Mailgun automatiquement sur les 2 PC.

## Passer à un domaine vérifié (production)

Quand vous êtes prêt pour la production :

### Étape 1 : Ajouter votre domaine

1. Mailgun Dashboard > **Sending** > **Domains**
2. Cliquez sur **Add New Domain**
3. Entrez votre domaine : `pronohub.com`
4. Suivez les instructions pour ajouter les enregistrements DNS :
   - **TXT** : Vérification du domaine
   - **MX** : Réception (optionnel)
   - **CNAME** : Tracking (optionnel)

### Étape 2 : Mettre à jour Supabase

Une fois le domaine vérifié, dans Supabase SMTP Settings :

| Paramètre | Valeur |
|-----------|--------|
| **Sender email** | `noreply@pronohub.com` |
| **Username** | `postmaster@pronohub.com` |
| **Password** | `[même mot de passe ou nouveau]` |

## Templates d'email

Personnalisez vos emails dans Supabase :

1. Supabase Dashboard > **Authentication** > **Email Templates**
2. Modifiez le template **Magic Link** (pour les codes OTP)

### Template OTP recommandé

```html
<h2>Bienvenue sur PronoHub !</h2>
<p>Votre code de vérification est :</p>
<div style="
  font-size: 32px;
  letter-spacing: 5px;
  text-align: center;
  font-family: 'Courier New', monospace;
  background: #f3f4f6;
  padding: 20px;
  border-radius: 8px;
  color: #1f2937;
  font-weight: bold;
  margin: 20px 0;
">{{ .Token }}</div>
<p style="color: #6b7280; font-size: 14px;">
  Ce code expire dans <strong>1 heure</strong>.
</p>
<p style="color: #9ca3af; font-size: 12px;">
  Si vous n'avez pas demandé ce code, ignorez cet email.
</p>
<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
<p style="color: #9ca3af; font-size: 11px; text-align: center;">
  PronoHub - Vos tournois de pronostics entre amis
</p>
```

## Troubleshooting

### Problème : "SMTP Authentication failed"

**Causes possibles :**
1. Username ou password incorrect
2. Vous utilisez l'ancien mot de passe

**Solution :**
1. Allez dans Mailgun > **Sending** > **Domain settings**
2. Section **SMTP credentials**
3. Cliquez sur **Reset password**
4. Copiez le nouveau mot de passe
5. Mettez à jour dans Supabase

### Problème : L'email n'arrive pas

**Pour le sandbox :**
1. ✅ Avez-vous autorisé l'email destinataire dans Mailgun ?
2. ✅ Avez-vous cliqué sur le lien de confirmation reçu ?

**Vérifier dans les logs Mailgun :**
1. Mailgun Dashboard > **Sending** > **Logs**
2. Cherchez votre email
3. Regardez le statut et le message d'erreur

### Problème : "Recipient not authorized"

**Cause** : L'email destinataire n'est pas autorisé dans le sandbox

**Solution** :
1. Mailgun > **Sending** > **Domain settings**
2. **Authorized Recipients** > **Add Recipient**
3. Ajoutez l'email et validez

### Problème : "550 Requested action not taken: mailbox unavailable"

**Cause** : L'email destinataire n'existe pas ou refuse les emails

**Solution** : Utilisez un vrai email valide

## Limites du plan gratuit

| Limite | Valeur |
|--------|--------|
| **3 premiers mois** | 5000 emails/mois |
| **Après 3 mois** | 1000 emails/mois |
| **Validation** | 100/heure, 300/jour |
| **Sandbox** | Uniquement emails autorisés |
| **Domaine vérifié** | Envoi illimité vers n'importe qui |

Pour un projet en développement, c'est largement suffisant.

## Alternatives si vous dépassez

Si vous dépassez 1000 emails/mois en prod :

1. **Resend** : 3000 emails/mois gratuit (recommandé)
2. **SendGrid** : 100 emails/jour gratuit
3. **AWS SES** : 62000 emails/mois gratuit (première année)
4. **Mailgun payant** : 35$/mois pour 50000 emails

## Statistiques et monitoring

### Dashboard Mailgun

- **Delivered** : Nombre d'emails livrés
- **Opened** : Taux d'ouverture (si tracking activé)
- **Clicked** : Clics sur les liens
- **Failed** : Échecs avec raisons

### Webhooks (avancé)

Vous pouvez configurer des webhooks pour être notifié :
- Quand un email est livré
- Quand un email bounce
- Quand un utilisateur se plaint (spam)

Configuration : Mailgun > **Sending** > **Webhooks**

## Sécurité

### Bonnes pratiques

1. ✅ Ne jamais commit votre mot de passe SMTP
2. ✅ Utilisez des variables d'environnement si besoin localement
3. ✅ Activez l'authentification à 2 facteurs sur Mailgun
4. ✅ Surveillez vos logs pour détecter les abus

### Rotation des credentials

Si vous pensez que vos credentials ont fuité :
1. Mailgun > **Account Settings** > **API Security**
2. Créez une nouvelle clé API
3. Réinitialisez votre mot de passe SMTP
4. Mettez à jour dans Supabase

## Résumé

✅ **Vous avez déjà un compte** (gain de temps)
✅ **Configuration en 5 minutes**
✅ **Fonctionne sur 2 PC automatiquement**
✅ **Logs détaillés** dans le dashboard Mailgun
✅ **Gratuit** : 5000 emails/mois pendant 3 mois
✅ **Production-ready** avec domaine vérifié

---

**C'est la solution parfaite pour votre cas : pas besoin de Docker, configuration simple, et utilisable en production !**
