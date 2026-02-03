import type { NextConfig } from "next";

// Force restart to reload Prisma Client schema

const isDocker = process.env.DEPLOYMENT_TARGET === "docker";
const appUrl = process.env.NEXT_PUBLIC_APP_URL
  || process.env.NEXTAUTH_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://studiogabirego.com");

const corsAllowedOrigin = process.env.CORS_ALLOWED_ORIGIN
  || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : appUrl);

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

  // Keep pdfkit external so its standard font data can be resolved at runtime.
  serverExternalPackages: ["pdfkit"],

  // Enable experimental features
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: corsAllowedOrigin },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "Vary", value: "Origin" },
        ],
      },
    ];
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
