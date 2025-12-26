#!/usr/bin/env node

/**
 * CI Build Script
 * Temporarily replaces Google Fonts with system fonts for CI builds
 * to avoid network dependencies during build time
 */

const fs = require('fs');
const path = require('path');

const FONT_PROVIDER_PATH = path.join(__dirname, '../ottabase/providers/ProviderFont.tsx');
const BACKUP_PATH = path.join(__dirname, '../ottabase/providers/ProviderFont.tsx.backup');
const TEMPLATE_PATH = path.join(__dirname, 'ProviderFont.ci.template.tsx');

function replaceWithCIFonts() {
  console.log('[CI Build] Replacing Google Fonts with system fonts...');
  
  // Backup original file
  const originalContent = fs.readFileSync(FONT_PROVIDER_PATH, 'utf8');
  fs.writeFileSync(BACKUP_PATH, originalContent, 'utf8');
  
  // Read and use template
  const templateContent = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  fs.writeFileSync(FONT_PROVIDER_PATH, templateContent, 'utf8');
  
  console.log('[CI Build] Font provider replaced successfully');
}

function restoreOriginalFonts() {
  console.log('[CI Build] Restoring original font provider...');
  
  if (!fs.existsSync(BACKUP_PATH)) {
    console.log('[CI Build] No backup found, skipping restore');
    return;
  }
  
  if (!fs.existsSync(FONT_PROVIDER_PATH)) {
    console.warn('[CI Build] Warning: Original file was deleted, creating from backup');
  }
  
  const backupContent = fs.readFileSync(BACKUP_PATH, 'utf8');
  fs.writeFileSync(FONT_PROVIDER_PATH, backupContent, 'utf8');
  fs.unlinkSync(BACKUP_PATH);
  console.log('[CI Build] Font provider restored successfully');
}

const command = process.argv[2];

if (command === 'replace') {
  replaceWithCIFonts();
} else if (command === 'restore') {
  restoreOriginalFonts();
} else {
  console.error('Usage: node ci-build.js [replace|restore]');
  process.exit(1);
}
