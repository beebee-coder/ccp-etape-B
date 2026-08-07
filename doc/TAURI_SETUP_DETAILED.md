# Plan Tauri détaillé — NexaFlow Desktop (BDD locale + Installer EXE/MSI)

## Vue d'ensemble

Objectif : transformer l'application Next.js en application desktop Tauri, avec une BDD SQLite locale sur le device de l'utilisateur, peuplée automatiquement depuis la BDD web Vercel, et distribuée via des installateurs Windows (EXE et MSI).

Architecture cible :
- Web (Vercel) : Next.js + PostgreSQL, avec API routes d'export et purge
- Desktop (Tauri) : WebView Next.js + Rust backend + SQLite local
- BDD locale : %APPDATA%\CCP-Etape-B\visionode.sqlite
- Installateurs : CCP-Etape-B-0.1.0.msi (WiX) et CCP-Etape-B-0.1.0.exe (NSIS)

---

## Étape 1 — Prérequis système (Windows)

### 1.1 Installer Visual Studio Build Tools
- Télécharger "Build Tools for Visual Studio 2022" depuis visualstudio.microsoft.com
- Installer la charge de travail "Développement Desktop en C++"
- Vérifier que cl.exe est accessible dans le PATH

### 1.2 Installer Node.js
- Vérifier que Node.js >= 18.x et npm >= 9.x sont installés
- Si nécessaire, installer via winget

### 1.3 Installer Rust
- Télécharger rustup-init depuis rustup.rs
- Exécuter l'installeur avec l'option -y
- Redémarrer le terminal et vérifier cargo --version >= 1.70.x

### 1.4 Installer Tauri CLI
- Exécuter cargo install tauri-cli --version "^2.0"
- Vérifier tauri --version

### 1.5 Vérification complète
- Exécuter un script PowerShell qui vérifie la présence de Node.js, npm, Rust, Cargo, Tauri CLI et Visual Studio Build Tools

---

## Étape 2 — Initialisation du projet Tauri

### 2.1 Créer la structure de dossiers
- Créer src-tauri/src pour le code Rust
- Créer src-tauri/icons pour les icônes de l'application
- Créer src-tauri/capabilities pour les permissions Tauri v2

### 2.2 Créer Cargo.toml
- Définir le package Rust avec nom, version, description
- Ajouter les dépendances build : tauri-build
- Ajouter les dépendances : tauri v2, tauri-plugin-shell, serde, serde_json, tokio, reqwest, sqlx (avec feature sqlite et tokio), dirs, uuid, base64, chrono, log, env_logger
- Configurer les features default et custom-protocol

### 2.3 Créer build.rs
- Fichier minimal qui appelle tauri_build::build()

### 2.4 Créer tauri.conf.json
- Configurer build : beforeDevCommand = npm run dev, devUrl = http://localhost:3000, beforeBuildCommand = npm run build, frontendDist = .next
- Configurer app : fenêtre 1400x900, titre CCP-Etape-B, minWidth 1024, minHeight 768
- Configurer bundle : actif, targets = all, icônes multiples tailles
- Configurer bundle.windows : wix avec langue fr-FR, nsis avec options d'installation (desktop shortcut, start menu, etc.)
- Configurer plugins : shell open

### 2.5 Créer capabilities/default.json
- Définir les permissions Tauri v2 : core, fs, path, shell, http, event
- Spécifier les allowlists pour chaque permission

### 2.6 Créer src/main.rs (backend Rust)
- Définir les structures PullResult, ExportPayload, PurgeResponse, DbInfo
- Définir AppState avec pool Mutex<Option<SqlitePool>> et db_path Mutex<Option<String>>
- Implémenter get_app_dir() : %APPDATA%\CCP-Etape-B
- Implémenter ensure_app_dir() : créer le répertoire si nécessaire
- Implémenter get_db_path() : chemin vers visionode.sqlite
- Implémenter init_pool() : créer SqlitePool, activer WAL et foreign_keys, créer tables
- Implémenter create_tables() : créer toutes les tables locales (local_meta, sync_queue, sync_manifest, knowledge_items, chroma_index, alarms, alarm_events, location_nodes, data_assignments, procedures, procedure_steps, guardrail_rules, media_items) et leurs index
- Implémenter les commandes Tauri :
  - get_local_db_path : retourne le chemin de la BDD
  - get_local_db_info : retourne les métadonnées de la BDD (taille, existence)
  - initialize_database : initialise le pool et le manifeste
  - pull_and_purge : récupère les données web, insère en local, purge web
- Implémenter les fonctions d'insertion par table avec ON CONFLICT DO UPDATE
- Implémenter le point d'entrée run() avec tauri::Builder

---

## Étape 3 — Configuration Next.js pour Tauri

### 3.1 Modifier package.json
- Ajouter les scripts tauri, tauri:dev, tauri:build, tauri:build:msi, tauri:build:exe, tauri:build:all, setup:tauri

