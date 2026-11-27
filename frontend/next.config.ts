import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { resolve } from "node:path";

// Share the repository-root .env with Compose and FastAPI.
// Keep secrets out of nextConfig.env, which would expose them to the browser.
// Next has already loaded the frontend directory; reload from the shared root.
loadEnvConfig(resolve(__dirname, ".."), process.env.NODE_ENV === "development", console, true);

const nextConfig: NextConfig = {
  // Loopback browsers may use either hostname when the dev server binds inside Docker.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
