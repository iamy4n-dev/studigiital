import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@studigiital/types", "@studigiital/api-client"],
};

export default nextConfig;
