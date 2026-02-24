# Améliorations Deliverabilité Emails

## Score actuel SpamAssassin : -1.9

Une note en dessous de -5 est considérée comme du spam. Notre score est bon mais peut être amélioré.

---

## Ce qui fonctionne bien

| Règle | Score | Statut |
|-------|-------|--------|
| DKIM_SIGNED | -0.1 | Signature DKIM présente |
| DKIM_VALID | +0.1 | Signature DKIM valide |
| DKIM_VALID_AU | +0.1 | Signature valide depuis le domaine auteur (pronohub.club) |
| DKIM_VALID_EF | +0.1 | Signature valide depuis le domaine envelope-from |
| SPF_PASS | +0.001 | Enregistrement SPF valide |
| RCVD_IN_MSPIKE_H3 | -0.001 | Bonne réputation IP (+3) via Mailspike |
| RCVD_IN_MSPIKE_WL | -0.001 | IP dans la whitelist Mailspike |
| HTML_MESSAGE | -0.001 | Normal pour des emails HTML |

## Points d'amélioration

### 1. Ajouter le header List-Unsubscribe (PRIORITAIRE)

**Problème** : L'en-tête `List-Unsubscribe` est absent. Il est requis pour les emails en masse (Gmail, Yahoo l'exigent depuis février 2024).

**Impact** : Sans ce header, les emails risquent d'être classés en spam par Gmail/Yahoo, surtout en volume.

**Solution** : Ajouter les headers dans `lib/email/send.ts` lors de l'envoi via Resend :

```typescript
await resend.emails.send({
  from: EMAIL_CONFIG.from,
  to,
  subject,
  html,
  text,
  replyTo: EMAIL_CONFIG.replyTo,
  headers: {
    'List-Unsubscribe': '<https://www.pronohub.club/settings/notifications?unsubscribe=1>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  },
})
```

Il faudra aussi créer une page `/settings/notifications` (ou endpoint API) qui gère le désabonnement one-click.

### 2. HTML_FONT_LOW_CONTRAST (-0.001)

**Problème** : SpamAssassin détecte des couleurs de texte proches de la couleur de fond.

**Impact** : Faible (-0.001) mais peut s'accumuler.

**Solution** : Vérifier les templates email dans `lib/email/templates.ts` et s'assurer que toutes les couleurs de texte ont un contraste suffisant avec le fond. Chercher les textes en gris très clair sur fond sombre (ex: `#64748b` sur `#0f172a`).

### 3. SPF_HELO_NONE (-0.001)

**Problème** : Le HELO du serveur d'envoi (Resend/Amazon SES) ne publie pas de record SPF.

**Impact** : Minimal, c'est côté Resend, pas de notre contrôle.

**Solution** : Aucune action requise, c'est géré par Resend.

### 4. URIBL_ABUSE_SURBL (-1.948)

**Problème** : Une URL dans l'email est listée dans la blocklist ABUSE SURBL.

**Impact** : C'est le plus gros score négatif. Probablement lié à une URL de tracking Resend ou à un domaine externe (crests football-data.org ?).

**Solution** :
- Identifier quelle URL déclenche cette règle (tester en retirant les URLs une par une)
- Si c'est le domaine de tracking Resend, configurer un domaine de tracking custom dans Resend (ex: `track.pronohub.club`)
- Si ce sont les URLs de crests football-data.org, envisager de les héberger sur notre propre domaine

### 5. URI_HEX (-0.1)

**Problème** : Un hostname dans les URLs contient une longue séquence hexadécimale.

**Impact** : Faible (-0.1).

**Solution** : Probablement lié aux URLs de tracking Resend. Configurer un domaine de tracking custom résoudrait ce point aussi.

---

## Plan d'action par priorité

1. **List-Unsubscribe** : Ajouter le header + créer l'endpoint de désabonnement
2. **URIBL_ABUSE_SURBL** : Identifier l'URL problématique et configurer un tracking domain custom
3. **Contraste couleurs** : Vérifier les templates pour les couleurs à faible contraste
4. **URI_HEX** : Résolu automatiquement si on configure un tracking domain custom

## Ressources

- [Resend - Custom tracking domain](https://resend.com/docs/dashboard/domains/introduction)
- [Google Bulk Sender Guidelines](https://support.google.com/a/answer/81126)
- [RFC 8058 - One-Click Unsubscribe](https://datatracker.ietf.org/doc/html/rfc8058)
