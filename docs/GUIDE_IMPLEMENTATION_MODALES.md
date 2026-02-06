# Guide d'implémentation - Modales d'achat

## ✅ Ce qui a été implémenté

### 1. Système de produits Stripe

**Fichier créé**: [`lib/stripe-products.ts`](../lib/stripe-products.ts)

Définit 3 produits d'extension :
- **Extension de durée** (`duration_extension`) : 3.99€ - Ajoute 10 journées au tournoi
- **Extension de capacité** (`player_extension`) : 1.99€ - Ajoute 5 places au tournoi
- **Accès stats à vie** (`stats_option`) : 5.99€ - Débloque les stats pour tous les tournois

### 2. API de création de session Stripe

**Fichier modifié**: [`app/api/stripe/create-checkout/route.ts`](../app/api/stripe/create-checkout/route.ts)

- Crée un enregistrement `tournament_purchases` avec `status: 'pending'` et `used: false`
- Génère une session Stripe Checkout
- Redirige l'utilisateur vers le paiement Stripe

### 3. Webhook Stripe (gestion des paiements)

**Fichier modifié**: [`app/api/stripe/webhook/route.ts`](../app/api/stripe/webhook/route.ts)

- Marque l'achat comme `status: 'completed'` après paiement réussi
- **Les crédits restent `used: false`** jusqu'à consommation manuelle
- Envoie un email d'alerte à l'admin pour chaque transaction

### 4. API d'application des extensions

**Fichier créé**: [`app/api/extensions/apply/route.ts`](../app/api/extensions/apply/route.ts)

Route pour consommer un crédit d'extension :
- Vérifie que l'utilisateur est créateur du tournoi
- Consomme un crédit via `use_purchase_credit()`
- Applique l'extension au tournoi

### 5. Hook d'achat React

**Fichier créé**: [`lib/hooks/use-purchase-modal.ts`](../lib/hooks/use-purchase-modal.ts)

Hook pour gérer les achats depuis les modales :
- `handlePurchase(productType, tournamentId)` - Déclenche le flow d'achat
- Gère le loading et les erreurs
- Redirige vers Stripe Checkout

### 6. Modales d'achat fonctionnelles

**Fichier modifié**: [`components/modals/DebugModalContainer.tsx`](../components/modals/DebugModalContainer.tsx)

- Les 4 modales sont maintenant cliquables
- Chaque bouton déclenche un achat Stripe
- États de loading gérés (bouton désactivé + texte "Chargement...")

### 7. Système de debug amélioré

**Fichier modifié**: [`lib/debug-modals.ts`](../lib/debug-modals.ts)

- `showDebugModal(type, tournamentId?)` - Accepte maintenant un tournamentId
- Permet de tester les modales en contexte de tournoi

---

## ⚙️ Configuration requise

### 1. Variables d'environnement

Ajoute ces variables dans `.env.local` :

```bash
# Stripe (clés de test)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs Stripe (à créer dans le dashboard Stripe)
NEXT_PUBLIC_STRIPE_PRICE_DURATION_EXTENSION=price_...
NEXT_PUBLIC_STRIPE_PRICE_PLAYER_EXTENSION=price_...
NEXT_PUBLIC_STRIPE_PRICE_STATS_LIFETIME=price_...

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3100
```

### 2. Créer les produits dans Stripe Dashboard

1. Va sur https://dashboard.stripe.com/test/products
2. Crée 3 produits :

**Produit 1 : Joue les prolongations**
- Prix : 3,99€
- Type : Paiement unique
- Copie le Price ID → `NEXT_PUBLIC_STRIPE_PRICE_DURATION_EXTENSION`

**Produit 2 : Renfort du banc**
- Prix : 1,99€
- Type : Paiement unique
- Copie le Price ID → `NEXT_PUBLIC_STRIPE_PRICE_PLAYER_EXTENSION`

**Produit 3 : Stats du match - À vie**
- Prix : 5,99€
- Type : Paiement unique
- Copie le Price ID → `NEXT_PUBLIC_STRIPE_PRICE_STATS_LIFETIME`

### 3. Configurer le Webhook Stripe

1. Va sur https://dashboard.stripe.com/test/webhooks
2. Clique sur "Add endpoint"
3. URL : `https://ton-domaine.com/api/stripe/webhook`
4. Événements à écouter :
   - `checkout.session.completed`
   - `checkout.session.expired`
5. Copie le "Signing secret" → `STRIPE_WEBHOOK_SECRET`

---

## 🧪 Tester les modales

### En mode debug (sans Stripe)

```javascript
// Dans la console du navigateur
window.debugShowModal('duration_extension')
window.debugShowModal('player_extension_2_1')
window.debugShowModal('player_extension_0')
window.debugShowModal('stats_option')
```

### Avec un tournoi spécifique

```javascript
window.debugShowModal('duration_extension', 'TOURNAMENT_UUID')
```

### Test du flow complet d'achat

1. Ouvre une modale avec le bouton
2. Clique sur le bouton orange
3. Tu es redirigé vers Stripe Checkout
4. Utilise une carte de test : `4242 4242 4242 4242`
5. Après paiement, tu reviens sur le tournoi avec `?payment=success`
6. L'achat est enregistré dans `tournament_purchases` avec `used: false`

---

## 🔄 Flow d'achat complet

