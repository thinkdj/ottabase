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
    it('reads app names from --app flags', () => {
        expect(getCliArgValue(['--app', 'otta-landing'], 'app')).toBe('otta-landing');
        expect(getCliArgValue(['--force', '--app=otta-web'], 'app')).toBe('otta-web');
        expect(getCliArgValue(['--force'], 'app')).toBeUndefined();
    });

    it('extracts resource names from wrangler.jsonc', () => {
        const cwd = makeTempApp(
            'custom-app',
            `{
                // top-level defaults
                "d1_databases": [{ "binding": "DB", "database_name": "custom-db", "preview_database_id": "preview" }],
                "kv_namespaces": [{ "binding": "CUSTOM_KV", "id": "YOUR_KV_NAMESPACE_ID", "preview_id": "YOUR_KV_PREVIEW_ID" }],
                "r2_buckets": [{ "binding": "FILES", "bucket_name": "custom-bucket", "preview_bucket_name": "custom-bucket-preview" }],
                "queues": { "producers": [{ "binding": "QUEUE", "queue": "custom-queue" }] },
                "env": {
                    "preview": {
                        "d1_databases": [{ "binding": "DB", "database_name": "custom-db-preview" }],
                        "queues": { "producers": [{ "binding": "QUEUE", "queue": "custom-queue-preview" }] },
                    },
                },
            }`,
        );

        const config = getCloudflareAppConfig('custom-app', cwd);

        expect(config.resources.d1).toEqual({
            production: 'custom-db',
            preview: 'custom-db-preview',
        });
        expect(config.resources.kv).toEqual({
            production: 'CUSTOM_KV',
            preview: 'CUSTOM_KV_preview',
        });
        expect(config.resources.r2).toEqual({
            production: 'custom-bucket',
            preview: 'custom-bucket-preview',
        });
        expect(config.resources.queue).toEqual({
            production: 'custom-queue',
            preview: 'custom-queue-preview',
        });
    });

    it('returns empty managed resources for apps without D1/KV/R2/Queue bindings', () => {
        const cwd = makeTempApp(
            'landing-like',
            `{
                "name": "landing-like",
                "assets": { "directory": "dist", "binding": "ASSETS" },
                "env": {
                    "preview": {
                        "assets": { "directory": "dist", "binding": "ASSETS" },
                    },
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
    });
});
