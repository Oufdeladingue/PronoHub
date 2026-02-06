# 🧪 Guide de Test - Modales Incitatives

## ✅ Serveur lancé

Le serveur de développement est en cours de démarrage sur `http://localhost:3000`

Attends quelques secondes et ouvre ton navigateur sur cette URL.

---

## 📋 Tests individuels

### Test 1 : Modale Extension de Durée 🔥

**Objectif** : Vérifier le visuel de la modale "La saison est trop courte ? Prolonge-la."

**Étapes** :

1. Ouvre ton navigateur sur `http://localhost:3000`

2. Appuie sur **F12** pour ouvrir la console

3. Colle cette commande dans la console et appuie sur Entrée :
   ```javascript
   window.debugShowModal('duration_extension')
   ```

4. **Vérifications** :
   - ✅ Background orange avec effet de feu
   - ✅ Badge "MODE DEBUG" en haut
   - ✅ Titre : "La saison est trop courte ? Prolonge-la."
   - ✅ Image centrale : calendrier avec trophée
   - ✅ Texte : "Ton tournoi arrive touche à sa fin..."
   - ✅ Bouton orange : "🔥 Prolonger le plaisir"
   - ✅ Sous-texte : "Plus de journée, plus de points, plus de suspense"

5. Pour fermer, clique sur la croix en haut à droite OU tape :
   ```javascript
   window.debugHideModal()
   ```

---

### Test 2 : Modale Extension de Capacité 👥 (2-1 places)

**Objectif** : Vérifier le visuel de la modale "Ton tournoi va se jouer à guichets fermés"

**Étapes** :

1. Dans la console, colle cette commande :
   ```javascript
   window.debugShowModal('player_extension_2_1')
   ```

2. **Vérifications** :
   - ✅ Même background orange
   - ✅ Titre : "Ton tournoi va se jouer à guichets fermés"
   - ✅ Image centrale : groupe de joueurs avec trophée
   - ✅ Texte : "Passe à l'extension pour inviter encore plus de joueurs..."
   - ✅ Bouton orange : "👥 Ajouter des places"
   - ✅ Sous-texte : "Plus de joueurs = plus de fun"

3. Ferme la modale (croix ou `window.debugHideModal()`)

---

### Test 3 : Modale Extension de Capacité 👥 (0 places)

**Objectif** : Vérifier que c'est le même visuel que Test 2 (même texte pour 0 ou 2-1 places)

**Étapes** :

1. Dans la console :
   ```javascript
   window.debugShowModal('player_extension_0')
   ```

2. **Vérifications** :
   - ✅ Exactement le même visuel que Test 2
   - ✅ Titre : "Ton tournoi va se jouer à guichets fermés"
   - ✅ Image : groupe de joueurs
   - ✅ Bouton : "👥 Ajouter des places"

3. Ferme la modale

---

### Test 4 : Modale Option Stats 📊

**Objectif** : Vérifier le visuel de la modale "Les rois jouent… les stratèges gagnent."

**Étapes** :

1. Dans la console :
   ```javascript
   window.debugShowModal('stats_option')
   ```

2. **Vérifications** :
   - ✅ Même background orange
   - ✅ Titre : "Les rois jouent… les stratèges gagnent."
   - ✅ Image centrale : personnage avec tableau tactique
   - ✅ Texte : "Débloque les statistiques avancées et les tendances..."
   - ✅ Bouton orange : "📊 Débloquer les stats"
   - ✅ Sous-texte : "Une option oubliée par Raymond Domenech..."

3. Ferme la modale

---

## 🎨 Points de vérification design

Pour chaque modale, vérifie :

- [ ] Le background orange avec effet de feu est bien visible
- [ ] L'image centrale est bien nette et centrée
- [ ] Les textes sont lisibles (blanc sur fond sombre)
- [ ] Le bouton orange ressort bien
- [ ] Le sous-texte en gris/blanc transparent est visible mais discret
- [ ] La croix de fermeture (X) en haut à droite fonctionne
- [ ] Sur mobile (réduire la fenêtre) : tout reste lisible et centré

---

## 🔄 Test rapide de toutes les modales

Si tu veux tester rapidement les 4 modales l'une après l'autre :

```javascript
// Modale 1 - Extension durée
window.debugShowModal('duration_extension')
// Attends 2-3 secondes, regarde, puis ferme

// Modale 2 - Extension capacité (2-1 places)
window.debugShowModal('player_extension_2_1')
// Attends, regarde, ferme

// Modale 3 - Extension capacité (0 places)
window.debugShowModal('player_extension_0')
// Attends, regarde, ferme

// Modale 4 - Stats
window.debugShowModal('stats_option')
// Attends, regarde, ferme
```

---

## 📱 Test responsive (mobile)

1. Ouvre les DevTools (F12)
2. Clique sur l'icône de téléphone (mode responsive)
3. Sélectionne "iPhone 12 Pro" ou "Pixel 5"
4. Teste chaque modale avec les commandes ci-dessus
5. Vérifie que tout reste bien centré et lisible

---

## ❌ Fermer toutes les modales

Si une modale reste bloquée :
```javascript
window.debugHideModal()
```

Ou simplement clique sur le fond noir transparent derrière la modale.

---

## 🐛 Problèmes potentiels

### La modale ne s'affiche pas
- Vérifie que le serveur tourne bien sur http://localhost:3000
- Recharge la page (Ctrl+R ou Cmd+R)
- Vérifie dans la console qu'il n'y a pas d'erreurs

### Les images ne s'affichent pas
- Vérifie que les fichiers sont bien dans `public/images/modals/`:
  - purchase-bg.png
  - calendar-ext.png
  - capacity-ext.png
  - stats-ext.png

### Le background est noir au lieu d'orange avec feu
- C'est peut-être normal si purchase-bg.png a un fond noir
- Vérifie le fichier dans `public/images/modals/purchase-bg.png`

---

## ✅ Checklist finale

Après avoir testé les 4 modales :

- [ ] Les 4 modales s'affichent correctement
- [ ] Les images centrales sont bien visibles
- [ ] Les textes sont tous corrects (titre, description, bouton, sous-texte)
- [ ] Le bouton orange ressort bien
- [ ] La croix de fermeture fonctionne
- [ ] Le design est fidèle aux visuels fournis
- [ ] Aucune erreur dans la console
- [ ] Responsive OK sur mobile

---

## 🎉 Si tout fonctionne

Les modales sont prêtes ! Prochaines étapes :

1. Intégrer la logique de déclenchement automatique
2. Lier les boutons aux vrais achats Stripe
3. Tracker les vues avec `user_modal_views`
4. Tester en conditions réelles

---

## 💬 Feedback

Si quelque chose ne va pas :
- Note ce qui ne va pas (titre, image, couleur, etc.)
- Fais une capture d'écran si possible
- Je corrigerai immédiatement
