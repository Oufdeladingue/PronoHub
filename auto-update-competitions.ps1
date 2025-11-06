# Script de mise à jour automatique des compétitions actives
# Ce script appelle l'API d'auto-update pour mettre à jour les données depuis Football-Data

Write-Host "=== Mise à jour automatique des compétitions ===" -ForegroundColor Cyan
Write-Host "Démarrage: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')" -ForegroundColor Gray
Write-Host ""

# URL de l'API (ajustez si nécessaire)
$apiUrl = "http://localhost:3000/api/football/auto-update"

try {
    Write-Host "Appel de l'API de mise à jour..." -ForegroundColor Yellow

    # Appeler l'API POST
    $response = Invoke-RestMethod -Uri $apiUrl -Method Post -ContentType "application/json" -ErrorAction Stop

    Write-Host ""
    Write-Host "✓ Mise à jour terminée!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Résumé:" -ForegroundColor Cyan
    Write-Host "  - Total: $($response.totalCompetitions) compétition(s)" -ForegroundColor White
    Write-Host "  - Réussies: $($response.successCount)" -ForegroundColor Green
    Write-Host "  - Échouées: $($response.failureCount)" -ForegroundColor $(if ($response.failureCount -gt 0) { "Red" } else { "Gray" })
    Write-Host ""

    if ($response.results) {
        Write-Host "Détails par compétition:" -ForegroundColor Cyan
        foreach ($result in $response.results) {
            if ($result.success) {
                Write-Host "  ✓ $($result.name) ($($result.code)): $($result.matchesCount) matchs mis à jour" -ForegroundColor Green
            } else {
                Write-Host "  ✗ $($result.name): $($result.error)" -ForegroundColor Red
            }
        }
    }

    Write-Host ""
    Write-Host "Terminé: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')" -ForegroundColor Gray

} catch {
    Write-Host ""
    Write-Host "✗ Erreur lors de la mise à jour:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    exit 1
}
