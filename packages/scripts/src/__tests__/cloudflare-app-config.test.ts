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

    it('extracts resource names from wrangler.jsonc with env.production overrides', () => {
        const cwd = makeTempApp(
            'custom-app',
            `{
                // top-level defaults (local dev)
                "d1_databases": [{ "binding": "DB", "database_name": "custom-db" }],
                "kv_namespaces": [{ "binding": "CUSTOM_KV", "id": "YOUR_KV_NAMESPACE_ID", "preview_id": "YOUR_KV_PREVIEW_ID" }],
                "r2_buckets": [{ "binding": "FILES", "bucket_name": "custom-bucket", "preview_bucket_name": "custom-bucket-preview" }],
                "queues": { "producers": [{ "binding": "QUEUE", "queue": "custom-queue" }] },
                "analytics_engine_datasets": [{ "binding": "AE", "dataset": "custom_events" }],
                "env": {
                    "production": {
                        "d1_databases": [{ "binding": "DB", "database_name": "custom-db" }],
                        "kv_namespaces": [{ "binding": "CUSTOM_KV", "id": "KV_NAMESPACE_ID" }],
                        "r2_buckets": [{ "binding": "FILES", "bucket_name": "custom-bucket" }],
                        "queues": { "producers": [{ "binding": "QUEUE", "queue": "custom-queue" }] },
                    },
                    "preview": {
                        "d1_databases": [{ "binding": "DB", "database_name": "custom-db-preview" }],
                        "kv_namespaces": [{ "binding": "CUSTOM_KV", "id": "KV_PREVIEW_NAMESPACE_ID" }],
                        "r2_buckets": [{ "binding": "FILES", "bucket_name": "custom-bucket-preview" }],
                        "queues": { "producers": [{ "binding": "QUEUE", "queue": "custom-queue-preview" }] },
                    },
                },
            }`,
        );

        const config = getCloudflareAppConfig('custom-app', cwd);

        expect(config.resources.d1).toEqual({ production: 'custom-db', preview: 'custom-db-preview' });
        expect(config.resources.kv).toEqual({ production: 'CUSTOM_KV', preview: 'CUSTOM_KV_preview' });
        expect(config.resources.r2).toEqual({ production: 'custom-bucket', preview: 'custom-bucket-preview' });
        expect(config.resources.queue).toEqual({ production: 'custom-queue', preview: 'custom-queue-preview' });
        expect(config.analyticsDatasets).toEqual(['custom_events']);
    });

    it('no KV preview when env.preview has no kv_namespaces', () => {
        const cwd = makeTempApp(
            'no-kv-preview',
            `{
                "kv_namespaces": [{ "binding": "MY_KV", "id": "YOUR_ID" }],
                "env": {
                    "preview": { "vars": { "ENV": "preview" } },
                },
            }`,
        );
        const config = getCloudflareAppConfig('no-kv-preview', cwd);
        expect(config.resources.kv).toEqual({ production: 'MY_KV', preview: undefined });
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

        expect(config.resources).toEqual({
            d1: { production: undefined, preview: undefined },
            kv: { production: undefined, preview: undefined },
            r2: { production: undefined, preview: undefined },
            queue: { production: undefined, preview: undefined },
        });
        expect(config.analyticsDatasets).toEqual([]);
    });

    it('throws when wrangler.jsonc is missing', () => {
        expect(() => getCloudflareAppConfig('nonexistent', '/tmp')).toThrow('wrangler.jsonc not found');
    });
});
