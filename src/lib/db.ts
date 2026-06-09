import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Force new PrismaClient if the cached one doesn't have the latest models
// This handles the case where schema changes generate a new client but the
// dev server still has the old cached instance
if (globalForPrisma.prisma) {
  try {
    const cached = globalForPrisma.prisma as Record<string, unknown>
    if (!cached.activityLog || !cached.interventionComment) {
      globalForPrisma.prisma = undefined
    }
  } catch {
    globalForPrisma.prisma = undefined
  }
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
