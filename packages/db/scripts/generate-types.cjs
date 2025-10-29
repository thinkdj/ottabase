#!/usr/bin/env node
/**
 * Generate type definitions for all modules
 * Some files re-export from @prisma/client which may not be generated during build
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.join(__dirname, '../dist');

console.log('🔧 Generating type definitions...');

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

// Type definitions for prisma-config.ts
const prismaConfigDts = `export type { CoreSchemaName } from "../prisma/schemas";
export type PrismaProvider = "postgresql" | "mysql" | "sqlite" | "sqlserver" | "mongodb" | "cockroachdb";
export interface PrismaConfig {
    coreSchemas?: import("../prisma/schemas").CoreSchemaName[];
    provider?: PrismaProvider;
    appSchemaPath?: string;
    outputSchemaPath?: string;
    prismaGenerate?: {
        enabled?: boolean;
    };
}
export declare const definePrismaConfig: (config: PrismaConfig) => PrismaConfig;
`;

// Write client types
fs.writeFileSync(path.join(distDir, 'client.d.ts'), clientDts);
fs.writeFileSync(path.join(distDir, 'client.d.mts'), clientDts);
console.log('✓ Generated client types');

// Write index types
fs.writeFileSync(path.join(distDir, 'index.d.ts'), indexDts);
fs.writeFileSync(path.join(distDir, 'index.d.mts'), indexDts);
console.log('✓ Generated index types');

// Write prisma-config types
fs.writeFileSync(path.join(distDir, 'prisma-config.d.ts'), prismaConfigDts);
fs.writeFileSync(path.join(distDir, 'prisma-config.d.mts'), prismaConfigDts);
console.log('✓ Generated prisma-config types');

// Generate cloudflare types using TypeScript compiler (best effort)
try {
  execSync('pnpm exec tsc src/cloudflare.ts --declaration --emitDeclarationOnly --outDir dist --skipLibCheck', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
  // Copy to .d.mts
  const cloudflareTypes = fs.readFileSync(path.join(distDir, 'cloudflare.d.ts'), 'utf-8');
  fs.writeFileSync(path.join(distDir, 'cloudflare.d.mts'), cloudflareTypes);
  console.log('✓ Generated cloudflare types');
} catch (error) {
  console.warn('⚠ Could not generate cloudflare types automatically');
  console.warn('  Using existing types or manual fallback');

  // Check if cloudflare.d.ts exists, if not create a basic one
  const cloudflareDtsPath = path.join(distDir, 'cloudflare.d.ts');
  if (!fs.existsSync(cloudflareDtsPath)) {
    const basicCloudflareTypes = `export * from "@ottabase/cf-data/d1";
export * from "@ottabase/cf-data";
export interface CloudflarePrismaConfig {
    d1Database: any;
    debug?: boolean;
    prismaOptions?: any;
}
export interface CloudflarePrismaClient<T = any> {
    prisma: T;
    adapter: any;
}
export declare function createCloudflarePrisma<T = any>(
    PrismaClientConstructor: new (options?: any) => T,
    config: CloudflarePrismaConfig
): CloudflarePrismaClient<T>;
export declare function createCloudflarePrismaSingleton<T = any>(
    PrismaClientConstructor: new (options?: any) => T,
    configFactory: () => CloudflarePrismaConfig
): CloudflarePrismaClient<T>;
export declare function disconnectCloudflarePrisma(prisma: any): Promise<void>;
`;
    fs.writeFileSync(cloudflareDtsPath, basicCloudflareTypes);
    fs.writeFileSync(path.join(distDir, 'cloudflare.d.mts'), basicCloudflareTypes);
    console.log('✓ Created fallback cloudflare types');
  } else {
    // Copy existing to .d.mts
    const cloudflareTypes = fs.readFileSync(cloudflareDtsPath, 'utf-8');
    fs.writeFileSync(path.join(distDir, 'cloudflare.d.mts'), cloudflareTypes);
    console.log('✓ Used existing cloudflare types');
  }
}

console.log('✨ Type generation complete!');
