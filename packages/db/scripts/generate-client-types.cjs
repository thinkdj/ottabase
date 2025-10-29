#!/usr/bin/env node
/**
 * Generate type definitions for client.ts and index.ts
 * These files re-export from @prisma/client which may not be generated during build
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');

// Type definitions for client.ts
const clientDts = `import { PrismaClient } from "@prisma/client";
declare global {
    var __ottabase_prisma__: PrismaClient | undefined;
}
export declare const prisma: PrismaClient;
`;

// Type definitions for index.ts
const indexDts = `export * from "@prisma/client";
export type { PrismaClient } from "@prisma/client";
export { prisma } from "./client";
export * from "./prisma-config";
`;

// Write client.d.ts
fs.writeFileSync(path.join(distDir, 'client.d.ts'), clientDts);
fs.writeFileSync(path.join(distDir, 'client.d.mts'), clientDts);

// Write index.d.ts
fs.writeFileSync(path.join(distDir, 'index.d.ts'), indexDts);
fs.writeFileSync(path.join(distDir, 'index.d.mts'), indexDts);

console.log('✓ Generated type definitions for client and index modules');
