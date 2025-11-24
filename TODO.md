# 📋 TODO Liste PronoHub

Liste des fonctionnalités et améliorations à développer pour PronoHub.

---

## 🎨 Interface & UX

- [ ] **Site responsive**
  - Adapter toutes les pages pour mobile/tablette
  - Tester sur différentes tailles d'écran
  - Menu hamburger pour mobile

- [ ] **Déconnexion / Accueil : visible à l'écran**
  - Bouton de déconnexion accessible dans le header
  - Lien retour à l'accueil
  - Menu de navigation clair et visible
  - Confirmation avant déconnexion

- [ ] **Modification des loaders**
  - Remplacer les loaders par défaut
  - Créer un loader personnalisé avec le logo PronoHub
  - Animations de chargement cohérentes

- [ ] **Modification des icônes et couleurs**
  - Harmoniser la charte graphique
  - Créer un design system cohérent
  - Icônes personnalisées pour toutes les actions

- [ ] **Mode "sombre"**
  - Implémenter un thème sombre
  - Toggle pour basculer entre clair/sombre
  - Sauvegarder la préférence utilisateur

- [ ] **Appellations et termes pour coller au thème**
  - Remplacer "tournoi" par des termes football
  - Utiliser vocabulaire foot cohérent partout
  - Exemples : "vestiaire", "échauffement", "flocage", etc.
  - Créer un glossaire des termes utilisés

- [ ] **Section explicative sur la page d'accueil**
  - Ajouter des screenshots de l'application
  - Expliquer les fonctionnalités principales
  - Section "Comment ça marche ?" avec étapes
  - Badges Google Play et App Store
  - Liens de téléchargement des applications

