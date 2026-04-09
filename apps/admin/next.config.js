/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react", "framer-motion"]
  }
};

module.exports = nextConfig;
