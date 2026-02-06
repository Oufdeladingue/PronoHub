# Logique d'application des extensions

## 📋 Résumé

Les 3 types d'extensions ont des logiques d'application différentes selon le contexte.

---

## 1. Extension de capacité (`player_extension`)

### Quand s'applique-t-elle ?
**Immédiatement après le paiement** (page échauffement)

### Flow complet
```
1. Utilisateur clique "Ajouter des places" (2,99€ → 1,99€)
   ↓
2. Redirection vers Stripe Checkout
   ↓
3. Paiement réussi
   ↓
4. Webhook Stripe reçoit l'événement
   ↓
5. handlePlayerExtension() s'exécute AUTOMATIQUEMENT
   ↓
6. +5 places ajoutées au tournoi (max_players += 5)
   ↓
7. L'achat est marqué used=true
   ↓
8. Redirection vers /tournaments/[id]?payment=success
```

### Fichiers concernés
- [`app/api/stripe/webhook/route.ts`](../app/api/stripe/webhook/route.ts:199-202) - Appel à `handlePlayerExtension()`
- [`app/api/stripe/webhook/route.ts`](../app/api/stripe/webhook/route.ts:369-415) - Fonction `handlePlayerExtension()`

### Résultat
L'utilisateur revient sur la page du tournoi et voit immédiatement :
- `max_players: 10 → 15` (ou 15 → 20, etc.)
- Il peut inviter 5 joueurs de plus
- Pas besoin d'action supplémentaire

---

## 2. Extension de journées (`duration_extension`)

### Quand s'applique-t-elle ?
**Manuellement via une modale de choix** (page opposition)

### Flow complet
```
1. Utilisateur clique "Prolonger le tournoi" (3,99€)
   ↓
2. Redirection vers Stripe Checkout
   ↓
3. Paiement réussi
   ↓
4. Webhook Stripe reçoit l'événement
   ↓
5. L'achat est créé avec used=false (crédit disponible)
   ↓
6. Redirection vers /tournaments/[id]?payment=success
   ↓
7. L'utilisateur va sur la page "Opposition"
   ↓
8. Détection du crédit disponible (used=false)
   ↓
9. Affichage modale "Combien de journées veux-tu ajouter ?"
   ↓
10. Utilisateur choisit : 5J, 10J, 15J, 20J ou 30J
   ↓
11. Appel à POST /api/extensions/apply
   ↓
12. max_matchdays += journées choisies
   ↓
13. L'achat est marqué used=true
```

### Fichiers concernés
- [`app/api/stripe/webhook/route.ts`](../app/api/stripe/webhook/route.ts:195-198) - Le crédit reste `used=false`
- [`components/modals/DurationExtensionModal.tsx`](../components/modals/DurationExtensionModal.tsx) - Modale de choix
- [`lib/hooks/use-duration-extension.ts`](../lib/hooks/use-duration-extension.ts) - Hook pour détecter et appliquer
- [`app/api/extensions/apply/route.ts`](../app/api/extensions/apply/route.ts) - API pour consommer le crédit

### Utilisation dans une page

```typescript
import { useDurationExtension } from '@/lib/hooks/use-duration-extension'
import DurationExtensionModal from '@/components/modals/DurationExtensionModal'

function OppositionPage({ tournamentId }: { tournamentId: string }) {
  const { hasCredit, applyExtension } = useDurationExtension(tournamentId)
  const [showModal, setShowModal] = useState(false)

  // Afficher la modale si crédit disponible
  useEffect(() => {
    if (hasCredit) {
      setShowModal(true)
    }
  }, [hasCredit])

  return (
    <>
      {/* Page content */}

      <DurationExtensionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        tournamentId={tournamentId}
        onApply={applyExtension}
      />
    </>
  )
}
```

### Résultat
L'utilisateur choisit combien de journées ajouter (flexibilité) et le crédit est consommé.

---

## 3. Option stats (`stats_option`)

### Quand s'applique-t-elle ?
**Immédiatement après le paiement**

Il existe 2 formules :
- **stats_access_tournament** : 1,99€ - Accès stats pour UN tournoi spécifique
- **stats_access_lifetime** : 5,99€ - Accès stats à VIE (tous les tournois)

### Flow complet (lifetime)
```
1. Utilisateur clique "Débloquer les stats" (5,99€)
   ↓
2. Redirection vers Stripe Checkout
   ↓
3. Paiement réussi
   ↓
4. Webhook Stripe reçoit l'événement
   ↓
5. L'achat est créé avec purchase_type='stats_access_lifetime'
   ↓
6. Redirection vers /tournaments/[id]?payment=success
   ↓
7. L'utilisateur a maintenant accès aux stats PARTOUT
```

### Comment vérifier l'accès stats ?

