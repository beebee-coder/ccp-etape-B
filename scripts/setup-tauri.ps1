# Script d'installation et de configuration Tauri v2 pour Windows

Write-Host "=== Verification de l'environnement Tauri pour NexaFlow (CCP-Etape-B) ===" -ForegroundColor Cyan

# 1. Verification Node.js & npm
try {
    $nodeVer = node -v
    $npmVer = npm -v
    Write-Host "[OK] Node.js version: $nodeVer, npm version: $npmVer" -ForegroundColor Green
} catch {
    Write-Host "[ERREUR] Node.js ou npm n'est pas installe dans le PATH." -ForegroundColor Red
    exit 1
}

# 2. Verification Rust / Cargo
try {
    $cargoVer = cargo --version
    Write-Host "[OK] Rust Cargo: $cargoVer" -ForegroundColor Green
} catch {
    Write-Host "[AVERTISSEMENT] Rust n'est pas installe ou pas dans le PATH." -ForegroundColor Yellow
    Write-Host "Veuillez installer Rust via rustup (https://rustup.rs)" -ForegroundColor Yellow
}

# 3. Verification Tauri CLI
try {
    $tauriVer = cargo tauri --version
    Write-Host "[OK] Tauri CLI version: $tauriVer" -ForegroundColor Green
} catch {
    Write-Host "[INFO] Installation de cargo-tauri CLI..." -ForegroundColor Yellow
    cargo install tauri-cli --version "^2.0"
}

# 4. Installation des dependances NPM
Write-Host "[INFO] Installation des dependances npm..." -ForegroundColor Cyan
npm install

Write-Host "=== Setup termine avec succes ! ===" -ForegroundColor Green
Write-Host "Pour lancer en mode developpement desktop :" -ForegroundColor Cyan
Write-Host "  npm run tauri:dev" -ForegroundColor White
Write-Host "Pour construire les installateurs Windows (EXE/MSI) :" -ForegroundColor Cyan
Write-Host "  npm run tauri:build:all" -ForegroundColor White
