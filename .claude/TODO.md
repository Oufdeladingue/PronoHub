# PronoHub - Liste des tâches à faire

Ce fichier doit être lu au début de chaque session de travail.

## Fonctionnalités à implémenter

### Platinium
- [x] Implémentation des slots payés en Platinium
- [x] Implémentation du cadeau dans les règles du Platinium
- [x] Remise Platinium codée en dur et non récupérée depuis l'admin (à corriger)

### Nouveaux types de tournois
- [x] Création de tournoi "Les plus belles affiches"
- [ ] Création de tournoi "Open" à un grand nombre (avec lot)
- [ ] Création des tournois ponctuels type Coupe du Monde

### Compétitions et données
- [ ] Implémentation des mises à jour auto des compétitions (simplifications et cron)

### Règles et scoring
- [ ] Nouvelles règles bonus

### Paiements
- [x] Ajout des clés publiques Stripe (compte activé)
- [ ] Implémentation Stripe et tests
- [ ] Configurer webhook Stripe en production
- [ ] Passer en mode live quand prêt

### Trophées
- [x] Simplification calcul trophées
- [x] Ajout nouveaux trophées :
  - [x] L'ultra-dominateur : être premier à chaque journée du tournoi
  - [x] La lanterne-rouge : être dernier à une journée
  - [x] La spirale infernale : être dernier deux journées de suite
  - [x] L'abyssal : être dernier d'un tournoi
  - [x] Le Poulidor : aucune première place sur les journées d'un tournoi
  - [x] Le maudit : aucun bon résultat sur une journée
  - [x] La légende : vainqueur d'un tournoi à plus de 10 joueurs
- [x] Avatars trophées : les utilisateurs peuvent utiliser un trophée débloqué comme avatar

### Bugs à corriger
- [x] Bug ninja-footer sur la page "profile"

### Performance
- [x] Accélération chargement stats

### Gestion d'équipes
- [x] Système de demandes d'équipe (postuler à une équipe existante)
- [x] Système de suggestions d'équipe (proposer une nouvelle équipe)
- [x] Interface capitaine pour gérer les demandes (approuver/refuser)
- [x] Badge dashboard pour les demandes en attente
- [ ] Notifications email pour les demandes d'équipe

### Fonctionnalités diverses
- [x] Accès aux tournois terminés
- [ ] Gestion des rappels mails

---

*Dernière mise à jour : 9 décembre 2025*