#### Pour un tournoi spécifique
```typescript
const { data: hasAccess } = await supabase
  .from('tournament_purchases')
  .select('id')
  .eq('user_id', userId)
  .eq('tournament_id', tournamentId)
  .eq('purchase_type', 'stats_access_tournament')
  .eq('status', 'completed')
  .limit(1)
  .single()

return !!hasAccess
```

#### Pour accès à vie
```typescript
const { data: hasLifetimeAccess } = await supabase
  .from('tournament_purchases')
  .select('id')
  .eq('user_id', userId)
  .eq('purchase_type', 'stats_access_lifetime')
  .eq('status', 'completed')
  .limit(1)
  .single()

return !!hasLifetimeAccess
```

#### Fonction helper complète
```typescript
async function userHasStatsAccess(userId: string, tournamentId: string): Promise<boolean> {
  const supabase = createClient()

  // Vérifier accès à vie
  const { data: lifetime } = await supabase
    .from('tournament_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('purchase_type', 'stats_access_lifetime')
    .eq('status', 'completed')
    .limit(1)
    .single()

  if (lifetime) return true

  // Vérifier accès pour ce tournoi
  const { data: tournament } = await supabase
    .from('tournament_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)
    .eq('purchase_type', 'stats_access_tournament')
    .eq('status', 'completed')
    .limit(1)
    .single()

  return !!tournament
}
```

### Fichiers concernés
- [`app/api/stripe/webhook/route.ts`](../app/api/stripe/webhook/route.ts:203-210) - Les achats stats sont marqués `completed` immédiatement

### Résultat
L'utilisateur a accès aux stats selon sa formule (tournoi unique ou à vie).

---

## 🔄 Tableau récapitulatif

| Extension | Prix | Application | Crédit ? | Modale ? | Page |
|-----------|------|-------------|----------|----------|------|
| **Capacité** | 1,99€ | Immédiate | Non (used=true direct) | Non | Échauffement |
| **Journées** | 3,99€ | Manuelle | Oui (used=false) | Oui (choix nb) | Opposition |
| **Stats (tournoi)** | 1,99€ | Immédiate | Non (juste marqué completed) | Non | N/A |
| **Stats (à vie)** | 5,99€ | Immédiate | Non (juste marqué completed) | Non | N/A |

---

## ⚠️ Points importants

1. **Extension de capacité** : Pas de modale de choix, c'est toujours +5 places.
2. **Extension de journées** : L'utilisateur DOIT choisir combien il en veut (flexibilité).
3. **Stats** : Pas de gestion de crédits, c'est un achat one-time qui donne un accès.

---

## 📝 TODO pour finaliser

### 1. Intégrer `DurationExtensionModal` dans la page Opposition

Fichier à modifier : `app/(app)/tournaments/[slug]/opposition/page.tsx`

```typescript
import { useDurationExtension } from '@/lib/hooks/use-duration-extension'
import DurationExtensionModal from '@/components/modals/DurationExtensionModal'

// Dans le composant
const { hasCredit, applyExtension } = useDurationExtension(tournament.id)
const [showExtensionModal, setShowExtensionModal] = useState(false)

useEffect(() => {
  if (hasCredit) {
    setShowExtensionModal(true)
  }
}, [hasCredit])

// Dans le JSX
<DurationExtensionModal
  isOpen={showExtensionModal}
  onClose={() => setShowExtensionModal(false)}
  tournamentId={tournament.id}
  onApply={applyExtension}
/>
```

### 2. Afficher un message de succès après extension de capacité

Détecter le query param `?payment=success&type=player_extension` et afficher :
```
"✅ +5 places ajoutées ! Tu peux maintenant inviter plus de joueurs."
```

### 3. Créer la fonction helper pour vérifier l'accès stats

Fichier à créer : `lib/check-stats-access.ts`

### 4. Implémenter le déclenchement automatique des modales

Afficher les modales d'achat selon les conditions :
- **Extension capacité** : Quand `current_participants >= max_players - 2`
- **Extension journées** : Quand `matchdays_count >= max_matchdays - 3`
- **Stats** : Périodiquement pour inciter à l'achat

---

## 🐛 Corrections apportées

✅ **Erreur Stripe** : Le hook `use-purchase-modal.ts` vérifie maintenant que `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` existe avant d'appeler `loadStripe()`

✅ **Logique extensions** :
- Extension de capacité → Application immédiate
- Extension de journées → Crédit + modale de choix
- Stats → Accès immédiat selon formule

✅ **Webhook corrigé** : La fonction `handlePlayerExtension()` a été restaurée et s'exécute automatiquement.

---

## 🚀 Prochaines étapes

1. Ajouter les clés Stripe dans `.env.local` (test mode d'abord)
2. Créer les produits dans le dashboard Stripe
3. Tester le flow complet d'achat
4. Intégrer la modale de choix de journées dans la page Opposition
5. Implémenter les déclenchements automatiques des modales
