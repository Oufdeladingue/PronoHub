# Guide de Test - Extension de Durée & Modales Debug

## ✅ Ce qui a été fait

### 1. Extension de durée améliorée
- ✅ Crédit d'achat lié au tournoi spécifique
- ✅ Modale de sélection du nombre de journées (curseur)
- ✅ Flow complet de paiement → choix → application
- ✅ Vérifications de sécurité côté serveur

### 2. Système de debug pour modales
- ✅ Fonction `window.debugShowModal()` disponible dans la console
- ✅ 4 types de modales testables
- ✅ Migration base de données pour tracker les vues par tournoi

## 🧪 Comment tester

### Test 1 : Extension de durée (flow complet)

**Prérequis** : Un tournoi Free-Kick actif avec au moins 2 journées restantes

1. **Lancer l'app en dev** :
   ```bash
   npm run dev
   ```

2. **Aller sur la page d'un tournoi Free-Kick** :
   - URL : `http://localhost:3000/vestiaire/TOURNAMENT_ID`

3. **Cliquer sur "Prolonger"** dans le banner orange

4. **Payer avec une carte test Stripe** :
   - Carte : `4242 4242 4242 4242`
   - Date : N'importe quelle date future
   - CVC : N'importe quel 3 chiffres

5. **Vérifier la redirection** :
   - Tu dois revenir sur `/vestiaire/TOURNAMENT_ID?extend=true`

6. **Vérifier l'ouverture automatique de la modale** :
   - La modale avec le curseur doit s'ouvrir automatiquement
   - Tu peux choisir entre 1 et X journées

7. **Choisir le nombre de journées et confirmer**

8. **Vérifier que le tournoi est prolongé** :
   - La page doit recharger
   - Le nombre de journées doit avoir augmenté

### Test 2 : Système de debug des modales

1. **Ouvrir n'importe quelle page de l'app**

2. **Ouvrir la console du navigateur** (F12)

3. **Taper les commandes suivantes** :

```javascript
// Message d'aide s'affiche automatiquement au chargement
// Tu verras les instructions dans la console

// Tester la modale d'extension de durée
window.debugShowModal('duration_extension')

// Tester la modale d'extension de joueurs (2-1 places)
window.debugShowModal('player_extension_2_1')

// Tester la modale d'extension de joueurs (0 places)
window.debugShowModal('player_extension_0')

// Tester la modale d'option stats
window.debugShowModal('stats_option')

// Fermer la modale
window.debugHideModal()
```

