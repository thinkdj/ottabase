#!/usr/bin/env node
/**
 * Cloudflare Intelligent Auto-Setup Script
 *
 * Environment Variable Approach (SSOT):
 * 1. Reads wrangler.jsonc to discover required resources
 * 2. Checks if resources exist, creates if missing
 * 3. Writes resource IDs to .env.local (never modifies wrangler.jsonc)
 * 4. wrangler.jsonc uses ${CF_*} substitution automatically
 *
 * Best DX: One command, zero file conflicts, clean separation of concerns.
 *
 * Usage:
 *   cloudflare-setup              # Auto-detects from npm script context or cwd
 *   cloudflare-setup path/to/dir  # Explicit app directory
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";
const NC = "\x1b[0m";

function log(msg: string, color: string = NC) {
  console.log(`${color}${msg}${NC}`);
}

function runCommand(command: string, ignoreError = false): string {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (error) {
    if (ignoreError) return "";
    throw error;
  }
}

interface WranglerConfig {
  d1_databases?: Array<{
    binding: string;
    database_name: string;
    database_id: string;
  }>;
  kv_namespaces?: Array<{ binding: string; id: string; preview_id?: string }>;
  r2_buckets?: Array<{
    binding: string;
    bucket_name: string;
    preview_bucket_name?: string;
  }>;
  queues?: {
    producers?: Array<{ binding: string; queue: string }>;
  };
  env?: {
    production?: WranglerConfig;
  };
}

function parseWranglerConfig(wranglerPath: string): WranglerConfig {
  log(`📄 Reading configuration from ${path.basename(wranglerPath)}...`, BLUE);

  const content = fs.readFileSync(wranglerPath, "utf8");

  // Remove comments from JSONC
  const jsonContent = content
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove /* */ comments
    .replace(/\/\/.*/g, ""); // Remove // comments

  try {
    return JSON.parse(jsonContent);
  } catch (error) {
    log(`❌ Error parsing wrangler.jsonc: ${error}`, RED);
    process.exit(1);
  }
}

function ensureD1Database(
  wranglerCmd: string,
  dbName: string,
): string | null {
  log(`Checking D1 Database: ${dbName}...`, YELLOW);

  try {
    // Try to get existing database
    const d1Info = runCommand(`${wranglerCmd} d1 info ${dbName} --json`, true);
    if (d1Info) {
      const db = JSON.parse(d1Info);
      log(`✓ D1 Database exists: ${dbName} (${db.uuid})`, GREEN);
      return db.uuid;
    }
  } catch (e) {
    // Database doesn't exist, create it
  }

  try {
    log(`Creating D1 Database: ${dbName}...`, CYAN);
    const createOutput = runCommand(
      `${wranglerCmd} d1 create ${dbName} --json`,
    );
    const db = JSON.parse(createOutput);
    log(`✅ Created D1 Database: ${dbName} (${db.uuid})`, GREEN);
    return db.uuid;
  } catch (e) {
    log(`❌ Failed to create D1 Database: ${dbName}`, RED);
    return null;
  }
}

function ensureKVNamespace(
  wranglerCmd: string,
  binding: string,
  isPreview: boolean = false,
): string | null {
  const title = isPreview ? `${binding}_preview` : binding;
  log(`Checking KV Namespace: ${title}...`, YELLOW);

  try {
    const kvList = JSON.parse(
      runCommand(`${wranglerCmd} kv:namespace list --json`),
    );
    const existing = kvList.find((ns: any) => ns.title === title);

    if (existing) {
      log(`✓ KV Namespace exists: ${title} (${existing.id})`, GREEN);
      return existing.id;
    }
  } catch (e) {
    // Namespace doesn't exist
  }

  try {
    log(`Creating KV Namespace: ${title}...`, CYAN);
    const previewFlag = isPreview ? "--preview" : "";
    const createOutput = runCommand(
      `${wranglerCmd} kv:namespace create ${binding} ${previewFlag} --json`,
    );
    const ns = JSON.parse(createOutput);
    log(`✅ Created KV Namespace: ${title} (${ns.id})`, GREEN);
    return ns.id;
  } catch (e) {
    log(`❌ Failed to create KV Namespace: ${title}`, RED);
    return null;
  }
}

function ensureR2Bucket(wranglerCmd: string, bucketName: string): boolean {
  log(`Checking R2 Bucket: ${bucketName}...`, YELLOW);

  try {
    const r2List = runCommand(`${wranglerCmd} r2 bucket list --json`, true);
    if (r2List.includes(bucketName)) {
      log(`✓ R2 Bucket exists: ${bucketName}`, GREEN);
      return true;
    }
  } catch (e) {
    // Bucket doesn't exist
  }

  try {
    log(`Creating R2 Bucket: ${bucketName}...`, CYAN);
    runCommand(`${wranglerCmd} r2 bucket create ${bucketName}`);
    log(`✅ Created R2 Bucket: ${bucketName}`, GREEN);
    return true;
  } catch (e) {
    log(`❌ Failed to create R2 Bucket: ${bucketName}`, RED);
    return false;
  }
}

