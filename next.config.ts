import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "192.168.0.248"],
  outputFileTracingRoot: process.cwd(),
  distDir: process.env.AGENDITO_NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
