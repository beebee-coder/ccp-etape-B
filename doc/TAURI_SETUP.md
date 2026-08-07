# Plan de configuration Tauri — NexaFlow Desktop (BDD locale)

## Vue d'ensemble

Objectif : transformer l'application Next.js en application desktop Tauri avec une BDD SQLite locale sur le device de l'utilisateur, peuplée automatiquement depuis la BDD web Vercel.

Architecture cible :
```
┌─────────────────────────────────────────────────────────┐
│                    VERCEL (web)                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │  Next.js    │    │  PostgreSQL │    │  API Routes │ │
│  │  (frontend) │◄──►│  (web BDD)  │◄──►│  /export    │ │
│  └─────────────┘    └─────────────┘    │  /purge     │ │
│                                         │  /sync-all  │ │
│                                         └─────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          │ 1 clic utilisateur
                          ▼
┌─────────────────────────────────────────────────────────┐
│              DEVICE UTILISATEUR (Tauri)                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │  Tauri      │    │  SQLite     │    │  Next.js    │ │
│  │  (Rust)     │◄──►│  (locale)   │◄──►│  (webview)  │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
│        ▲                   ▲                 ▲         │
│        │                   │                 │         │
│        └───────────────────┴─────────────────┘         │
│                    PullEngine + UI                      │
└─────────────────────────────────────────────────────────┘
```

## Étape 1 — Vérifier les prérequis système

### 1.1 Installer les dépendances

**Windows :**
```powershell
# Installer Rust via rustup
winget install Rustlang.Rustup

# Installer Node.js (déjà présent)
node --version  # >= 18.x

# Installer Tauri CLI
cargo install tauri-cli

# Vérifier les outils de build Visual Studio C++
# Installer "Desktop development with C++" via Visual Studio Installer
```

**macOS :**
```bash
# Installer Xcode Command Line Tools
xcode-select --install

# Installer Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Installer Tauri CLI
cargo install tauri-cli
```

**Linux :**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# Installer Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Installer Tauri CLI
cargo install tauri-cli
```

### 1.2 Vérifier les installations
```bash
node --version   # >= 18.x
npm --version    # >= 9.x
cargo --version  # >= 1.70.x
rustc --version  # >= 1.70.x
tauri --version  # >= 1.5.x
```

## Étape 2 — Initialiser Tauri dans le projet existant

### 2.1 Depuis la racine du projet
```bash
cd C:\ahmed\ETAPE-B-CCP\app

# Initialiser Tauri (répondre aux questions)
npm run tauri init
```

**Réponses attendues :**
- App name: `CCP-Etape-B Desktop`
- Window title: `CCP-Etape-B`
- Web assets path: `../dist` (ou `.next/standalone` après build)
- Dev server command: `npm run dev`
- Build command: `npm run build`
- Dev URL: `http://localhost:3000`

### 2.2 Ou manuellement
```bash
# Créer la structure Tauri
npm run tauri init -- --name "CCP-Etape-B" --window-title "CCP-Etape-B"
```

## Étape 3 — Configurer le projet Next.js pour Tauri

### 3.1 Modifier `next.config.mjs`
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    outputFileTracingExcludes: {
      "*": [".local-db/**"],
    },
  },
  // Ajouter pour Tauri
  distDir: ".next",
  cleanDistDir: true,
};

export default nextConfig;
```

### 3.2 Créer `src-tauri/tauri.conf.json`
```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:3000",
    "distDir": ".next"
  },
  "package": {
    "productName": "CCP-Etape-B",
    "version": "0.1.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "fs": {
        "all": true,
        "scope": ["$APPDATA/CCP-Etape-B/**", "$LOCALAPPDATA/CCP-Etape-B/**"]
      },
      "path": {
        "all": true
      },
      "shell": {
        "all": false,
        "open": true
      },
      "http": {
        "all": true,
        "requestFactory": true,
        "scope": ["http://**/*", "https://**/*"]
      }
    },
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "com.ccp.etape-b",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ]
    },
    "security": {
      "csp": null
    },
    "windows": [
      {
        "title": "CCP-Etape-B",
        "width": 1400,
        "height": 900,
        "resizable": true,
        "fullscreen": false
      }
    ]
  }
}
```

### 3.3 Créer `src-tauri/Cargo.toml`
```toml
[package]
name = "ccp-etape-b"
version = "0.1.0"
description = "Application desktop CCP-Etape-B"
authors = ["you"]
edition = "2021"

[build-dependencies]
tauri-build = { version = "1.5", features = [] }

