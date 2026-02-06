# Système d'Extension de Durée - Documentation

## Vue d'ensemble

Le système d'extension de durée permet aux utilisateurs d'étendre la durée de leurs tournois Free-Kick en ajoutant des journées supplémentaires (jusqu'à la fin de la compétition support).

## Fonctionnalités principales

### 1. Achat lié au tournoi spécifique

- ✅ Quand un utilisateur achète une extension de durée, le crédit est **lié au tournoi spécifique**
- ✅ Le crédit ne peut être utilisé **QUE pour ce tournoi**
- ✅ Évite la confusion et les erreurs (utiliser le crédit sur le mauvais tournoi)

### 2. Choix du nombre de journées

- ✅ Après le paiement, l'utilisateur choisit combien de journées ajouter
- ✅ Minimum : 1 journée
- ✅ Maximum : jusqu'à la dernière journée de la compétition (plafonné à 10 journées supplémentaires)
- ✅ Modale avec curseur intuitif

## Flow complet

```
1. Utilisateur clique sur "Prolonger" dans DurationExtensionBanner
   ↓
2. Redirigé vers Stripe (paiement 3,99€)
   ↓
3. Paiement confirmé → Crédit enregistré avec tournament_id
   ↓
4. Redirection vers /vestiaire/{tournamentId}?extend=true
   ↓
5. DurationExtensionBanner détecte ?extend=true
   ↓
6. Modale s'affiche automatiquement avec curseur
   ↓
7. Utilisateur choisit le nombre de journées (1 à max_available)
   ↓
8. Confirmation → API applique l'extension
   ↓
9. Tournoi prolongé ! ✅
```

## Fichiers modifiés

### API
- `app/api/stripe/create-checkout-session/route.ts` : Enregistre le `tournament_id` dans `tournament_purchases`
- `app/api/stripe/verify-session/route.ts` : Retourne `nextAction: 'choose_extension'` et `redirectUrl`
- `app/api/tournaments/extend-duration/route.ts` : Vérifie que le crédit est lié au bon tournoi (ligne 109)

### Composants
- `components/DurationExtensionBanner.tsx` : Gère l'affichage du banner et la modale de sélection
- `components/modals/DurationExtensionSelectorModal.tsx` : Modale avec curseur (créé mais non utilisé, on utilise la modale intégrée au banner)

### Pages
- `app/payment/success/page.tsx` : Affiche le bouton "Choisir la durée" après paiement

### Base de données
- `supabase/migrations/add_purchase_credits_tracking.sql` : Colonnes `tournament_id`, `used`, `used_for_tournament_id`

## Vérifications de sécurité

### Backend (API)
```typescript
// Ligne 109-117 de extend-duration/route.ts
const { data: credit } = await supabase
  .from('tournament_purchases')
  .select('id, tournament_id')
  .eq('user_id', user.id)
  .eq('purchase_type', 'duration_extension')
  .eq('status', 'completed')
  .eq('used', false)
  .eq('tournament_id', tournamentId) // ⚠️ CRITIQUE
  .single()
```

### Frontend (UI)
- Le paramètre `?extend=true` dans l'URL déclenche l'ouverture automatique de la modale
- La modale affiche les infos du tournoi en cours
- L'utilisateur ne peut choisir qu'entre 1 et le nombre max de journées disponibles

## Testing

### Test du flow complet

1. **Dans le navigateur** :
   - Aller sur un tournoi Free-Kick actif
   - Cliquer sur "Prolonger" dans le banner
   - Compléter le paiement Stripe (utiliser une carte test)
   - Vérifier la redirection automatique vers le tournoi
   - Vérifier l'ouverture automatique de la modale
   - Choisir un nombre de journées
   - Confirmer
   - Vérifier que le tournoi est bien prolongé

2. **Vérification en base de données** :
   ```sql
   -- Vérifier que le crédit est lié au tournoi
   SELECT * FROM tournament_purchases
   WHERE user_id = 'USER_ID'
   AND purchase_type = 'duration_extension'
   AND tournament_id = 'TOURNAMENT_ID';

   -- Vérifier que le tournoi est prolongé
   SELECT ending_matchday, num_matchdays, duration_extended
   FROM tournaments
   WHERE id = 'TOURNAMENT_ID';
   ```

### Test des erreurs

1. **Crédit utilisé sur mauvais tournoi** :
   - Acheter extension pour tournoi A
   - Essayer d'utiliser sur tournoi B
   - ❌ Doit échouer avec message "Aucun crédit disponible"

2. **Pas de journées restantes** :
   - Tournoi déjà à la dernière journée de la compétition
   - Banner ne s'affiche pas
   - ✅ Comportement attendu

3. **Crédit déjà utilisé** :
   - Utiliser le crédit une première fois
   - Essayer de l'utiliser à nouveau
   - ❌ Doit échouer (crédit marqué `used: true`)

## Système de debug pour les modales incitatives

### Utilisation

Ouvrir la console du navigateur et taper :

```javascript
// Afficher la modale d'extension de durée
window.debugShowModal('duration_extension')

// Afficher la modale d'extension de joueurs (2-1 places restantes)
window.debugShowModal('player_extension_2_1')

// Afficher la modale d'extension de joueurs (0 places)
window.debugShowModal('player_extension_0')

// Afficher la modale d'option stats
window.debugShowModal('stats_option')

// Fermer la modale
window.debugHideModal()
```

### Fichiers du système de debug

- `lib/debug-modals.ts` : Gestion de l'état des modales de debug
- `components/modals/DebugModalContainer.tsx` : Composant qui affiche les modales
- `app/layout.tsx` : Inclut le DebugModalContainer

### Base de données pour le tracking

- `supabase/migrations/20260205_modal_views_tracking.sql` : Table `user_modal_views`
- Fonctions SQL : `mark_modal_as_viewed()`, `has_viewed_modal()`

## Prochaines étapes

1. ✅ Implémenter les vraies modales incitatives (stats, player_extension)
2. ✅ Intégrer la logique de déclenchement basée sur les conditions métier
3. ✅ Tester le tracking des vues par tournoi
4. 📝 Recevoir les assets visuels (backgrounds, textes) de l'utilisateur
5. 🎨 Finaliser le design des modales avec les vrais assets

## Notes importantes

⚠️ **IMPORTANT** : Le crédit d'extension de durée est **mono-usage** et **lié à un seul tournoi**.

📊 **Tracking** : Les modales incitatives sont trackées PAR TOURNOI (pas globalement par user).

🔒 **Sécurité** : Toutes les vérifications se font côté serveur (API), pas seulement côté client.
