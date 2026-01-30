// ============================================================
// @ottabase/db - Base Prisma Client
// ============================================================
//
// ⚠️ WARNING: For Cloudflare D1, DO NOT use this client!
//
// This client is for:
//   - Local development (non-D1)
//   - Traditional databases (PostgreSQL, MySQL)
//   - Server-side Node.js environments
//
// For Cloudflare Workers with D1:
//   ✅ Use: import { createPrismaD1Client } from "@ottabase/cf/d1-prisma";
//   ✅ Example:
//      const prisma = createPrismaD1Client(env.OBCF_D1);
//      const users = await prisma.user.findMany();
//
// This client uses the standard Prisma adapter which is NOT
// compatible with Cloudflare's D1 database binding.
// ============================================================

// Type-safe conditional export for PrismaClient
export type { PrismaClient } from '@prisma/client';

// Lazy import to avoid circular dependency during schema generation
let PrismaClientClass: any;
let prismaInstance: any;

try {
    // Only import if @prisma/client is available
    const prismaModule = require('@prisma/client');
    PrismaClientClass = prismaModule.PrismaClient;
} catch {
    // @prisma/client not generated yet - this is fine during schema generation
    PrismaClientClass = null;
}

declare global {
    // eslint-disable-next-line no-var
    var __ottabase_prisma__: any | undefined;
}

/**
 * Base Prisma client for non-D1 environments
 *
 * @deprecated For D1, use createPrismaD1Client from @ottabase/cf/d1-prisma
 */
export const prisma = (() => {
    if (!PrismaClientClass) {
        return null;
    }
    if (globalThis.__ottabase_prisma__) {
        return globalThis.__ottabase_prisma__;
    }
    prismaInstance = new PrismaClientClass();
    if (process.env.NODE_ENV !== 'production') {
        globalThis.__ottabase_prisma__ = prismaInstance;
    }
    return prismaInstance;
})();
