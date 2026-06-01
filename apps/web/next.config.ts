import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL;
if (!BACKEND_URL) throw new Error("BACKEND_URL env var is required");

const nextConfig: NextConfig = {
  transpilePackages: ["@studigiital/types", "@studigiital/api-client"],
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
