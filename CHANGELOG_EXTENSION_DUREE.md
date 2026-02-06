# Changelog - Système d'Extension de Durée

## 🎯 Objectifs

1. ✅ Lier les achats d'extension au tournoi spécifique
2. ✅ Permettre de choisir le nombre de journées à ajouter
3. ✅ Afficher une modale de sélection après paiement
4. ✅ Créer un système de debug pour tester les futures modales incitatives

## 📅 Date : 5 février 2026

## ✅ Modifications apportées

### 1. Base de données

#### Table `tournament_purchases`
- Déjà existante avec les colonnes nécessaires :
  - `tournament_id` : ID du tournoi lié à l'achat
  - `used` : Boolean pour savoir si le crédit a été utilisé
  - `used_at` : Date d'utilisation
  - `used_for_tournament_id` : ID du tournoi où le crédit a été utilisé

#### Nouvelle table `user_modal_views`
```sql
CREATE TABLE user_modal_views (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  tournament_id UUID REFERENCES tournaments(id),
  modal_type TEXT CHECK (modal_type IN (
    'stats_option',
    'player_extension_2_1',
    'player_extension_0',
    'duration_extension'
  )),
  viewed_at TIMESTAMPTZ,
  UNIQUE(user_id, tournament_id, modal_type)
);
```

**Fichier** : `supabase/migrations/20260205_modal_views_tracking.sql`

### 2. API Backend

#### `app/api/tournaments/extend-duration/route.ts`
**Modifié** (lignes 106-117 et 296-304) :
- Ajout du filtre `.eq('tournament_id', tournamentId)` pour vérifier que le crédit est bien lié au tournoi
- Sécurité : un utilisateur ne peut pas utiliser un crédit acheté pour le tournoi A sur le tournoi B

**Avant** :
```typescript
.eq('purchase_type', 'duration_extension')
.eq('status', 'completed')
.eq('used', false)
```

**Après** :
```typescript
.eq('purchase_type', 'duration_extension')
.eq('status', 'completed')
.eq('used', false)
.eq('tournament_id', tournamentId) // 🔒 SÉCURITÉ
```

### 3. Frontend

#### Nouveau composant : `components/modals/DurationExtensionSelectorModal.tsx`
- Modale avec curseur pour choisir le nombre de journées
- Non utilisé finalement car `DurationExtensionBanner.tsx` a déjà sa propre modale intégrée
- Peut servir de référence pour d'autres modales

#### Composant existant : `components/DurationExtensionBanner.tsx`
- Déjà en place avec modale de sélection (lignes 252-351)
- Déjà détecte `?extend=true` pour ouvrir la modale automatiquement (lignes 70-78)
- Aucune modification nécessaire ✅

#### Page de succès : `app/payment/success/page.tsx`
- Déjà en place avec le bouton "Choisir la durée" (lignes 218-224)
- Aucune modification nécessaire ✅

### 4. Système de Debug

#### Nouveau fichier : `lib/debug-modals.ts`
Expose des fonctions globales dans `window` :
```javascript
window.debugShowModal('duration_extension')
window.debugShowModal('player_extension_2_1')
window.debugShowModal('player_extension_0')
window.debugShowModal('stats_option')
window.debugHideModal()
```

#### Nouveau composant : `components/modals/DebugModalContainer.tsx`
- Écoute les events de debug
- Affiche les modales factices avec un badge "MODE DEBUG"
- Permet de tester le design avant d'implémenter la vraie logique

#### `app/layout.tsx`
**Modifié** :
- Import du `DebugModalContainer`
- Ajout dans le JSX avant `</PushNotificationsProvider>`

### 5. Documentation

#### `docs/DURATION_EXTENSION_SYSTEM.md`
- Explication complète du système
- Flow détaillé
- Fichiers concernés
- Instructions de test
- Vérifications de sécurité

#### `docs/TESTING_GUIDE.md`
- Guide pas à pas pour tester
- Commandes SQL pour vérifier en base
- Liste des assets à fournir
- Questions à clarifier

