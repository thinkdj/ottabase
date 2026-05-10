import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { getCliArgValue, getCloudflareAppConfig } from '../cli/cloudflare-app-config';

const tempDirs: string[] = [];

function makeTempApp(appName: string, wranglerContent: string): string {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ottabase-scripts-'));
    const appDir = path.join(rootDir, 'apps', appName);
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'wrangler.jsonc'), wranglerContent);
    tempDirs.push(rootDir);
    return rootDir;
}

afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

describe('cloudflare app config', () => {
    it('reads --app flag values', () => {
        expect(getCliArgValue(['--app', 'otta-landing'], 'app')).toBe('otta-landing');
        expect(getCliArgValue(['--force', '--app=otta-web'], 'app')).toBe('otta-web');
        expect(getCliArgValue(['--force'], 'app')).toBeUndefined();
        // --app= with empty value
        expect(getCliArgValue(['--app='], 'app')).toBe('');
        // --app followed by another flag (no value) should return undefined
        expect(getCliArgValue(['--app', '--force'], 'app')).toBeUndefined();
    });

    it('derives KV namespace title from wrangler name field and exposes binding separately', () => {
        const cwd = makeTempApp(
            'custom-app',
            `{
                "name": "custom-app",
                // top-level defaults (local dev)
                "d1_databases": [{ "binding": "DB", "database_name": "custom-db", "database_id": "YOUR_D1_DATABASE_ID" }],
                "kv_namespaces": [{ "binding": "OBCF_KV", "id": "YOUR_KV_NAMESPACE_ID", "preview_id": "YOUR_KV_PREVIEW_ID" }],
                "r2_buckets": [{ "binding": "FILES", "bucket_name": "custom-bucket", "preview_bucket_name": "custom-bucket-preview" }],
                "queues": { "producers": [{ "binding": "QUEUE", "queue": "custom-queue" }] },
                "analytics_engine_datasets": [{ "binding": "AE", "dataset": "custom_events" }],
                "env": {
                    "production": {
                        "d1_databases": [{ "binding": "DB", "database_name": "custom-db", "database_id": "D1_DATABASE_ID" }],
                        "kv_namespaces": [{ "binding": "OBCF_KV", "id": "KV_NAMESPACE_ID" }],
                        "r2_buckets": [{ "binding": "FILES", "bucket_name": "custom-bucket" }],
                        "queues": { "producers": [{ "binding": "QUEUE", "queue": "custom-queue" }] },
                    },
                    "preview": {
                        "d1_databases": [{ "binding": "DB", "database_name": "custom-db-preview", "database_id": "D1_PREVIEW_DATABASE_ID" }],
                        "kv_namespaces": [{ "binding": "OBCF_KV", "id": "KV_PREVIEW_NAMESPACE_ID" }],
                        "r2_buckets": [{ "binding": "FILES", "bucket_name": "custom-bucket-preview" }],
                        "queues": { "producers": [{ "binding": "QUEUE", "queue": "custom-queue-preview" }] },
                    },
                },
            }`,
        );

        const config = getCloudflareAppConfig('custom-app', cwd);

        expect(config.wranglerName).toBe('custom-app');

        // D1/R2/Queue names come directly from the wrangler.jsonc resource name fields
        expect(config.resources.d1).toEqual({ production: 'custom-db', preview: 'custom-db-preview' });
        expect(config.resources.r2).toEqual({ production: 'custom-bucket', preview: 'custom-bucket-preview' });
        expect(config.resources.queue).toEqual({ production: 'custom-queue', preview: 'custom-queue-preview' });

        // KV namespace titles are derived from the wrangler name; binding stays generic
        expect(config.resources.kv).toEqual({
            production: 'custom-app-kv',
            preview: 'custom-app-kv_preview',
            binding: 'OBCF_KV',
        });

        expect(config.analyticsDatasets).toEqual(['custom_events']);

        // Secret keys are read from env.production/preview ALL_CAPS placeholder values
        expect(config.secretKeys).toEqual({
            d1: 'D1_DATABASE_ID',
            d1Preview: 'D1_PREVIEW_DATABASE_ID',
            kv: 'KV_NAMESPACE_ID',
            kvPreview: 'KV_PREVIEW_NAMESPACE_ID',
        });
    });

    it('falls back to appName for KV title when wrangler.jsonc has no name field', () => {
        const cwd = makeTempApp(
            'my-fallback-app',
            `{
                "kv_namespaces": [{ "binding": "MY_KV", "id": "YOUR_ID" }],
                "env": {
                    "preview": { "kv_namespaces": [{ "binding": "MY_KV", "id": "YOUR_PREVIEW_ID" }] },
                },
            }`,
        );
        const config = getCloudflareAppConfig('my-fallback-app', cwd);
        expect(config.wranglerName).toBe('my-fallback-app');
        expect(config.resources.kv).toEqual({
            production: 'my-fallback-app-kv',
            preview: 'my-fallback-app-kv_preview',
            binding: 'MY_KV',
        });
    });

    it('no KV preview when env.preview has no kv_namespaces', () => {
        const cwd = makeTempApp(
            'no-kv-preview',
            `{
                "name": "no-kv-preview",
                "kv_namespaces": [{ "binding": "MY_KV", "id": "YOUR_ID" }],
                "env": {
                    "preview": { "vars": { "ENV": "preview" } },
                },
            }`,
        );
        const config = getCloudflareAppConfig('no-kv-preview', cwd);
        expect(config.resources.kv).toEqual({ production: 'no-kv-preview-kv', preview: undefined, binding: 'MY_KV' });
    });

    it('returns empty resources for apps without D1/KV/R2/Queue bindings', () => {
        const cwd = makeTempApp(
            'landing-like',
            `{
                "name": "landing-like",
                "assets": { "directory": "dist", "binding": "ASSETS" },
                "env": {
                    "preview": { "assets": { "directory": "dist", "binding": "ASSETS" } },
                },
            }`,
        );

        const config = getCloudflareAppConfig('landing-like', cwd);

        expect(config.wranglerName).toBe('landing-like');
        expect(config.resources.d1).toEqual({ production: undefined, preview: undefined });
        expect(config.resources.kv).toEqual({ production: undefined, preview: undefined, binding: undefined });
        expect(config.resources.r2).toEqual({ production: undefined, preview: undefined });
        expect(config.resources.queue).toEqual({ production: undefined, preview: undefined });
        expect(config.analyticsDatasets).toEqual([]);
        // No env.production placeholders → no secret keys
        expect(config.secretKeys).toEqual({ d1: undefined, d1Preview: undefined, kv: undefined, kvPreview: undefined });
    });

    it('filters out non-ALL_CAPS values from secretKeys (UUIDs, YOUR_* stay as undefined)', () => {
        const cwd = makeTempApp(
            'secret-test',
            `{
                "name": "secret-test",
                "kv_namespaces": [{ "binding": "KV", "id": "YOUR_KV_ID" }],
                "env": {
                    "production": {
                        "d1_databases": [{ "binding": "DB", "database_name": "test-db", "database_id": "YOUR_D1_ID" }],
                        "kv_namespaces": [{ "binding": "KV", "id": "12345678901234567890123456789012" }],
                    },
                    "preview": {
                        "kv_namespaces": [{ "binding": "KV", "id": "KV_PREVIEW_NAMESPACE_ID" }],
                    },
                },
            }`,
        );
        const config = getCloudflareAppConfig('secret-test', cwd);
        // YOUR_D1_ID matches ALL_CAPS but starts with YOUR_ → excluded
        expect(config.secretKeys.d1).toBeUndefined();
        // UUID-like 32-char hex starts with a digit → excluded by ^[A-Z] regex
        expect(config.secretKeys.kv).toBeUndefined();
        // KV_PREVIEW_NAMESPACE_ID is ALL_CAPS and does not start with YOUR_ → included
        expect(config.secretKeys.kvPreview).toBe('KV_PREVIEW_NAMESPACE_ID');
    });

    it('throws when wrangler.jsonc is missing', () => {
        expect(() => getCloudflareAppConfig('nonexistent', '/tmp')).toThrow('wrangler.jsonc not found');
    });
});
