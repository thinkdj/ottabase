#!/usr/bin/env node

/**
 * Build Script for Development
 * Builds all required packages in the correct order
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const packages = [
  // Core dependencies (order matters!)
  '@ottabase/config',
  '@ottabase/db',
  '@ottabase/utils',
  '@ottabase/ui-base',
  '@ottabase/ui-code-highlight',
  '@ottabase/ui-shadcn',
  '@ottabase/ui-components',
  '@ottabase/ui-mantine',

  // Auth package (CRITICAL - this is what's causing the error!)
  '@ottabase/auth',

  // Other dependencies
  '@ottabase/api',
  '@ottabase/cf',
  '@ottabase/cf-realtime',
  '@ottabase/ottaorm',
  '@ottabase/ottaselect',
  '@ottabase/forms',
  '@ottabase/state',
  '@ottabase/ottaeditor',
  '@ottabase/ottarenderer',
];

console.log('🏗️  Building packages for development...\n');
console.log('This will take a few minutes. Please be patient.\n');

let successCount = 0;
let failedPackages = [];

for (const pkg of packages) {
  console.log(`📦 Building ${pkg}...`);
  try {
    execSync(`pnpm --filter ${pkg} build`, {
      stdio: 'inherit',
      cwd: __dirname,
    });
    successCount++;
    console.log(`✅ ${pkg} built successfully\n`);
  } catch (error) {
    console.error(`❌ Failed to build ${pkg}\n`);
    failedPackages.push(pkg);
  }
}

console.log('\n' + '='.repeat(60));
console.log(`\n✨ Build complete!`);
console.log(`   - ${successCount}/${packages.length} packages built successfully`);

if (failedPackages.length > 0) {
  console.log(`\n⚠️  Failed packages:`);
  failedPackages.forEach(pkg => console.log(`   - ${pkg}`));
  console.log(`\nTry building these manually with:`);
  console.log(`pnpm --filter <package-name> build`);
} else {
  console.log(`\n🎉 All packages built successfully!`);
  console.log(`\nYou can now start the dev servers:`);
  console.log(`   Terminal 1: pnpm dev:fe`);
  console.log(`   Terminal 2: pnpm dev:be`);
}

console.log('\n' + '='.repeat(60) + '\n');

// Verify critical files exist
const criticalFile = path.join(__dirname, 'packages/auth/dist/client-api.mjs');
if (fs.existsSync(criticalFile)) {
  console.log('✅ Critical file verified: packages/auth/dist/client-api.mjs');

  // Check if it exports getSession
  const content = fs.readFileSync(criticalFile, 'utf-8');
  if (content.includes('getSession')) {
    console.log('✅ getSession export verified!');
  } else {
    console.log('⚠️  Warning: getSession export not found in client-api.mjs');
  }
} else {
  console.log('❌ Critical file missing: packages/auth/dist/client-api.mjs');
  console.log('   Please run: pnpm --filter @ottabase/auth build');
}

console.log('');
