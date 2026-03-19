import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "tile.openstreetmap.org" },
      { protocol: "https", hostname: "*.tile.openstreetmap.org" },
      { protocol: "https", hostname: "server.arcgisonline.com" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
