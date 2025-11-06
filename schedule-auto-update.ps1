# Script pour planifier la mise à jour automatique des compétitions
# Ce script crée une tâche planifiée Windows qui exécute auto-update-competitions.ps1

Write-Host "=== Configuration de la mise à jour automatique ===" -ForegroundColor Cyan
Write-Host ""

# Vérifier les privilèges administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "✗ Ce script nécessite des privilèges administrateur." -ForegroundColor Red
    Write-Host "  Relancez PowerShell en tant qu'administrateur." -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

# Chemins
$scriptPath = Join-Path $PSScriptRoot "auto-update-competitions.ps1"
$taskName = "PronoHub - Auto-Update Competitions"

# Vérifier que le script existe
if (-not (Test-Path $scriptPath)) {
    Write-Host "✗ Le script auto-update-competitions.ps1 n'a pas été trouvé." -ForegroundColor Red
    Write-Host "  Chemin attendu: $scriptPath" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

# Demander l'intervalle de mise à jour
Write-Host "Choisissez l'intervalle de mise à jour automatique:" -ForegroundColor Yellow
Write-Host "  1. Toutes les 5 minutes (pour les tests)" -ForegroundColor White
Write-Host "  2. Toutes les 15 minutes" -ForegroundColor White
Write-Host "  3. Toutes les 30 minutes" -ForegroundColor White
Write-Host "  4. Toutes les heures" -ForegroundColor White
Write-Host "  5. Toutes les 2 heures (recommandé)" -ForegroundColor Green
Write-Host "  6. Toutes les 6 heures" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Votre choix (1-6)"

switch ($choice) {
    "1" { $intervalMinutes = 5 }
    "2" { $intervalMinutes = 15 }
    "3" { $intervalMinutes = 30 }
    "4" { $intervalMinutes = 60 }
    "5" { $intervalMinutes = 120 }
    "6" { $intervalMinutes = 360 }
    default {
        Write-Host "✗ Choix invalide. Utilisation de l'intervalle par défaut: 2 heures" -ForegroundColor Yellow
        $intervalMinutes = 120
    }
}

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  - Tâche: $taskName" -ForegroundColor White
Write-Host "  - Intervalle: $intervalMinutes minutes" -ForegroundColor White
Write-Host "  - Script: $scriptPath" -ForegroundColor White
Write-Host ""

# Supprimer la tâche existante si elle existe
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Une tâche planifiée existe déjà. Suppression..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Créer l'action
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

# Créer le déclencheur (répétition)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $intervalMinutes)

# Créer les paramètres
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

# Enregistrer la tâche
try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Description "Met à jour automatiquement les compétitions actives depuis l'API Football-Data" `
        -ErrorAction Stop | Out-Null

    Write-Host "✓ Tâche planifiée créée avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "La mise à jour automatique s'exécutera toutes les $intervalMinutes minutes." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Pour gérer cette tâche:" -ForegroundColor Yellow
    Write-Host "  - Ouvrir le Planificateur de tâches Windows" -ForegroundColor White
    Write-Host "  - Chercher: $taskName" -ForegroundColor White
    Write-Host ""
    Write-Host "Pour désactiver la mise à jour automatique:" -ForegroundColor Yellow
    Write-Host "  - Exécutez: Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false" -ForegroundColor White
    Write-Host ""

} catch {
    Write-Host "✗ Erreur lors de la création de la tâche planifiée:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    pause
    exit 1
}

Write-Host "Terminé!" -ForegroundColor Green
Write-Host ""
pause
