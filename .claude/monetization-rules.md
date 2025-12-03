# Monetisation PronoHub - Resume des regles

> **Source de verite : `.claude/monetization-rules.json`**
> Ce fichier .md est un resume lisible. En cas de doute, toujours se referer au JSON.

## Variables

| Variable | Description |
|----------|-------------|
| `freekick_count` | Nombre de tournois Free-Kick actifs pour l'utilisateur |
| `premium_guest_count` | Nombre de tournois One-Shot/Elite-Team ou l'user est invite (pas captain) |
| `current_players_in_tournament` | Nombre de joueurs deja dans le tournoi (pour Platinum Prepaid) |

## Types de tournoi

| Type | Max joueurs | Max journees |
|------|-------------|--------------|
| FREE_KICK | 5 | 10 |
| ONE_SHOT | 10 | illimite |
| ELITE_TEAM | 20 | illimite |
| PLATINUM | 30 | illimite |
| PLATINUM_PREPAID_11 | 11 (base) / 30 (max) | illimite |

## Regles JOIN (rejoindre)

| Tournoi | Condition | Prix |
|---------|-----------|------|
| FREE_KICK | freekick_count < 2 | 0.00 EUR |
| FREE_KICK | freekick_count >= 2 | 0.99 EUR |
| ONE_SHOT | premium_guest_count == 0 | 0.00 EUR |
| ONE_SHOT | premium_guest_count >= 1 | 0.99 EUR |
| ELITE_TEAM | premium_guest_count == 0 | 0.00 EUR |
| ELITE_TEAM | premium_guest_count >= 1 | 0.99 EUR |
| PLATINUM | toujours | 6.99 EUR |
| PLATINUM_PREPAID_11 | current_players < 11 | 0.00 EUR |
| PLATINUM_PREPAID_11 | current_players >= 11 | 6.99 EUR |

**Note:** Pour ONE_SHOT/ELITE_TEAM, la premiere invitation est gratuite. Si l'user est deja invite dans un tournoi premium actif, il doit payer 0.99 EUR pour en rejoindre un autre.

## Regles CREATE (creer)

| Tournoi | Condition | Prix |
|---------|-----------|------|
| FREE_KICK | freekick_count < 2 | 0.00 EUR |
| FREE_KICK | freekick_count >= 2 | 0.99 EUR |
| ONE_SHOT | toujours | 4.99 EUR |
| ELITE_TEAM | toujours | 9.99 EUR |
| PLATINUM | toujours | 9.99 EUR |
| PLATINUM_PREPAID_11 | toujours | 69.20 EUR |

## Extensions (FREE_KICK uniquement)

| Action | Prix |
|--------|------|
| EXTEND_DURATION | 3.99 EUR |
| EXTEND_PLAYERS | 1.99 EUR |
