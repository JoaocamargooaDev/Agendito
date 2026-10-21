import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  distDir: process.env.AGENDITO_NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