function ensureQueue(wranglerCmd: string, queueName: string): boolean {
  log(`Checking Queue: ${queueName}...`, YELLOW);

  try {
    const queueList = runCommand(`${wranglerCmd} queues list --json`, true);
    if (queueList.includes(queueName)) {
      log(`✓ Queue exists: ${queueName}`, GREEN);
      return true;
    }
  } catch (e) {
    // Queue doesn't exist
  }

  try {
    log(`Creating Queue: ${queueName}...`, CYAN);
    runCommand(`${wranglerCmd} queues create ${queueName}`);
    log(`✅ Created Queue: ${queueName}`, GREEN);
    return true;
  } catch (e) {
    log(`❌ Failed to create Queue: ${queueName}`, RED);
    return false;
  }
}

function writeEnvFile(
  appDir: string,
  resourceIds: Map<string, string>,
): void {
  const envPath = path.join(appDir, ".env.local");
  log(`\n📝 Writing resource IDs to .env.local...`, BLUE);

  let envContent = "";

  // Read existing .env.local if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  // Helper to update or append env var
  const updateEnvVar = (key: string, value: string) => {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
      log(`  ✓ Updated ${key}`, GREEN);
    } else {
      // Add to Cloudflare section or append
      const cfSectionMatch = envContent.match(
        /# CLOUDFLARE RESOURCES[\s\S]*?(?=\n# [A-Z]|$)/,
      );
      if (cfSectionMatch) {
        const insertPos = cfSectionMatch.index! + cfSectionMatch[0].length;
        envContent =
          envContent.slice(0, insertPos) +
          `\n${key}=${value}` +
          envContent.slice(insertPos);
      } else {
        // No CF section exists, create it
        if (envContent && !envContent.endsWith("\n")) envContent += "\n";
        if (!envContent.includes("# CLOUDFLARE RESOURCES")) {
          envContent += `\n# CLOUDFLARE RESOURCES\n`;
        }
        envContent += `${key}=${value}\n`;
      }
      log(`  ✓ Added ${key}`, GREEN);
    }
  };

  // Write all resource IDs
  for (const [key, value] of resourceIds.entries()) {
    updateEnvVar(key, value);
  }

  fs.writeFileSync(envPath, envContent);
  log(`\n✅ Wrote ${resourceIds.size} resource ID(s) to .env.local`, GREEN);
  log(`   File: ${envPath}`, CYAN);
}

function processConfig(
  wranglerCmd: string,
  config: WranglerConfig,
): Map<string, string> {
  const resourceIds = new Map<string, string>();

  log("\n🔍 Discovering and ensuring resources...", BLUE);
  log("", NC);

  // Process D1 Databases
  if (config.d1_databases) {
    for (const db of config.d1_databases) {
      const id = ensureD1Database(wranglerCmd, db.database_name);
      if (id) {
        resourceIds.set("CF_D1_DATABASE_ID", id);
      }
    }
  }

  // Process KV Namespaces
  if (config.kv_namespaces) {
    for (const kv of config.kv_namespaces) {
      const id = ensureKVNamespace(wranglerCmd, kv.binding);
      if (id) {
        resourceIds.set("CF_KV_NAMESPACE_ID", id);
      }

      if (kv.preview_id) {
        const previewId = ensureKVNamespace(wranglerCmd, kv.binding, true);
        if (previewId) {
          resourceIds.set("CF_KV_PREVIEW_ID", previewId);
        }
      }
    }
  }

  // Process R2 Buckets
  if (config.r2_buckets) {
    for (const r2 of config.r2_buckets) {
      ensureR2Bucket(wranglerCmd, r2.bucket_name);

      if (r2.preview_bucket_name) {
        ensureR2Bucket(wranglerCmd, r2.preview_bucket_name);
      }
    }
  }

  // Process Queues
  if (config.queues?.producers) {
    for (const producer of config.queues.producers) {
      ensureQueue(wranglerCmd, producer.queue);
    }
  }

  return resourceIds;
}

