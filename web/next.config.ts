// web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tailwind CSS is processed by its Turbopack loader (set up by create-next-app).
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
