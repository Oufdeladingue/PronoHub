# Script pour exécuter la migration total_matchdays

# Charger les variables d'environnement depuis .env.local
Get-Content .env.local | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$') {
        $name = $matches[1]
        $value = $matches[2]
        Set-Item -Path "env:$name" -Value $value
    }
}

Write-Host "Exécution de la migration: add_total_matchdays_to_competitions.sql" -ForegroundColor Cyan

# Construire l'URL de connexion PostgreSQL
$dbUrl = $env:NEXT_PUBLIC_SUPABASE_URL

if (-not $dbUrl) {
    Write-Host "ERREUR: NEXT_PUBLIC_SUPABASE_URL non trouvée dans .env.local" -ForegroundColor Red
    exit 1
}

# Lire le fichier SQL
$sqlContent = Get-Content "supabase\migrations\add_total_matchdays_to_competitions.sql" -Raw

Write-Host "Migration chargée, contenu:" -ForegroundColor Yellow
Write-Host $sqlContent

# Note: Cette méthode nécessite que psql soit installé
# Alternative: utiliser curl pour appeler l'API Supabase directement
Write-Host "`nPour exécuter cette migration, vous pouvez:" -ForegroundColor Green
Write-Host "1. Copier le contenu de supabase\migrations\add_total_matchdays_to_competitions.sql" -ForegroundColor White
Write-Host "2. L'exécuter dans le SQL Editor de votre dashboard Supabase" -ForegroundColor White
Write-Host "   Dashboard: https://supabase.com/dashboard/project/[votre-projet]/sql" -ForegroundColor White