[dependencies]
tauri = { version = "1.5", features = ["fs-all", "path-all", "http-all", "shell-open"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
sqlx = { version = "0.7", features = ["runtime-tokio", "sqlite", "chrono", "uuid"] }
tokio = { version = "1.0", features = ["full"] }
dirs = "5.0"
uuid = { version = "1.0", features = ["v4"] }

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

### 3.4 Créer `src-tauri/build.rs`
```rust
fn main() {
    tauri_build::build()
}
```

## Étape 4 — Adapter la BDD SQLite pour Tauri

### 4.1 Créer `src/lib/db/adapters/tauri-sqlite.ts`
```typescript
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { appDataDir } from "@tauri-apps/api/path";
import type { DbAdapter, DbClient, DbPool } from "./types";

export class TauriSqliteClient implements DbClient {
  constructor(private db: Database.Database) {}

  async query<T = unknown>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }> {
    const stmt = this.db.prepare(text);
    const isSelect = /^\s*(SELECT|PRAGMA)/i.test(text);
    const hasReturning = /RETURNING/i.test(text);

    if (isSelect || hasReturning) {
      const rows = stmt.all(params) as T[];
      return { rows, rowCount: rows.length };
    } else {
      const info = stmt.run(params);
      return { rows: [], rowCount: info.changes };
    }
  }

  release(): void {}
}

export class TauriSqlitePool implements DbPool {
  constructor(private db: Database.Database) {}

  async connect(): Promise<DbClient> {
    return new TauriSqliteClient(this.db);
  }

  async end(): Promise<void> {
    this.db.close();
  }
}

export class TauriSqliteAdapter implements DbAdapter {
  private db: Database.Database | null = null;

  private async getDbPath(): Promise<string> {
    try {
      const appDir = await appDataDir();
      const dbDir = path.join(appDir, "CCP-Etape-B");
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      return path.join(dbDir, "visionode.sqlite");
    } catch {
      const fallback = path.join(process.cwd(), ".local-db", "visionode.sqlite");
      const dir = path.dirname(fallback);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return fallback;
    }
  }

  private async getDb(): Promise<Database.Database> {
    if (!this.db) {
      const dbPath = await this.getDbPath();
      this.db = new Database(dbPath);
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("foreign_keys = ON");

      this.db.function("uuid_generate_v4", () => {
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
          return crypto.randomUUID();
        }
        const bytes = new Uint8Array(16);
        for (let i = 0; i < 16; i++) {
          bytes[i] = Math.floor(Math.random() * 256);
        }
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      });

      this.db.function("now", () => {
        return new Date().toISOString().slice(0, 19).replace("T", " ");
      });
    }
    return this.db;
  }

  async query<T = unknown>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }> {
    const db = await this.getDb();
    const stmt = db.prepare(text);
    const isSelect = /^\s*(SELECT|PRAGMA)/i.test(text);
    const hasReturning = /RETURNING/i.test(text);

    if (isSelect || hasReturning) {
      const rows = stmt.all(params) as T[];
      return { rows, rowCount: rows.length };
    } else {
      const info = stmt.run(params);
      return { rows: [], rowCount: info.changes };
    }
  }

  getPool(): DbPool {
    return new TauriSqlitePool(this.db!);
  }

  async getClient(): Promise<DbClient> {
    const db = await this.getDb();
    return new TauriSqliteClient(db);
  }

  async closePool(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const result = await this.query("SELECT 1 as ok");
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }
}
```

### 4.2 Modifier `src/lib/db/adapters/index.ts`
```typescript
export { PgAdapter } from "./pg";
export { SqliteAdapter } from "./sqlite";
export { TauriSqliteAdapter } from "./tauri-sqlite";
export type { DbAdapter, DbClient, DbPool, DbResult } from "./types";

import { PgAdapter } from "./pg";
import { SqliteAdapter } from "./sqlite";
import { TauriSqliteAdapter } from "./tauri-sqlite";
import type { DbAdapter } from "./types";

export function getAdapter(): DbAdapter {
  const provider = process.env.DATA_PROVIDER || "neon";
  
  // Détecter si on est dans Tauri
  const isTauri = typeof window !== "undefined" && (window as unknown as { __TAURI__?: boolean }).__TAURI__;
  
  if (provider === "sqlite" || isTauri) {
    return new TauriSqliteAdapter();
  }
  
  if (provider === "neon" || provider === "pg") {
    return new PgAdapter();
  }
  
  return new SqliteAdapter();
}
```

## Étape 5 — Configurer le PullEngine pour Tauri

### 5.1 Créer `src/lib/tauri/commands.ts`
```typescript
import { invoke } from "@tauri-apps/api/tauri";

export interface TauriPullResult {
  pulled: Record<string, number>;
  failed: number;
  errors: string[];
  purged: boolean;
}

export async function tauriPullAndPurge(apiUrl: string): Promise<TauriPullResult> {
  try {
    const result = await invoke<TauriPullResult>("pull_and_purge", {
      apiUrl,
    });
    return result;
  } catch (error) {
    return {
      pulled: {},
      failed: 1,
      errors: [String(error)],
      purged: false,
    };
  }
}

export async function tauriGetLocalDbPath(): Promise<string> {
  try {
    const path = await invoke<string>("get_local_db_path");
    return path;
  } catch {
    return "inconnu";
  }
}
```

### 5.2 Créer `src-tauri/src/main.rs`
```rust
use std::sync::Mutex;
use tauri::State;
use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::path::PathBuf;
use dirs::home_dir;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct PullResult {
    pub pulled: std::collections::HashMap<String, i32>,
    pub failed: i32,
    pub errors: Vec<String>,
    pub purged: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportPayload {
    pub tables: std::collections::HashMap<String, Vec<serde_json::Value>>,
}

struct AppState {
    pool: Mutex<Option<SqlitePool>>,
}

#[tauri::command]
async fn get_local_db_path() -> Result<String, String> {
    let app_dir = dirs::home_dir()
        .ok_or("Impossible de trouver le répertoire home")?
        .join("AppData")
        .join("Roaming")
        .join("CCP-Etape-B");
    
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Impossible de créer le répertoire: {}", e))?;
    
    Ok(app_dir.join("visionode.sqlite").to_string_lossy().to_string())
}

#[tauri::command]
async fn pull_and_purge(state: State<'_, AppState>, api_url: String) -> Result<PullResult, String> {
    let pool_guard = state.pool.lock().unwrap();
    
    if pool_guard.is_none() {
        return Err("Base de données non initialisée".to_string());
    }
    
    let pool = pool_guard.as_ref().unwrap();
    
    // 1. Récupérer les données depuis l'API web
    let client = reqwest::Client::new();
    let export_url = format!("{}/api/local-db/export", api_url.trim_end_matches('/'));
    
    let export_response = client
        .get(&export_url)
        .send()
        .await
        .map_err(|e| format!("Erreur lors de l'export web: {}", e))?;
    
    if !export_response.status().is_success() {
        return Err(format!("Erreur HTTP: {}", export_response.status()));
    }
    
    let payload: ExportResponse = export_response
        .json()
        .await
        .map_err(|e| format!("Erreur de parsing: {}", e))?;
    
    // 2. Insérer dans SQLite local
    let mut result = PullResult {
        pulled: std::collections::HashMap::new(),
        failed: 0,
        errors: Vec::new(),
        purged: false,
    };
    
    // Implémenter l'insertion dans SQLite...
    // (simplifié pour l'exemple)
    
    result.purged = true;
    Ok(result)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            pool: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![get_local_db_path, pull_and_purge])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Étape 6 — Modifier l'interface Admin pour Tauri

### 6.1 Créer `src/components/admin/SyncLocalButton.tsx`
```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Trash2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export function SyncLocalButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    pulled: Record<string, number>;
    failed: number;
    purged: boolean;
  } | null>(null);

  async function handleSync() {
    setIsLoading(true);
    setResult(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      
      if (!apiUrl) {
        throw new Error("URL de l'API web non configurée");
      }

      // Détecter si on est dans Tauri
      const isTauri = typeof window !== "undefined" && 
        (window as unknown as { __TAURI__?: boolean }).__TAURI__;

      let syncResult;

      if (isTauri) {
        // Mode Tauri : appeler la commande Rust
        const { tauriPullAndPurge } = await import("@/lib/tauri/commands");
        syncResult = await tauriPullAndPurge(apiUrl);
      } else {
        // Mode web : appeler l'API route
        const response = await fetch("/api/local-db/sync-all", {
          method: "POST",
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        syncResult = (await response.json()) as {
          ok: boolean;
          pulled: Record<string, number>;
          failed: number;
          purged: boolean;
          errors: string[];
        };
      }

      setResult({
        pulled: syncResult.pulled,
        failed: syncResult.failed,
        purged: syncResult.purged,
      });

      if (syncResult.failed > 0) {
        toast.warning("Synchronisation terminée avec des erreurs", {
          description: `${syncResult.failed} élément(s) échoué(s)`,
        });
      } else {
        toast.success("Synchronisation réussie", {
          description: syncResult.purged 
            ? "Données transférées et base web purgée" 
            : "Données transférées vers la base locale",
        });
      }
    } catch (error) {
      toast.error("Échec de la synchronisation", {
        description: error instanceof Error ? error.message : "Erreur inconnue",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const totalPulled = result 
    ? Object.values(result.pulled).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Synchronisation locale</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Transférer les données web vers la base de données locale
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Synchronisation...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Synchroniser
            </>
          )}
        </Button>
      </div>

      {result && (
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center gap-2">
            {result.failed === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            <span className="font-medium">
              {totalPulled} élément(s) transféré(s)
            </span>
          </div>

          {result.purged && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trash2 className="h-4 w-4" />
              Base de données web purgée
            </div>
          )}

          {Object.keys(result.pulled).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(result.pulled).map(([key, count]) => (
                <Badge key={key} variant="secondary">
                  {key}: {count}
                </Badge>
              ))}
            </div>
          )}

          {result.failed > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <XCircle className="h-4 w-4" />
              {result.failed} échec(s)
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
```

### 6.2 Intégrer dans `src/app/(dashboard)/admin/page.tsx`
```typescript
import { SyncLocalButton } from "@/components/admin/SyncLocalButton";

export default function AdminDashboard() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      {/* ... existing content ... */}
      
      <div className="mt-8">
        <SyncLocalButton />
      </div>
    </section>
  );
}
```

## Étape 7 — Créer les scripts de build et lancement

### 7.1 Ajouter dans `package.json`
```json
{
  "scripts": {
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "db:sync": "npm run build && npm run tauri:dev",
    "db:local:init": "npm run db:sqlite:migrate && npm run db:sqlite:seed"
  }
}
```

### 7.2 Créer `scripts/setup-tauri.sh` (Linux/macOS) ou `scripts/setup-tauri.ps1` (Windows)
```powershell
# setup-tauri.ps1
Write-Host "Installation de Tauri..." -ForegroundColor Green

# Vérifier Rust
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "Rust non trouvé. Installation via rustup..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri https://win.rustup.rs -OutFile rustup-init.exe
    .\rustup-init.exe -y
    Remove-Item rustup-init.exe
}

# Vérifier Tauri CLI
if (-not (Get-Command tauri -ErrorAction SilentlyContinue)) {
    Write-Host "Installation de Tauri CLI..." -ForegroundColor Yellow
    cargo install tauri-cli
}

# Installer les dépendances npm
Write-Host "Installation des dépendances..." -ForegroundColor Green
npm install

# Initialiser Tauri
Write-Host "Initialisation de Tauri..." -ForegroundColor Green
npm run tauri init

Write-Host "Configuration terminée !" -ForegroundColor Green
Write-Host "Lancez 'npm run tauri:dev' pour démarrer en mode développement" -ForegroundColor Cyan
```

## Étape 8 — Workflow de déploiement complet

### 8.1 Développement
```bash
# Mode web (développement normal)
npm run dev

# Mode Tauri (développement desktop)
npm run tauri:dev
```

### 8.2 Build de production
```bash
# Build de l'app Next.js
npm run build

# Build de l'app Tauri (génère l'exécutable)
npm run tauri:build
```

### 8.3 Initialisation de la BDD locale (premier lancement)
```bash
# L'application Tauri crée automatiquement la BDD au premier lancement
# Via la commande Rust `get_local_db_path`
npm run tauri:dev
```

### 8.4 Cycle complet : Web → Local → Purge
```
1. Utilisateur ouvre l'app web sur Vercel
2. Il injecte des données (formulaires, uploads, etc.)
3. Il ferme le navigateur et ouvre l'app desktop Tauri
4. Il clique sur "Administration → Synchroniser vers local"
5. L'app Tauri :
   - Appelle /api/local-db/export sur Vercel
   - Insère les données dans SQLite local
   - Appelle /api/local-db/purge pour vider la BDD web
6. La BDD locale est peuplée, la BDD web est réinitialisée
```

## Étape 9 — Fichiers à créer/modifier (checklist complète)

### Fichiers à créer
- [ ] `src-tauri/tauri.conf.json`
- [ ] `src-tauri/Cargo.toml`
- [ ] `src-tauri/build.rs`
- [ ] `src-tauri/src/main.rs`
- [ ] `src-tauri/src/lib.rs` (si nécessaire)
- [ ] `src/lib/tauri/commands.ts`
- [ ] `src/lib/db/adapters/tauri-sqlite.ts`
- [ ] `src/components/admin/SyncLocalButton.tsx`
- [ ] `scripts/setup-tauri.ps1` (Windows)
- [ ] `scripts/setup-tauri.sh` (Linux/macOS)

### Fichiers à modifier
- [ ] `package.json` (ajouter scripts tauri)
- [ ] `next.config.mjs` (adapter pour Tauri)
- [ ] `src/lib/db/adapters/index.ts` (ajouter TauriSqliteAdapter)
- [ ] `src/lib/local-db/pull-engine.ts` (adapter pour Tauri)
- [ ] `src/app/(dashboard)/admin/page.tsx` (ajouter SyncLocalButton)

### Fichiers Tauri générés automatiquement
- [ ] `src-tauri/gen/` (généré par Tauri)
- [ ] `src-tauri/target/` (compilation Rust)

## Étape 10 — Tests et vérifications

### 10.1 Tests unitaires
```bash
# Tester les adaptateurs
npm run test -- src/lib/db/adapters/tauri-sqlite.test.ts

# Tester PullEngine
npm run test -- src/lib/local-db/pull-engine.test.ts
```

### 10.2 Tests d'intégration
```bash
# Lancer l'app Tauri en mode dev
npm run tauri:dev

# Vérifier :
# 1. La fenêtre s'ouvre
# 2. La BDD SQLite est créée dans AppData
# 3. Le bouton "Synchroniser" fonctionne
# 4. Les données sont insérées dans SQLite
```

### 10.3 Build de production
```bash
# Build complet
npm run tauri:build

# Vérifier l'exécutable dans :
# src-tauri/target/release/bundle/
```

## Étape 11 — Déploiement de l'exécutable

### 11.1 Pour Windows
```bash
# Génère un .msi ou .exe dans :
src-tauri/target/release/bundle/msi/
src-tauri/target/release/bundle/nsis/
```

### 11.2 Pour macOS
```bash
# Génère un .app dans :
src-tauri/target/release/bundle/dmg/
src-tauri/target/release/bundle/macos/
```

### 11.3 Pour Linux
```bash
# Génère un .deb ou .AppImage dans :
src-tauri/target/release/bundle/deb/
src-tauri/target/release/bundle/appimage/
```

## Étape 12 — Dépannage courant

### 12.1 Erreur : "better-sqlite3 not found"
```bash
npm install better-sqlite3
npm run tauri dev
```

### 12.2 Erreur : "Tauri API not available"
- Vérifier que `window.__TAURI__` est défini
- Vérifier les permissions dans `tauri.conf.json`

### 12.3 Erreur : "Cannot find module '@tauri-apps/api'"
```bash
npm install @tauri-apps/api
```

### 12.4 Erreur de compilation Rust
```bash
# Mettre à jour Rust
rustup update

# Nettoyer le build
cd src-tauri
cargo clean
cd ..
npm run tauri:dev
```

## Étape 13 — Sécurité et bonnes pratiques

### 13.1 Validation des données
- Toujours valider les données reçues de l'API web avant insertion SQLite
- Utiliser des requêtes préparées (déjà fait dans PullEngine)

### 13.2 Gestion des erreurs
- Logger toutes les erreurs de sync
- Afficher des messages clairs à l'utilisateur
- Ne pas supprimer la BDD locale en cas d'échec

### 13.3 Performance
- Utiliser des transactions pour les insertions bulk
- Implémenter un système de pagination si les données sont volumineuses
- Ajouter une barre de progression pour la sync

## Étape 14 — Améliorations futures possibles

1. **Sync automatique** : déclencher la sync au lancement de l'app
2. **Incremental sync** : ne transférer que les nouvelles données (basé sur timestamps)
3. **Compression** : compresser les données exportées avant transfert
4. **Chiffrement** : chiffrer la BDD SQLite locale
5. **Multi-utilisateur** : gérer plusieurs profils locaux
6. **Backup automatique** : sauvegarder la BDD locale périodiquement

## Résumé des commandes clés

```bash
# Installation complète
npm install
npm run setup-tauri

# Développement web
npm run dev

# Développement desktop
npm run tauri:dev

# Build production web
npm run build

# Build production desktop
npm run tauri:build

# Tests
npm run test

# Lint
npm run lint
```

## Support et ressources

- Documentation Tauri : https://tauri.app/
- Tauri + Next.js : https://tauri.app/v1/guides/frameworks/nextjs/
- SQLite dans Tauri : https://tauri.app/v1/guides/features/command
- better-sqlite3 : https://github.com/WiseLibs/better-sqlite3