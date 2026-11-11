import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "fragrant-marxism-guacamole.ngrok-free.dev"],
  devIndicators: false,
  experimental: {
    proxyTimeout: 120000,
  },
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*/",
      },
      {
        source: "/media/:path*",
        destination: "http://127.0.0.1:8000/media/:path*",
      }
    ];
  },
};

export default nextConfig;
