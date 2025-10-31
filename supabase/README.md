# Configuration de la base de données Supabase

## Exécution du schéma

1. Allez sur votre projet Supabase : https://supabase.com/dashboard
2. Sélectionnez votre projet PronoHub
3. Dans le menu de gauche, cliquez sur "SQL Editor"
4. Cliquez sur "New query"
5. Copiez tout le contenu du fichier `schema.sql`
6. Collez-le dans l'éditeur SQL
7. Cliquez sur "Run" (ou appuyez sur Ctrl+Enter)

Le script va créer :
- ✅ Table `profiles` - Profils utilisateurs
- ✅ Table `tournaments` - Tournois
- ✅ Table `tournament_participants` - Participants aux tournois
- ✅ Table `matches` - Matchs
- ✅ Table `predictions` - Pronostics
- ✅ Index pour les performances
- ✅ Fonctions utilitaires (génération de code d'invitation, etc.)
- ✅ Triggers automatiques (mise à jour des compteurs, timestamps)
- ✅ Row Level Security (RLS) - Sécurité des données

## Structure des tables

### profiles
Extension du système d'authentification de Supabase
- id, username, email, avatar_url
- Lié automatiquement à auth.users

### tournaments
Informations sur les tournois
- Configuration (nombre de participants, journées, etc.)
- Code d'invitation unique
- Règles de scoring personnalisables

### tournament_participants
Relation many-to-many entre users et tournaments
- Compteur de points
- Classement

### matches
Matchs d'un tournoi
- Données synchronisées avec Football-Data API
- Scores réels une fois les matchs terminés

### predictions
Pronostics des utilisateurs
- Ne peuvent être modifiés qu'avant le début du match
- Points calculés automatiquement après le match

## Sécurité (RLS)

Les politiques de sécurité garantissent que :
- Les utilisateurs ne peuvent voir que leurs propres pronostics
- Seuls les créateurs de tournois peuvent les modifier
- Les pronostics ne peuvent plus être modifiés après le début du match
- Tout le monde peut voir les tournois publics

## Vérification

Pour vérifier que tout s'est bien passé :
1. Allez dans "Table Editor" dans le menu de gauche
2. Vous devriez voir 5 tables : profiles, tournaments, tournament_participants, matches, predictions
3. Cliquez sur chaque table pour voir sa structure

## Prochaines étapes

Une fois le schéma créé, vous pouvez :
1. Tester l'inscription d'utilisateurs
2. Créer des tournois
3. Ajouter des participants
4. Créer des matchs et pronostics