- [ ] **Footer avec mentions légales**
  - CGV (Conditions Générales de Vente)
  - CGU (Conditions Générales d'Utilisation)
  - Page de contact
  - Mentions légales
  - Politique de confidentialité
  - Copyright et année

---

## ⚽ Fonctionnalités Pronostics

- [ ] **Affichage des matchs dans l'espace prono**
  - Liste des matchs à venir
  - Affichage des scores en direct
  - Historique des matchs terminés
  - Filtres par compétition/date

- [ ] **Gestion de l'heure limite du prono**
  - Bloquer les pronostics après le coup d'envoi
  - Afficher un compte à rebours
  - Notifications avant la deadline
  - Gestion des fuseaux horaires

- [ ] **Règle si un joueur oublie de pronostiquer**
  - Décider du score par défaut (0-0 ?)
  - Option : score moyen des autres joueurs ?
  - Option : pénalité de points ?
  - Notifier le joueur avant la deadline

- [ ] **Écran de confirmation après rejoindre un tournoi**
  - Page de confirmation avec détails du tournoi
  - Informations sur les participants
  - Prochains matchs à pronostiquer
  - Bouton pour accéder au vestiaire

---

## 🏆 Calcul des Points & Bonus

- [ ] **Système de calcul des points**
  - Définir les règles de points (score exact, bon résultat, etc.)
  - Implémenter la logique de calcul
  - Historique des points par match
  - Classement temps réel

- [ ] **Gestion des bonus**
  - Bonus pour série de bons pronos
  - Bonus pour score exact
  - Bonus pour pronostic risqué
  - Système de multiplicateurs

---

## 📧 Emails & Notifications

- [ ] **Gestion des emails et notifications**
  - Email de bienvenue après inscription
  - Rappel avant deadline de pronostic
  - Notification des résultats
  - Récap hebdomadaire du classement
  - Notifications push (web/app)

- [ ] **Alerte quota inscriptions/capacité BDD/mails**
  - Monitoring de l'usage Supabase
  - Alerte à 80% du quota
  - Dashboard admin avec métriques
  - Système d'alertes automatiques

---

## 💰 Monétisation

- [ ] **Mise en place formule payante**
  - Définir les plans (gratuit/premium/pro)
  - Intégration Stripe/PayPal
  - Page de tarification
  - Gestion des abonnements
  - Limites par plan :
    - Gratuit : 8 participants max
    - Premium : participants illimités, statistiques avancées
    - Pro : tournois privés, personnalisation avancée

- [ ] **Sécurisation dashboard et accès liste joueurs gratuits/payants**
  - Middleware pour vérifier le plan utilisateur
  - Protection des routes premium
  - Affichage conditionnel des fonctionnalités
  - Message d'upgrade pour fonctionnalités payantes

---

## 💳 Paiement (Stripe)

- [ ] **Configurer Stripe pour la mise en ligne**
  - Actuellement Stripe est désactivé pour le développement local
  - Étapes pour activer Stripe :
    1. Créer un compte Stripe et récupérer les clés API
    2. Installer les dépendances : `npm install stripe @stripe/stripe-js`
    3. Configurer les variables d'environnement :
       - `STRIPE_SECRET_KEY`
       - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
       - `STRIPE_WEBHOOK_SECRET`
       - `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_PRICE_ONESHOT`, `STRIPE_PRICE_ENTERPRISE`
    4. Réactiver les imports dans les fichiers :
       - `lib/stripe.ts` : décommenter l'import Stripe et l'instance
       - `lib/stripe-client.ts` : décommenter loadStripe
       - `app/api/stripe/webhook/route.ts` : décommenter l'import Stripe et restaurer les types
    5. Créer les produits et prix dans le dashboard Stripe
    6. Configurer le webhook Stripe pour pointer vers `/api/stripe/webhook`

---

## 🔐 Sécurité & Performance

- [ ] **Webhook automatique pour les trophées**
  - Actuellement le recalcul des trophées se fait à la demande (bouton "Actualiser")
  - Créer un webhook/trigger Supabase qui recalcule automatiquement après chaque fin de match
  - Implémentation suggérée :
    1. Créer une Supabase Edge Function pour le recalcul des trophées
    2. Créer un trigger PostgreSQL sur `imported_matches` (UPDATE sur status = 'FINISHED')
    3. Le trigger appelle la Edge Function qui recalcule pour tous les participants concernés
  - Cela permettrait aux utilisateurs de voir leurs trophées sans action manuelle

- [ ] **Cache des statistiques utilisateur**
  - Même approche que les trophées : stocker en BDD plutôt que recalculer
  - Recalculer automatiquement après chaque fin de match via webhook

- [ ] **Optimisation appel API football-data**
  - Cache des résultats (Redis ou Supabase)
  - Limitation des appels API
  - Cron job pour mise à jour automatique
  - Fallback en cas d'erreur API
  - Gestion du quota gratuit (10 requêtes/minute)

- [ ] **SEO (balises title, meta-description...)**
  - Balises meta pour toutes les pages
  - Open Graph pour partage réseaux sociaux
  - Sitemap.xml
  - Robots.txt
  - Descriptions uniques par page
  - Mots-clés pertinents

---

## 📱 Applications Mobiles

- [ ] **Passage en appli Android et iOS**
  - Choisir la techno :
    - React Native (Expo)
    - Flutter
    - PWA (Progressive Web App)
  - Adapter l'UI pour mobile natif
  - Notifications push natives
  - Publication sur stores (Google Play, App Store)

---

## 🚀 Futures Idées

- [ ] **Système de paris amicaux**
  - Paris entre amis (sans argent réel)
  - Système de jetons virtuels
  - Défis entre joueurs

- [ ] **Statistiques avancées**
  - Graphiques de progression
  - Comparaison avec les autres joueurs
  - Prédictions IA basées sur l'historique

- [ ] **Chat intégré**
  - Chat par tournoi
  - Réactions sur les pronostics
  - Trash-talk amical

- [ ] **Personnalisation**
  - Avatar personnalisé
  - Badge de récompenses
  - Thèmes de maillots personnalisables

---

## 📝 Notes

Pour ajouter un nouveau point à cette TODO liste :
1. Ouvrir `TODO.md`
2. Ajouter `- [ ]` suivi de votre tâche
3. Placer la tâche dans la section appropriée
4. Si besoin, créer une nouvelle section avec `## 🎯 Nom de la Section`

**Légende** :
- `- [ ]` : Tâche à faire
- `- [x]` : Tâche terminée
- `- [~]` : Tâche en cours

---

**Dernière mise à jour** : 05/11/2025
