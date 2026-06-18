# Munchkin — Script de démarrage local
# Usage : double-cliquer sur start.bat, ou : pwsh -File start.ps1

$root = $PSScriptRoot

function Write-Banner {
    param([string]$msg, [string]$color = "Cyan")
    Write-Host ""
    Write-Host ">>> $msg" -ForegroundColor $color
}

function Assert-LastExit {
    param([string]$context)
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERREUR] $context (exit $LASTEXITCODE)" -ForegroundColor Red
        Read-Host "Appuyez sur Entree pour fermer"
        exit 1
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host "   Munchkin - Demarrage local"             -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Magenta

# ── 1. Docker ─────────────────────────────────────────────────────────────────
Write-Banner "[1/4] Infrastructure Docker (Redis + PostgreSQL)"

docker info > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERREUR] Docker Desktop n'est pas lance. Demarrez-le puis relancez ce script." -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour fermer"
    exit 1
}

docker compose -f "$root\docker-compose.yml" up -d
Assert-LastExit "docker compose up"

Write-Host "  Attente que PostgreSQL et Redis soient prets..." -ForegroundColor Yellow
$timeout  = 60
$deadline = (Get-Date).AddSeconds($timeout)
while ((Get-Date) -lt $deadline) {
    $pgHealth  = docker inspect munchkin-postgres --format "{{.State.Health.Status}}" 2>$null
    $rdHealth  = docker inspect munchkin-redis    --format "{{.State.Health.Status}}" 2>$null
    if ($pgHealth -eq "healthy" -and $rdHealth -eq "healthy") { break }
    Start-Sleep 2
}

$pgHealth = docker inspect munchkin-postgres --format "{{.State.Health.Status}}" 2>$null
$rdHealth = docker inspect munchkin-redis    --format "{{.State.Health.Status}}" 2>$null
Write-Host "  postgres=$pgHealth  redis=$rdHealth" -ForegroundColor $(if ($pgHealth -eq "healthy" -and $rdHealth -eq "healthy") { "Green" } else { "Yellow" })

# ── 2. Dépendances ────────────────────────────────────────────────────────────
Write-Banner "[2/4] Dependances npm"

$needInstall = -not (Test-Path "$root\server\node_modules")

if ($needInstall) {
    Write-Host "  Premiere installation (2-3 min)..." -ForegroundColor Yellow

    Push-Location "$root\shared";  npm install;  $c1 = $LASTEXITCODE;  Pop-Location
    Assert-LastExit "npm install shared ($c1)"

    Push-Location "$root\server";  npm install;  $c2 = $LASTEXITCODE;  Pop-Location
    Assert-LastExit "npm install server ($c2)"

    Push-Location "$root\client";  npm install;  $c3 = $LASTEXITCODE;  Pop-Location
    Assert-LastExit "npm install client ($c3)"

    Write-Host "  [OK] Dependances installees" -ForegroundColor Green
} else {
    Write-Host "  [OK] Dependances deja presentes" -ForegroundColor Green
}

# Build shared si dist absent
if (-not (Test-Path "$root\shared\dist\index.js")) {
    Write-Host "  Build du module shared..." -ForegroundColor Yellow
    Push-Location "$root\shared";  npx tsc;  $c = $LASTEXITCODE;  Pop-Location
    Assert-LastExit "tsc shared ($c)"
    Write-Host "  [OK] Shared compile" -ForegroundColor Green
} else {
    Write-Host "  [OK] Shared deja compile" -ForegroundColor Green
}

# ── 3. Base de données ────────────────────────────────────────────────────────
Write-Banner "[3/4] Base de donnees"

$setupFlag = "$root\.munchkin-setup"

if (-not (Test-Path $setupFlag)) {
    Write-Host "  Migration + seed (premiere fois)..." -ForegroundColor Yellow

    Push-Location "$root\server"

    # migrate deploy : non-interactif, applique les migrations existantes
    npx prisma migrate deploy
    $c1 = $LASTEXITCODE

    if ($c1 -eq 0) {
        npm run db:seed
        $c2 = $LASTEXITCODE
    }

    Pop-Location

    Assert-LastExit "prisma migrate deploy ($c1)"
    Assert-LastExit "db:seed ($c2)"

    New-Item -ItemType File -Path $setupFlag -Force | Out-Null
    Write-Host "  [OK] Base de donnees initialisee" -ForegroundColor Green
} else {
    Write-Host "  [OK] Base de donnees deja initialisee" -ForegroundColor Green
    Write-Host "  (supprimez .munchkin-setup pour forcer une re-initialisation)" -ForegroundColor DarkGray
}

# ── 4. Lancement ──────────────────────────────────────────────────────────────
Write-Banner "[4/4] Lancement serveur + client"

$serverCmd = "& { `$host.UI.RawUI.WindowTitle = 'Munchkin - Serveur'; Set-Location '$root\server'; npm run dev }"
$clientCmd = "& { `$host.UI.RawUI.WindowTitle = 'Munchkin - Client'; Set-Location '$root\client'; npm run dev }"

Start-Process powershell -ArgumentList "-NoExit", "-NoProfile", "-Command", $serverCmd
Start-Sleep 3
Start-Process powershell -ArgumentList "-NoExit", "-NoProfile", "-Command", $clientCmd

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Munchkin lance !"                        -ForegroundColor Green
Write-Host "  Serveur -> http://localhost:3000"        -ForegroundColor Green
Write-Host "  Client  -> http://localhost:4200"        -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Read-Host "Appuyez sur Entree pour fermer cette fenetre"
