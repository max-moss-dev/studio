import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@studio/core"],
  // When building for Tauri, use standalone output for sidecar bundling
  ...(process.env.TAURI_ENV_PLATFORM
    ? { output: "standalone" as const }
    : {}),
};

export default nextConfig;
