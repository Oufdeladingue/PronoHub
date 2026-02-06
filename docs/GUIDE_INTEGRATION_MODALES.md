# Guide d'intégration des modales incitatives

## 📋 Fichiers créés

1. ✅ [`lib/hooks/use-incentive-modals.ts`](../lib/hooks/use-incentive-modals.ts) - Hook pour détecter les conditions d'affichage
2. ✅ [`components/modals/IncentiveModalContainer.tsx`](../components/modals/IncentiveModalContainer.tsx) - Composant de modales (sans badge DEBUG)
3. ✅ [`components/modals/DurationExtensionModal.tsx`](../components/modals/DurationExtensionModal.tsx) - Modale curseur pour choisir le nb de journées
4. ✅ [`lib/hooks/use-duration-extension.ts`](../lib/hooks/use-duration-extension.ts) - Hook pour gérer les crédits d'extension de durée

---

## 🎯 Intégration dans Opposition (pour durée et stats)

### Fichier à modifier : `app/[tournamentSlug]/opposition/OppositionClient.tsx`

#### 1. Ajouter les imports (ligne ~18)
```typescript
import { useIncentiveModals } from '@/lib/hooks/use-incentive-modals'
import { useDurationExtension } from '@/lib/hooks/use-duration-extension'
import IncentiveModalContainer from '@/components/modals/IncentiveModalContainer'
import DurationExtensionModal from '@/components/modals/DurationExtensionModal'
```

#### 2. Ajouter les hooks dans le composant (ligne ~145, après les useState)
```typescript
// Hook pour détecter les modales à afficher
const { shouldShowModal, markModalAsViewed } = useIncentiveModals({
  tournament: {
    id: tournament.id,
    matchdays_count: tournament.num_matchdays || 0,
    max_matchdays: tournament.ending_matchday || 0,
    max_players: tournament.max_players,
    current_participants: 0, // À récupérer depuis les participants
    duration_extended: false, // À récupérer depuis tournament
    competition_id: tournament.competition_id || 0
  },
  currentJourneyNumber: selectedMatchday || undefined
})

// Hook pour gérer le crédit d'extension de durée
const { hasCredit, applyExtension } = useDurationExtension(tournament.id)

// État pour la modale incitative
const [showIncentiveModal, setShowIncentiveModal] = useState<boolean>(false)
const [showDurationChoiceModal, setShowDurationChoiceModal] = useState<boolean>(false)

// Détecter le retour après paiement extension de durée
useEffect(() => {
  const paymentSuccess = searchParams.get('payment')
  const paymentType = searchParams.get('type')

  if (paymentSuccess === 'success' && paymentType === 'duration_extension' && hasCredit) {
    setShowDurationChoiceModal(true)
  }
}, [searchParams, hasCredit])

// Afficher la modale incitative si conditions remplies
useEffect(() => {
  if (shouldShowModal) {
    setShowIncentiveModal(true)
  }
}, [shouldShowModal])

const handleCloseIncentiveModal = () => {
  setShowIncentiveModal(false)
  if (shouldShowModal) {
    markModalAsViewed(shouldShowModal)
  }
}
```

#### 3. Ajouter les modales avant le closing tag (ligne ~3286, juste avant `</div>`)
```typescript
        {/* Modales incitatives */}
        <IncentiveModalContainer
          modalType={showIncentiveModal ? shouldShowModal : null}
          tournamentId={tournament.id}
          onClose={handleCloseIncentiveModal}
        />

        {/* Modale choix nombre de journées (après paiement extension durée) */}
        <DurationExtensionModal
          isOpen={showDurationChoiceModal}
          onClose={() => setShowDurationChoiceModal(false)}
          tournamentId={tournament.id}
          onApply={async (journeysToAdd) => {
            await applyExtension(journeysToAdd)
            // Recharger le tournoi pour voir les nouvelles journées
            window.location.reload()
          }}
        />

        {/* Modale score maximum */}
        <MaxScoreModal
          isOpen={showMaxScoreModal}
          onClose={() => setShowMaxScoreModal(false)}
        />
      </div>
    </>
  )
}
```

---

## 🏃 Intégration dans Échauffement (pour capacité)

### Fichier à modifier : `app/vestiaire/[tournamentSlug]/echauffement/page.tsx`

#### 1. Vérifier si c'est un Client Component ou Server Component

Si c'est un Server Component, créer un `EchauffementClient.tsx` similaire à Opposition.

#### 2. Ajouter les mêmes imports
```typescript
import { useIncentiveModals } from '@/lib/hooks/use-incentive-modals'
import IncentiveModalContainer from '@/components/modals/IncentiveModalContainer'
import { useSearchParams } from 'next/navigation'
```

#### 3. Ajouter le hook et la logique
```typescript
const searchParams = useSearchParams()

// Hook pour détecter la modale d'extension de capacité
const { shouldShowModal, markModalAsViewed } = useIncentiveModals({
  tournament: {
    id: tournament.id,
    matchdays_count: 0,
    max_matchdays: 0,
    max_players: tournament.max_players,
    current_participants: tournament.current_participants || 0,
    duration_extended: false,
    competition_id: tournament.competition_id || 0
  }
})

const [showIncentiveModal, setShowIncentiveModal] = useState<boolean>(false)

// Afficher la modale si conditions remplies
useEffect(() => {
  if (shouldShowModal && (shouldShowModal === 'player_extension_2_1' || shouldShowModal === 'player_extension_0')) {
    setShowIncentiveModal(true)
  }
}, [shouldShowModal])

// Détecter le retour après paiement et recharger pour voir les places ajoutées
useEffect(() => {
  const paymentSuccess = searchParams.get('payment')
  const paymentType = searchParams.get('type')

  if (paymentSuccess === 'success' && paymentType === 'player_extension') {
    // Afficher un toast de succès ou recharger
    window.location.reload()
  }
}, [searchParams])

const handleCloseIncentiveModal = () => {
  setShowIncentiveModal(false)
  if (shouldShowModal) {
    markModalAsViewed(shouldShowModal)
  }
}
```