```
1. Utilisateur clique sur bouton modale
   ↓
2. handlePurchase('duration_extension', 'uuid-tournoi')
   ↓
3. POST /api/stripe/create-checkout
   ↓
4. Création purchase (status: pending, used: false)
   ↓
5. Création session Stripe
   ↓
6. Redirection vers Stripe Checkout
   ↓
7. Utilisateur paie
   ↓
8. Webhook: checkout.session.completed
   ↓
9. Update purchase (status: completed, used: false)
   ↓
10. Crédit disponible pour l'utilisateur
```

---

## 📝 Utilisation des crédits

Les crédits sont **créés mais non consommés** après l'achat.

Pour consommer un crédit :

```typescript
// Exemple: Appliquer une extension de durée
const response = await fetch('/api/extensions/apply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    extensionType: 'duration_extension',
    tournamentId: 'uuid-tournoi',
    options: { journeysToAdd: 10 }
  })
})
```

Cela va :
1. Consommer 1 crédit (marquer `used: true`)
2. Ajouter 10 journées au `max_matchdays` du tournoi
3. Marquer `duration_extended: true`

---

## 🎯 Prochaines étapes

### 1. Logique de déclenchement automatique

Créer un système qui affiche automatiquement les modales selon les conditions :

**Extension de durée** (`duration_extension`) :
- Quand `matchdays_count` approche `max_matchdays`
- Ex: Si `max_matchdays = 38` et `matchdays_count = 35` → afficher la modale

**Extension de capacité** (`player_extension_2_1`) :
- Quand `current_participants` proche de `max_players`
- Ex: Si `max_players = 10` et `current_participants = 8` → afficher la modale

**Extension de capacité** (`player_extension_0`) :
- Quand `current_participants == max_players`

**Option stats** (`stats_option`) :
- Afficher de temps en temps pour inciter à l'achat
- Vérifier si l'utilisateur a déjà l'accès stats

### 2. Affichage contextuel

Intégrer les modales dans les pages de tournoi :
- Après qu'un joueur rejoigne (player_extension)
- Quand une journée se termine (duration_extension)
- Dans la page des stats (stats_option si pas accès)

### 3. Tracking des vues

Utiliser la table `user_modal_views` pour ne pas spammer :
- Vérifier `has_viewed_modal(tournament_id, modal_type)` avant d'afficher
- Enregistrer `mark_modal_as_viewed(tournament_id, modal_type)` après affichage

### 4. Interface de gestion des crédits

Créer une page dashboard où l'utilisateur peut voir :
- Ses crédits disponibles (`used: false`)
- Son historique d'achats
- Ses crédits utilisés avec les tournois associés

---

## 🛠️ Fichiers créés/modifiés

✅ **Créés** :
- `lib/stripe-products.ts`
- `lib/hooks/use-purchase-modal.ts`
- `app/api/extensions/apply/route.ts`
- `docs/GUIDE_IMPLEMENTATION_MODALES.md`

✅ **Modifiés** :
- `app/api/stripe/create-checkout/route.ts`
- `app/api/stripe/webhook/route.ts`
- `components/modals/DebugModalContainer.tsx`
- `lib/debug-modals.ts`

✅ **Existants (déjà en place)** :
- `supabase/migrations/20260205_modal_views_tracking.sql`
- `supabase/migrations/add_stats_access_feature.sql`
- `supabase/migrations/add_purchase_credits_tracking.sql`

---

## 🐛 Dépannage

### Le bouton ne fait rien
- Vérifie la console : y a-t-il des erreurs ?
- Vérifie que `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` est défini
- Vérifie que le serveur de développement tourne

### Redirection Stripe échoue
- Vérifie que les Price IDs sont corrects
- Teste avec `pk_test_...` et non `pk_live_...`
- Vérifie que l'API route `/api/stripe/create-checkout` retourne bien `sessionId` et `url`

### Le webhook ne fonctionne pas
- En local, utilise Stripe CLI : `stripe listen --forward-to localhost:3100/api/stripe/webhook`
- Vérifie que `STRIPE_WEBHOOK_SECRET` correspond
- Vérifie les logs du webhook dans le dashboard Stripe

### L'achat est marqué `completed` mais `used: true` automatiquement
- C'est normal si tu utilises l'ancien code
- Assure-toi que le webhook **ne consomme pas** le crédit
- Les crédits doivent rester `used: false` jusqu'à utilisation manuelle

---

## 💡 Notes importantes

1. **Les extensions ne s'appliquent PAS automatiquement** après achat - c'est intentionnel
2. Les crédits sont **liés au tournoi** via `tournament_id` dans `tournament_purchases`
3. Un utilisateur peut avoir **plusieurs crédits** du même type pour différents tournois
4. Le webhook **envoie un email admin** pour chaque transaction (désactivable en prod)
5. Les modales incluent un badge **"MODE DEBUG"** - à retirer en production

---

## 🎨 Customisation des modales

Pour modifier le design, édite [`components/modals/DebugModalContainer.tsx`](../components/modals/DebugModalContainer.tsx).

Chaque modale a :
- Un titre (uppercase, texte blanc + highlight orange)
- Une image centrale (250px)
- Un texte descriptif avec effet scrim (fond diffus noir)
- Un bouton orange dégradé
- Un sous-texte gris

Pour ajouter une nouvelle modale :
1. Ajoute le type dans `DebugModalType` ([`lib/debug-modals.ts`](../lib/debug-modals.ts:19))
2. Ajoute le produit dans `ExtensionProduct` ([`lib/stripe-products.ts`](../lib/stripe-products.ts:5))
3. Ajoute la config produit dans `STRIPE_PRODUCTS`
4. Ajoute le bloc JSX dans `DebugModalContainer.tsx`