4. **Vérifier l'affichage** :
   - Chaque modale doit s'afficher avec un badge "MODE DEBUG"
   - Le design doit être proche du final
   - Les boutons ne font rien (c'est juste pour tester le visuel)

### Test 3 : Vérifier que le crédit est bien lié au tournoi

1. **Acheter une extension pour le tournoi A**

2. **Ouvrir pgAdmin ou DBeaver** et se connecter à Supabase

3. **Exécuter cette requête** :
```sql
SELECT
  tp.id,
  tp.user_id,
  tp.tournament_id,
  tp.purchase_type,
  tp.used,
  t.name as tournament_name
FROM tournament_purchases tp
LEFT JOIN tournaments t ON t.id = tp.tournament_id
WHERE tp.purchase_type = 'duration_extension'
ORDER BY tp.created_at DESC
LIMIT 5;
```

4. **Vérifier** :
   - ✅ La colonne `tournament_id` doit contenir l'ID du tournoi A
   - ✅ La colonne `used` doit être `false` au début
   - ✅ Après utilisation, `used` doit être `true`

5. **Tenter d'utiliser le crédit sur un autre tournoi B** :
   - Aller sur tournoi B
   - Le banner ne doit PAS dire "vous avez un crédit"
   - Si on tente quand même via l'API, ça doit échouer

## 📊 Vérifier la migration Supabase

### Appliquer la migration

```bash
# Option 1 : Via Supabase CLI (si installé)
npx supabase db push

# Option 2 : Manuellement dans pgAdmin/DBeaver
# Copier-coller le contenu de :
# supabase/migrations/20260205_modal_views_tracking.sql
```

### Vérifier que la table existe

```sql
-- Doit retourner la structure de la table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_modal_views';

-- Doit lister 4 types de modales
SELECT unnest(enum_range(NULL::text)) AS modal_types
FROM (
  SELECT constraint_name
  FROM information_schema.table_constraints
  WHERE table_name = 'user_modal_views'
  AND constraint_type = 'CHECK'
) AS constraints;
```

## 🎨 Prochaine étape : Assets visuels

Pour finaliser les modales incitatives, il faut que tu me fournisses :

### 1. Image de fond commune
- Format : PNG ou JPG
- Résolution recommandée : 800x600px minimum
- Emplacement : `public/images/modals/purchase-bg.png`

### 2. Textes pour chaque modale

**Modale 1 : Stats option** (déclenchée tous les 3 matchdays sur onglet Classement)
```
Titre : ???
Sous-titre : ???
Description : ???
Prix : 0,99€ (déjà en place)
Texte bouton : ???
```

**Modale 2 : Extension joueurs (2-1 places)** (one-time, page Échauffement)
```
Titre : ???
Sous-titre : ???
Description : ???
Prix : 1,99€ (déjà en place)
Texte bouton : ???
```

**Modale 3 : Extension joueurs (0 places)** (one-time, tournoi complet)
```
Titre : ???
Sous-titre : ???
Description : ???
Prix : 1,99€ (déjà en place)
Texte bouton : ???
```

**Modale 4 : Extension durée** (one-time, 2 journées restantes)
```
Titre : ???
Sous-titre : ???
Description : ???
Prix : 3,99€ (déjà en place)
Texte bouton : ???
```

### 3. Icônes/Visuels
- Icône pour chaque modale (si différent du fond commun)
- Format : SVG de préférence

## ❓ Questions à clarifier

1. **Extension de durée** :
   - Le système actuel permet de choisir entre 1 et max_available journées
   - C'est bien ce que tu veux ?

2. **Modales incitatives** :
   - Tu confirmes les 4 triggers :
     - Stats : tous les 3 matchdays (repeatable)
     - Player extension 2-1 : une fois par tournoi
     - Player extension 0 : une fois par tournoi
     - Duration extension : une fois par tournoi quand il reste 2 journées

3. **Tracking** :
   - Les vues sont trackées PAR TOURNOI (un user peut revoir la même modale dans un autre tournoi)
   - OK pour toi ?

## 🐛 Problèmes connus / À vérifier

- [ ] Vérifier que le banner d'extension ne s'affiche plus une fois l'extension appliquée
- [ ] Tester le comportement quand il ne reste plus de journées dans la compétition
- [ ] Vérifier le mobile (responsive de la modale)
- [ ] Tester avec plusieurs utilisateurs simultanés

## 📝 Fichiers créés/modifiés

### Nouveaux fichiers
- `components/modals/DurationExtensionSelectorModal.tsx` (créé mais non utilisé, le banner a déjà sa modale)
- `components/modals/DebugModalContainer.tsx`
- `lib/debug-modals.ts`
- `supabase/migrations/20260205_modal_views_tracking.sql`
- `docs/DURATION_EXTENSION_SYSTEM.md`
- `docs/TESTING_GUIDE.md` (ce fichier)

### Fichiers modifiés
- `app/layout.tsx` (ajout du DebugModalContainer)
- `app/api/tournaments/extend-duration/route.ts` (vérification tournament_id)

### Fichiers à vérifier
- `components/DurationExtensionBanner.tsx` (déjà existant avec modale intégrée)
- `app/api/stripe/create-checkout-session/route.ts` (déjà en place)
- `app/api/stripe/verify-session/route.ts` (déjà en place)
- `app/payment/success/page.tsx` (déjà en place)
