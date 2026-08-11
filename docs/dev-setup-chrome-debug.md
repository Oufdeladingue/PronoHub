# Setup : Chrome Debug + Claude Code (MCP)

Ce guide permet de configurer le combo Chrome DevTools + Claude Code pour debug visuel et automatisation.

## Architecture

```
Claude (VSCode) → MCP Puppeteer → Chrome DevTools Protocol (CDP) → Chrome (port 9222) → site local/prod
```

## Ce que ça permet

- Claude navigue sur le site, prend des screenshots, lit le DOM
- Claude voit les erreurs console en temps réel
- Claude teste les flows (OAuth, formulaires) et vérifie visuellement
- Claude debug les problèmes de layout/CSS directement

## Prérequis

- Google Chrome installé
- Node.js v20+
- Claude Code dans VSCode
- Le projet PronoHub cloné

## Installation

### 1. Vérifier Chrome

```bash
# Windows
where chrome
# ou vérifier que C:\Program Files\Google\Chrome\Application\chrome.exe existe
```

### 2. Configurer le MCP (déjà fait dans le projet)

Le fichier `.mcp.json` à la racine du projet configure automatiquement :
- **Puppeteer MCP** : se connecte au Chrome debug sur `localhost:9222`
- **Supabase MCP** : accès direct à la BDD

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-puppeteer"],
      "env": {
        "PUPPETEER_LAUNCH_OPTIONS": "{\"headless\": false}",
        "PUPPETEER_CONNECT_URL": "http://localhost:9222"
      }
    }
  }
}
```

### 3. Lancer Chrome en mode debug

**Windows :**
```bash
# Utiliser le script fourni
scripts\chrome-debug.bat

# Ou manuellement
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-debug-profile" --no-first-run http://localhost:3100
```

**macOS :**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile --no-first-run http://localhost:3100
```

### 4. Vérifier la connexion

```bash
curl http://localhost:9222/json/version
```

Doit retourner un JSON avec `webSocketDebuggerUrl`.

### 5. Lancer le dev server PronoHub

```bash
cd PronoHub
npm run dev
# Écoute sur http://localhost:3100
```

## Utilisation avec Claude

Une fois Chrome debug + dev server lancés, dans Claude Code (VSCode) :

```
"Va sur http://localhost:3100, prends un screenshot et dis-moi ce que tu vois"
"Navigue sur /auth/forgot-password et vérifie que le formulaire fonctionne"
"Ouvre la console et dis-moi s'il y a des erreurs JS"
"Clique sur 'Créer mon tournoi' et montre-moi le résultat"
```

## Troubleshooting

| Problème | Solution |
|----------|----------|
| `Connection refused` sur 9222 | Chrome n'est pas lancé en mode debug, ou un autre Chrome utilise le port |
| `No browser found` | Fermer TOUS les Chrome avant de relancer avec `--remote-debugging-port` |
| MCP timeout | Relancer Claude Code (le MCP server se reconnecte automatiquement) |
| Port 9222 occupé | `netstat -ano | findstr 9222` pour trouver le process, ou changer le port |

## Mode quasi-auto (skip permissions)

Pour que Claude ne demande plus de permission à chaque outil, le fichier `.claude/settings.local.json` est configuré :

```json
{
  "permissions": {
    "allow": [
      "Bash(*)",
      "Edit(*)",
      "Write(*)",
      "Read(*)",
      "WebFetch(*)",
      "mcp__puppeteer__*",
      "mcp__supabase__*",
      "mcp__adb__*"
    ]
  }
}
```

Cela auto-approve Bash, éditions de fichiers, requêtes web, et tous les MCP servers.

> **Note :** Le vrai "auto mode" de Claude Code nécessite un plan Team/Enterprise. Cette config est l'équivalent le plus proche sur un plan individuel.

## Notes

- Le `--user-data-dir` crée un profil Chrome séparé (pas de conflit avec ton Chrome principal)
- Le MCP Puppeteer supporte : navigation, screenshots, clic, saisie, lecture DOM, console
- Fonctionne aussi avec les sites en production (`https://www.pronohub.club`)
