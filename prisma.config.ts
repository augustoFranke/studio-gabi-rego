import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // DIRECT_URL bypasses the connection pooler for migrations; falls back to
    // DATABASE_URL so `prisma generate` doesn't fail where DIRECT_URL is unset.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
})