### 3.2 Modifier next.config.mjs
- Configurer output: standalone
- Configurer experimental.outputFileTracingExcludes pour exclure .local-db/** et src-tauri/**
- Ajouter webpack fallback pour fs, path, crypto en mode server

### 3.3 Installer @tauri-apps/api
- npm install @tauri-apps/api

---

## Étape 4 — Adapter la BDD SQLite pour Tauri

### 4.1 Créer src/lib/db/adapters/tauri-sqlite.ts
- Implémenter TauriSqliteClient, TauriSqlitePool, TauriSqliteAdapter
- Utiliser appDataDir() de @tauri-apps/api/path pour le chemin de la BDD
- Fallback sur .local-db/visionode.sqlite si Tauri API non disponible
- Implémenter query(), getPool(), getClient(), closePool(), checkConnection()

### 4.2 Modifier src/lib/db/adapters/index.ts
- Ajouter l'export de TauriSqliteAdapter
- Modifier getAdapter() pour détecter Tauri via window.__TAURI__ et utiliser TauriSqliteAdapter

---

## Étape 5 — Configurer le PullEngine pour Tauri

### 5.1 Créer src/lib/tauri/commands.ts
- Définir TauriPullResult
- Implémenter tauriPullAndPurge(apiUrl) : appelle la commande Rust pull_and_purge
- Implémenter tauriGetLocalDbPath() : appelle la commande Rust get_local_db_path

### 5.2 Modifier src/lib/local-db/pull-engine.ts
- Extraire processPayload() pour traiter un payload JSON
- Garder pull() pour fetch web et processPayload()
- Garder purgeWeb() pour purge
- Garder pullAndPurge() comme orchestration

---

## Étape 6 — Interface utilisateur

### 6.1 Créer src/components/admin/SyncLocalButton.tsx
- État : isLoading, result
- handleSync() : détecte Tauri vs web, appelle tauriPullAndPurge ou /api/local-db/sync-all
- Afficher les résultats : nombre d'éléments transférés, badges par table, statut purge, erreurs
- Utiliser toast de sonner pour feedback

### 6.2 Intégrer dans src/app/(dashboard)/admin/page.tsx
- Importer SyncLocalButton
- Ajouter le composant dans le layout admin

---

## Étape 7 — Scripts d'installation et de build

### 7.1 Créer scripts/setup-tauri.ps1 (Windows)
- Vérifier et installer Rust si absent
- Vérifier et installer Tauri CLI si absent
- Installer les dépendances npm
- Initialiser Tauri
- Afficher les instructions de lancement

### 7.2 Ajouter les scripts dans package.json
- setup:tauri : powershell -ExecutionPolicy Bypass -File scripts/setup-tauri.ps1
- tauri:dev : tauri dev
- tauri:build : tauri build
- tauri:build:msi : tauri build --bundles msi
- tauri:build:exe : tauri build --bundles nsis
- tauri:build:all : tauri build --bundles all

---

## Étape 8 — Workflow de développement

### 8.1 Développement web
- npm run dev : lance Next.js sur localhost:3000

### 8.2 Développement desktop
- npm run tauri:dev : compile Rust, lance Next.js, ouvre la fenêtre Tauri
- La BDD SQLite est créée automatiquement dans %APPDATA%\CCP-Etape-B

### 8.3 Build de production web
- npm run build : génère .next/standalone

### 8.4 Build de production desktop
- npm run tauri:build : compile et génère les installateurs
- npm run tauri:build:msi : génère uniquement .msi
- npm run tauri:build:exe : génère uniquement .exe NSIS

---

## Étape 9 — Génération des installateurs

### 9.1 Localisation des artefacts
- MSI : src-tauri/target/release/bundle/msi/CCP-Etape-B_0.1.0_x64_en-US.msi
- EXE : src-tauri/target/release/bundle/nsis/CCP-Etape-B_0.1.0_x64-setup.exe
- AppX : src-tauri/target/release/bundle/msi/CCP-Etape-B_0.1.0_x64.appx (si activé)

### 9.2 Personnalisation des installateurs
- WiX (MSI) : dialogImagePath, bannerImagePath, compression lzma, digestAlgorithm sha256, upgradeCode
- NSIS (EXE) : installerIcon, uninstallerIcon, allowElevation, createDesktopShortcut, createStartMenuShortcut, shortcutName, installMode currentUser

### 9.3 Signature des installateurs (optionnel mais recommandé)
- Obtenir un certificat EV Code Signing
- Signer les .exe et .msi avec signtool.exe
- Configurer la signature dans tauri.conf.json ou via signingIdentity

---

## Étape 10 — Workflow complet utilisateur

### 10.1 Injection web
- Utilisateur accède à l'app sur Vercel
- Il injecte des données via formulaires, uploads, etc.
- Les données sont stockées dans PostgreSQL

### 10.2 Synchronisation vers local
- Utilisateur ouvre l'app desktop Tauri
- Il clique sur Administration → Synchroniser vers local
- L'app :
  1. Appelle /api/local-db/export sur Vercel
  2. Reçoit toutes les tables PostgreSQL
  3. Insère dans SQLite local via transaction
  4. Appelle /api/local-db/purge pour vider la BDD web
  5. Affiche le résultat (succès/échecs)

### 10.3 Utilisation hors ligne
- La BDD locale (%APPDATA%\CCP-Etape-B\visionode.sqlite) contient toutes les données
- L'app fonctionne entièrement hors ligne
- La BDD web est réinitialisée pour le prochain lot d'injection

---

## Étape 11 — Tests et vérifications

### 11.1 Tests unitaires
- Tester les adaptateurs SQLite
- Tester PullEngine.processPayload()
- Tester les commandes Tauri (mock)

### 11.2 Tests d'intégration
- Lancer npm run tauri:dev
- Vérifier création de la BDD dans %APPDATA%
- Vérifier le bouton Synchroniser
- Vérifier l'insertion des données
- Vérifier la purge web

### 11.3 Build de production
- npm run tauri:build:all
- Vérifier les installateurs générés
- Tester l'installation sur une VM Windows propre

---

## Étape 12 — Dépannage courant

### 12.1 Erreurs de compilation Rust
- rustup update
- cd src-tauri && cargo clean
- Vérifier Visual Studio Build Tools

### 12.2 Erreurs Tauri API
- Vérifier window.__TAURI__
- Vérifier les permissions dans capabilities/default.json

### 12.3 Erreurs better-sqlite3
- npm install better-sqlite3
- Vérifier la compatibilité avec Tauri

### 12.4 Erreurs de build d'installateur
- Vérifier WiX Toolset pour MSI
- Vérifier NSIS pour EXE
- Vérifier les chemins des icônes

---

## Étape 13 — Sécurité et bonnes pratiques

### 13.1 Validation des données
- Valider toutes les données reçues de l'API web
- Utiliser des transactions pour les insertions bulk
- Ne jamais faire confiance aux données JSON externes

### 13.2 Gestion des erreurs
- Logger toutes les erreurs de sync
- Afficher des messages clairs à l'utilisateur
- Ne jamais supprimer la BDD locale en cas d'échec partiel
- La purge web ne se fait que si l'insertion locale réussit

### 13.3 Performance
- Utiliser des transactions SQLite
- Désactiver les index pendant l'insertion bulk, puis les réactiver
- Ajouter une barre de progression pour la sync

### 13.4 Sécurité Windows
- Signer les installateurs avec un certificat EV
- Ne pas demander plus de permissions que nécessaire
- Stocker la BDD dans %APPDATA%, pas dans Program Files

---

## Étape 14 — Améliorations futures

1. Sync automatique au lancement de l'app
2. Sync incrémentale basée sur timestamps
3. Compression des données exportées
4. Chiffrement de la BDD SQLite locale
5. Multi-profils locaux
6. Backup automatique de la BDD
7. Mise à jour automatique de l'app (Tauri Updater)
8. Notification lors de nouvelles données disponibles

---

## Résumé des commandes clés

```bash
# Installation complète
npm install
npm run setup:tauri

# Développement web
npm run dev

# Développement desktop
npm run tauri:dev

# Build production
npm run build
npm run tauri:build:all

# Installateurs générés dans :
# src-tauri/target/release/bundle/msi/      (MSI)
# src-tauri/target/release/bundle/nsis/     (EXE)

# Tests
npm run test
npm run lint
```

---

## Checklist des fichiers à créer/modifier

### À créer
- src-tauri/Cargo.toml
- src-tauri/build.rs
- src-tauri/tauri.conf.json
- src-tauri/capabilities/default.json
- src-tauri/src/main.rs
- src/lib/tauri/commands.ts
- src/lib/db/adapters/tauri-sqlite.ts
- src/components/admin/SyncLocalButton.tsx
- scripts/setup-tauri.ps1
- doc/TAURI_SETUP.md (ce fichier)

### À modifier
- package.json (scripts tauri)
- next.config.mjs (output standalone, exclusions)
- src/lib/db/adapters/index.ts (ajouter TauriSqliteAdapter)
- src/lib/local-db/pull-engine.ts (extraire processPayload)
- src/app/(dashboard)/admin/page.tsx (intégrer SyncLocalButton)

### Générés automatiquement
- src-tauri/gen/ (par Tauri)
- src-tauri/target/ (par cargo)
- src-tauri/icons/ (après ajout des icônes)

---

## Support et ressources

- Documentation Tauri : https://tauri.app/
- Tauri v2 + Next.js : https://tauri.app/v2/guides/frameworks/nextjs
- SQLite dans Tauri : https://tauri.app/v2/guides/features/command
- reqwest : https://docs.rs/reqwest
- sqlx : https://docs.rs/sqlx
- WiX Toolset : https://wixtoolset.org/
- NSIS : https://nsis.sourceforge.io/
