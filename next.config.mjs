/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    outputFileTracingExcludes: {
      "*": [".local-db/**", "src-tauri/**"],
    },
  },
  /**
   * Headers COOP / COEP requis pour SQLite-WASM (SharedArrayBuffer).
   * Nécessaires quand le mode browser utilise @sqlite.org/sqlite-wasm avec OPFS.
   * https://sqlite.org/wasm/doc/tip/persistence.md#coop-coep
   *
   * Ces headers sont appliqués sur toutes les routes, y compris /api/local-db/*
   * pour garantir le bon fonctionnement de la BDD locale en mode Vercel.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
  /**
   * better-sqlite3 est un module natif Node.js — on l'exclut du bundle
   * webpack pour qu'il ne soit jamais importé dans des Edge Functions.
   */
  webpack(config, { isServer }) {
    if (!isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("better-sqlite3");
      }
    }
    return config;
  },
};

export default nextConfig;
