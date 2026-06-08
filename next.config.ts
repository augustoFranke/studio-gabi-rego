import type { NextConfig } from "next";

// Force restart to reload Prisma Client schema

const appUrl = process.env.NEXT_PUBLIC_APP_URL
  || process.env.NEXTAUTH_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://studiogabirego.com");

const corsAllowedOrigin = process.env.CORS_ALLOWED_ORIGIN
  || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : appUrl);

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Keep pdfkit external so its standard font data can be resolved at runtime.
  serverExternalPackages: ["pdfkit"],

  // Enable experimental features
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Auto-transform barrel imports for smaller bundles
    optimizePackageImports: ["lucide-react"],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: corsAllowedOrigin },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
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
