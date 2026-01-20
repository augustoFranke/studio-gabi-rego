import type { NextConfig } from "next";

// Force restart to reload Prisma Client schema

const isDocker = process.env.DEPLOYMENT_TARGET === "docker";

const nextConfig: NextConfig = {
  // Use standalone output only for Docker deployment
  // Vercel handles this automatically
  ...(isDocker && { output: "standalone" }),

  // Image optimization
  // - Vercel: enabled (handled by Vercel)
  // - Docker: disabled (no image optimization service)
  images: {
    unoptimized: isDocker,
  },

  // Enable experimental features
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  outputFileTracingIncludes: {
    "/api/treinos/gerar-pdf": [
      "public/fonts/FreeStyleScript.ttf",
      "public/logo-black.png",
      "node_modules/pdfkit/js/data/**/*",
    ],
    "/api/treinos/[id]/pdf": [
      "public/fonts/FreeStyleScript.ttf",
      "public/logo-black.png",
      "node_modules/pdfkit/js/data/**/*",
    ],
  },
};

export default nextConfig;