#### 4. Ajouter la modale dans le JSX
```typescript
<IncentiveModalContainer
  modalType={showIncentiveModal ? shouldShowModal : null}
  tournamentId={tournament.id}
  onClose={handleCloseIncentiveModal}
/>
```

---

## 🔄 Flow complet

### Extension de durée
```
Opposition → Il reste 2 journées
    ↓
Modale incitative affichée
    ↓
User clique "Prolonger le tournoi"
    ↓
Redirection Stripe → Paiement
    ↓
Retour sur Opposition (?payment=success&type=duration_extension)
    ↓
Détection du crédit (hasCredit=true)
    ↓
Modale curseur affichée (DurationExtensionModal)
    ↓
User choisit 10 journées
    ↓
API /api/extensions/apply
    ↓
max_matchdays += 10
    ↓
Rechargement page → Journées ajoutées
```

### Extension de capacité
```
Échauffement → Il reste 1 ou 2 places
    ↓
Modale incitative affichée
    ↓
User clique "Ajouter des places"
    ↓
Redirection Stripe → Paiement
    ↓
Webhook applique automatiquement +5 places
    ↓
Retour sur Échauffement (?payment=success&type=player_extension)
    ↓
Rechargement page → Places disponibles
```

### Option stats
```
Opposition → J1 ou J5, J10, J15...
    ↓
Modale incitative affichée (si pas déjà abonné)
    ↓
User clique "Débloquer les stats"
    ↓
Redirection Stripe → Paiement (choix formule)
    ↓
Retour sur Opposition
    ↓
Stats accessibles immédiatement
```

---

## ⚙️ Configuration requise

### 1. Vérifier que les RPC functions existent dans Supabase

- `has_viewed_modal(p_tournament_id, p_modal_type)` → Créé dans migration [`20260205_modal_views_tracking.sql`](../supabase/migrations/20260205_modal_views_tracking.sql:72)
- `mark_modal_as_viewed(p_tournament_id, p_modal_type)` → Créé dans migration [`20260205_modal_views_tracking.sql`](../supabase/migrations/20260205_modal_views_tracking.sql:48)
- `use_purchase_credit(p_user_id, p_purchase_type, p_tournament_id)` → Créé dans migration [`add_purchase_credits_tracking.sql`](../supabase/migrations/add_purchase_credits_tracking.sql:124)

### 2. Ajouter les variables Stripe dans `.env.local`

```bash
# Stripe (mode test d'abord)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs des produits
NEXT_PUBLIC_STRIPE_PRICE_DURATION_EXTENSION=price_...
NEXT_PUBLIC_STRIPE_PRICE_PLAYER_EXTENSION=price_...
NEXT_PUBLIC_STRIPE_PRICE_STATS_LIFETIME=price_...
```

### 3. Créer les produits dans Stripe Dashboard

Voir [`GUIDE_IMPLEMENTATION_MODALES.md`](./GUIDE_IMPLEMENTATION_MODALES.md#2-créer-les-produits-dans-stripe-dashboard)

---

## 🧪 Tester

### Mode debug (sans conditions)
```javascript
// Dans la console
window.debugShowModal('duration_extension')
window.debugShowModal('player_extension_2_1')
window.debugShowModal('stats_option')
```

### Mode réel
1. **Extension durée** : Avance le tournoi jusqu'à 2 journées restantes
2. **Extension capacité** : Invite des joueurs jusqu'à 1-2 places restantes
3. **Stats** : Démarre un tournoi et va à la journée 1

---

## 🐛 Dépannage

### La modale ne s'affiche pas
- Vérifier les conditions dans `use-incentive-modals.ts`
- Vérifier que `user_modal_views` n'a pas déjà un enregistrement
- Vérifier dans la console les logs du hook

### Erreur "has_viewed_modal is not a function"
- La migration n'a pas été exécutée
- Lancer : `npx supabase db reset` (en local) ou migrer sur Supabase Cloud

### Le crédit ne se consomme pas
- Vérifier que l'API `/api/extensions/apply` retourne sans erreur
- Vérifier dans `tournament_purchases` que `used=false` avant l'appel

---

## ✅ Checklist finale

Avant de pousser en prod :

- [ ] Les 3 hooks sont créés et testés
- [ ] Les 2 composants de modales sont créés
- [ ] Integration dans OppositionClient
- [ ] Integration dans Échauffement
- [ ] Variables Stripe configurées
- [ ] Produits Stripe créés avec les bons Price IDs
- [ ] Webhook Stripe configuré
- [ ] Tests manuels des 3 flows complets
- [ ] Vérification que les modales ne s'affichent qu'une fois
- [ ] Badge "MODE DEBUG" retiré du `DebugModalContainer` (ou ne pas l'utiliser en prod)
