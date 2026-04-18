import fs from 'node:fs';
import path from 'node:path';

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
    // Run from apps/otta-landing to ensure correct paths
    const appFolder = path.basename(process.cwd());

    // OpenNext (via @opennextjs/aws copyTracedFiles) expects this folder to exist
    // in certain Next.js standalone layouts (notably monorepos).
    // If Next.js doesn't emit any CSS assets, the directory may be absent and
    // OpenNext currently throws during bundling.
    const dirsToEnsure = [
        path.join(process.cwd(), '.next', 'static', 'css'),
        path.join(process.cwd(), '.next', 'static', 'chunks'),
        path.join(process.cwd(), '.next', 'standalone', 'apps', appFolder, '.next', 'static', 'css'),
        path.join(process.cwd(), '.next', 'standalone', 'apps', appFolder, '.next', 'static', 'chunks'),
    ];

    for (const dir of dirsToEnsure) {
        ensureDir(dir);
    }

    // eslint-disable-next-line no-console
    console.log(`[ensure-opennext-dirs] ensured: ${dirsToEnsure.length} directories`);
}

main();
