import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "glxm.cdn.troojin.com",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
    ],
  },
  async rewrites() {
    return [
      { source: "/generate",          destination: "/api/actions/generate" },
      { source: "/generate/thinking", destination: "/api/actions/generate/thinking" },
      { source: "/thinking-steps",    destination: "/api/actions/thinking-steps" },
      { source: "/models",            destination: "/api/actions/models" },
      { source: "/health",            destination: "/api/actions/health" },
    ]
  },
};

export default nextConfig;