function main() {
  log("", NC);
  log(
    "═══════════════════════════════════════════════════════════════",
    CYAN,
  );
  log("  🚀 Cloudflare Intelligent Auto-Setup", CYAN);
  log(
    "═══════════════════════════════════════════════════════════════",
    CYAN,
  );
  log("", NC);

  const args = process.argv.slice(2);

  // Smart directory detection with priority:
  // 1. Explicit argument (app directory or wrangler.jsonc path)
  // 2. npm_package_json context (if run as npm/pnpm script)
  // 3. Current directory
  // 4. Default app (fallback)
  let appDir: string;
  let wranglerPath: string;

  if (args[0]) {
    // Explicit path provided
    const argPath = path.resolve(args[0]);
    if (fs.existsSync(argPath)) {
      if (fs.statSync(argPath).isDirectory()) {
        appDir = argPath;
        wranglerPath = path.join(appDir, "wrangler.jsonc");
      } else if (argPath.endsWith("wrangler.jsonc")) {
        wranglerPath = argPath;
        appDir = path.dirname(wranglerPath);
      } else {
        log(`❌ Error: Invalid path: ${argPath}`, RED);
        process.exit(1);
      }
    } else {
      log(`❌ Error: Path not found: ${argPath}`, RED);
      process.exit(1);
    }
  } else if (process.env.npm_package_json) {
    // Run via npm/pnpm script - use app's directory
    appDir = path.dirname(process.env.npm_package_json);
    wranglerPath = path.join(appDir, "wrangler.jsonc");
    log(
      `📦 Detected app context from package.json: ${path.basename(appDir)}`,
      CYAN,
    );
  } else if (fs.existsSync(path.join(process.cwd(), "wrangler.jsonc"))) {
    // Current directory has wrangler.jsonc
    appDir = process.cwd();
    wranglerPath = path.join(appDir, "wrangler.jsonc");
  } else {
    // Fallback to default app
    appDir = path.join(process.cwd(), "apps", "ottabase-template-app");
    wranglerPath = path.join(appDir, "wrangler.jsonc");
  }

  if (!fs.existsSync(wranglerPath)) {
    log(`❌ Error: ${wranglerPath} not found!`, RED);
    log(`   Tried: ${wranglerPath}`, YELLOW);
    process.exit(1);
  }

  // Determine wrangler command based on app location
  // Extract app name from path: apps/my-app/wrangler.jsonc -> my-app
  const appMatch = appDir.match(/apps[\/\\]([^\/\\]+)$/);
  let wranglerCmd: string;

  if (appMatch) {
    // Running in monorepo apps/ folder - use filtered wrangler
    const appName = appMatch[1];
    wranglerCmd = `pnpm --filter ${appName} exec wrangler`;
    log(`📍 Detected app: ${appName}`, CYAN);
  } else {
    // Running outside apps/ folder - use global wrangler
    wranglerCmd = "wrangler";
  }

  // Check wrangler is available
  try {
    runCommand(`${wranglerCmd} --version`);
    log(`✓ Wrangler CLI is available`, GREEN);
  } catch (e) {
    log(`❌ Error: wrangler is not installed or not accessible`, RED);
    log(`   Run: pnpm install`, YELLOW);
    process.exit(1);
  }

  // Check authentication
  log(`Checking Cloudflare authentication...`, YELLOW);
  const whoamiResult = runCommand(`${wranglerCmd} whoami`, true);

  if (!whoamiResult || whoamiResult.includes("not authenticated")) {
    log("", NC);
    log(
      "═══════════════════════════════════════════════════════════════",
      RED,
    );
    log("  ❌ ERROR: Not logged in to Cloudflare", RED);
    log(
      "═══════════════════════════════════════════════════════════════",
      RED,
    );
    log("", NC);
    log("Please run the following command to login:", YELLOW);
    log("", NC);
    log("  npx wrangler login", GREEN);
    log("", NC);
    log(
      "This will open a browser window to authenticate with Cloudflare.",
      NC,
    );
    log("After logging in, run this script again.", NC);
    log("", NC);
    process.exit(1);
  }

  log(`✅ Authenticated as: ${whoamiResult.split("\n")[0]}`, GREEN);

  // Parse wrangler.jsonc
  const config = parseWranglerConfig(wranglerPath);

  // Process top-level config
  const resourceIds = processConfig(wranglerCmd, config);

  // Process production config (if exists)
  if (config.env?.production) {
    log("\n🏭 Processing production environment config...", BLUE);
    const prodResourceIds = processConfig(wranglerCmd, config.env.production);

    // Merge resource IDs (production takes precedence)
    for (const [key, value] of prodResourceIds.entries()) {
      resourceIds.set(key, value);
    }
  }

  // Write resource IDs to .env.local
  if (resourceIds.size > 0) {
    writeEnvFile(appDir, resourceIds);
  } else {
    log("\n✅ No resources found to configure!", GREEN);
  }

  log("", NC);
  log(
    "═══════════════════════════════════════════════════════════════",
    GREEN,
  );
  log("  ✅ Setup Complete!", GREEN);
  log(
    "═══════════════════════════════════════════════════════════════",
    GREEN,
  );
  log("", NC);
  log(
    `All resources are ready and .env.local contains the IDs.`,
    NC,
  );
  log(
    `wrangler.jsonc uses \${CF_*} substitution automatically.`,
    CYAN,
  );
  log("", NC);
  log("You can now run:", YELLOW);
  log("  pnpm dev          # Local development", NC);
  log("  pnpm deploy       # Deploy to Cloudflare", NC);
  log("", NC);
}

main();
