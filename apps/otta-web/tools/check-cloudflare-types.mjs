import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const generatedName = 'cloudflare-env.d.ts';
const candidateName = 'cloudflare-env.check.d.ts';
const generatedPath = join(appRoot, generatedName);
const candidatePath = join(appRoot, candidateName);
const wranglerPath = require.resolve('wrangler/bin/wrangler.js');

function normalize(content) {
    return content.replaceAll(candidateName, generatedName).replaceAll('\r\n', '\n');
}

try {
    const result = spawnSync(
        process.execPath,
        [
            wranglerPath,
            'types',
            candidateName,
            '--env-interface',
            'CloudflareEnv',
            '--include-runtime',
            'false',
            '--strict-vars',
            'false',
            '--env-file',
            '.env.example',
        ],
        {
            cwd: appRoot,
            env: {
                ...process.env,
                WRANGLER_LOG_PATH: join(appRoot, '.wrangler', 'logs'),
            },
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'inherit'],
        },
    );

    if (result.status !== 0) {
        if (result.stdout) process.stderr.write(result.stdout);
        if (result.error) console.error(result.error.message);
        process.exitCode = result.status ?? 1;
    } else {
        const committed = normalize(readFileSync(generatedPath, 'utf8'));
        const candidate = normalize(readFileSync(candidatePath, 'utf8'));

        if (committed !== candidate) {
            console.error(`Cloudflare types are stale. Run "pnpm cf-typegen" in ${appRoot}.`);
            process.exitCode = 1;
        } else {
            console.log('Cloudflare types are up to date.');
        }
    }
} finally {
    rmSync(candidatePath, { force: true });
}
