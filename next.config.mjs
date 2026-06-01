/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "jsdom", "@mozilla/readability"],
  },
};

export default nextConfig;