## 🔄 Flow complet

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER sur /vestiaire/{tournamentId}                      │
│    - Voit le DurationExtensionBanner                       │
│    - Clique "Prolonger pour 3,99€"                         │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. API /api/stripe/create-checkout-session                 │
│    - Crée une session Stripe                               │
│    - Enregistre dans tournament_purchases avec             │
│      tournament_id = {tournamentId} 🔑                     │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. STRIPE Checkout                                         │
│    - Paiement de 3,99€                                     │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. API /api/stripe/verify-session                          │
│    - Marque le purchase comme completed                    │
│    - Retourne nextAction: 'choose_extension'               │
│    - Retourne redirectUrl: '/vestiaire/{id}?extend=true'   │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. /payment/success                                        │
│    - Affiche "Paiement réussi"                            │
│    - Bouton "Choisir la durée" → redirectUrl               │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. /vestiaire/{tournamentId}?extend=true                   │
│    - DurationExtensionBanner détecte ?extend=true           │
│    - Ouvre la modale automatiquement                       │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. MODALE avec curseur                                     │
│    - User choisit entre 1 et max_available journées        │
│    - Clique "Confirmer"                                    │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. API /api/tournaments/extend-duration (POST)             │
│    - Vérifie que credit.tournament_id == tournamentId 🔒   │
│    - Applique l'extension                                  │
│    - Marque le crédit comme used                           │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. SUCCESS                                                 │
│    - Tournoi prolongé de X journées                        │
│    - Page recharge → Banner disparaît                      │
└─────────────────────────────────────────────────────────────┘
```

## 🔒 Sécurité

### Backend
- ✅ Vérification que `credit.tournament_id === tournamentId`
- ✅ Vérification que `credit.used === false`
- ✅ Vérification que `credit.status === 'completed'`
- ✅ Un utilisateur ne peut pas "voler" le crédit d'un autre tournoi

### Frontend
- ✅ Le paramètre `?extend=true` ne fait qu'ouvrir la modale
- ✅ Toutes les vérifications métier se font côté serveur
- ✅ L'UI affiche seulement les infos, ne fait pas de décisions critiques

## 🧪 Tests à effectuer

### Test 1 : Flow nominal
1. Aller sur tournoi Free-Kick actif
2. Cliquer "Prolonger"
3. Payer 3,99€ (carte test Stripe)
4. Vérifier redirection vers tournoi avec `?extend=true`
5. Vérifier ouverture automatique modale
6. Choisir 5 journées
7. Confirmer
8. Vérifier que tournoi est prolongé

### Test 2 : Sécurité cross-tournament
1. Acheter extension pour tournoi A
2. Vérifier en BDD : `tournament_id = A`
3. Aller sur tournoi B
4. Banner ne doit PAS dire "Vous avez un crédit"
5. Tenter quand même via API directe
6. Doit échouer avec erreur "Aucun crédit disponible"

### Test 3 : Debug modals
```javascript
window.debugShowModal('duration_extension')
window.debugShowModal('player_extension_2_1')
window.debugShowModal('player_extension_0')
window.debugShowModal('stats_option')
window.debugHideModal()
```

## 📝 À faire ensuite

1. **Recevoir les assets** de l'utilisateur :
   - Background commun pour les modales
   - Textes pour les 4 modales
   - Icônes/visuels

2. **Implémenter les vraies modales incitatives** :
   - Modale stats (trigger: tous les 3 matchdays sur onglet Classement)
   - Modale player extension 2-1 (trigger: 2 ou 1 places restantes sur Échauffement)
   - Modale player extension 0 (trigger: tournoi complet)
   - Modale duration extension (trigger: 2 journées restantes)

3. **Implémenter le tracking des vues** :
   - Appeler `mark_modal_as_viewed()` quand une modale s'affiche
   - Vérifier `has_viewed_modal()` avant d'afficher

4. **Tests finaux** :
   - Sur mobile (responsive)
   - Avec plusieurs users simultanés
   - Vérifier que les modales ne s'affichent qu'une fois par tournoi

## ⚠️ Notes importantes

- Le crédit d'extension est **mono-usage** et **lié à UN SEUL tournoi**
- Les modales incitatives sont trackées **PAR TOURNOI** (pas globalement)
- Le système de debug est **permanent** (pas besoin de l'activer)
- Les migrations Supabase doivent être appliquées manuellement

## 🎉 Résultat

Système d'extension de durée flexible avec choix du nombre de journées ✅
Sécurité renforcée avec liaison tournoi-crédit ✅
Système de debug prêt pour tester les futures modales ✅
Documentation complète pour faciliter les tests ✅
