/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    outputFileTracingExcludes: {
      "*": [".local-db/**", "src-tauri/**"],
    },
  },
};

export default nextConfig;
