/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    outputFileTracingExcludes: {
      "*": [".local-db/**"],
    },
  },
};

export default nextConfig;
