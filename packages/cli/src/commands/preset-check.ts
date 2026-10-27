import { execFileSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { getMonorepoRoot, log } from '../utils/index.js';
import { scaffoldApp } from './new.js';
import { PRESETS, presetNames } from './presets.js';
import { walkText } from './strip.js';

/**
 * `otta presets check`: the proof that a preset scaffolds a working app. Without it a footprint
 * that misses a file, or a marker that cuts one line too many, is found by the first maker to try
 * the preset. CI runs it for `minimal`; run it for every preset after touching the template.
 */
export interface PresetCheckResult {
    preset: string;
    app: string;
    passed: boolean;
    results: { step: string; ok: boolean; output: string }[];
}

/**
 * Scaffold a preset into `apps/preset-check-<preset>`, borrow otta-web's node_modules, and run what a
 * maker would run: every tsconfig, the linter, the tests. Plus one check only a scaffold needs: no
 * import of a stripped package may remain (the borrowed node_modules would mask it).
 */
export function checkPreset(root: string, presetName: string, options: { keep?: boolean } = {}): PresetCheckResult {
    if (!PRESETS[presetName]) throw new Error(`Unknown preset "${presetName}". Presets: ${presetNames().join(', ')}.`);
    const app = `preset-check-${presetName}`;
    const appDir = path.join(root, 'apps', app);
    const results: PresetCheckResult['results'] = [];
    fs.removeSync(appDir);
    const scaffold = scaffoldApp(root, 'web', app, { preset: presetName });
    const modules = path.join(appDir, 'node_modules');
    const referenceModules = path.join(root, 'apps', 'otta-web', 'node_modules');
    if (!fs.existsSync(referenceModules)) {
        throw new Error('apps/otta-web/node_modules is missing: run pnpm install first.');
    }
    fs.symlinkSync(referenceModules, modules, 'junction');

    const run = (step: string, file: string, args: string[]) => {
        try {
            const output = execFileSync(process.execPath, [path.join(modules, file), ...args], {
                cwd: appDir,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
                maxBuffer: 64 * 1024 * 1024,
            });
            results.push({ step, ok: true, output });
        } catch (error) {
            const failed = error as { stdout?: string; stderr?: string; message?: string };
            const output = `${failed.stdout ?? ''}${failed.stderr ?? ''}` || failed.message || '';
            results.push({ step, ok: false, output });
        }
    };

    try {
        // A stripped package must leave no import behind. Import statements only: a path alias in a
        // tsconfig or a Vite config points at the monorepo and is harmless.
        const leftovers: string[] = [];
        for (const file of walkText(appDir)) {
            const source = fs.readFileSync(file, 'utf8');
            for (const name of scaffold.dependenciesDropped) {
                const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = new RegExp(`(?:from\\s*|import\\s*\\(\\s*|require\\s*\\(\\s*)['"]${escaped}(?:/|['"])`);
                if (pattern.test(source))
                    leftovers.push(`${path.relative(appDir, file).split(path.sep).join('/')}: ${name}`);
            }
        }
        results.push({
            step: 'no import of a stripped package',
            ok: leftovers.length === 0,
            output: leftovers.join('\n'),
        });

        for (const tsconfig of fs
            .readdirSync(appDir)
            .filter((name) => /^tsconfig.*\.json$/.test(name))
            .sort()) {
            run(`tsc -p ${tsconfig}`, 'typescript/bin/tsc', ['-p', tsconfig, '--noEmit']);
        }
        run('eslint', 'eslint/bin/eslint.js', ['src', 'worker', 'ottabase', 'cloudflare-worker.ts']);
        run('vitest', 'vitest/vitest.mjs', ['run']);
    } finally {
        fs.unlinkSync(modules);
        if (!options.keep) fs.removeSync(appDir);
    }
    return { preset: presetName, app, passed: results.every((result) => result.ok), results };
}

/** `otta presets check [preset…]`: scaffold each preset and run its gates. False when one fails. */
export function checkPresets(names: string[], options: { keep?: boolean } = {}): boolean {
    const root = getMonorepoRoot();
    let passed = true;
    for (const name of names.length ? names : presetNames()) {
        log.step(`Checking preset ${name}`);
        const result = checkPreset(root, name, options);
        for (const step of result.results) {
            if (step.ok) log.success(step.step);
            else {
                log.error(step.step);
                // Every failing file or compiler error once, then the tail of the output for the detail.
                const lines = step.output.replace(/\u001b\[[0-9;]*m/g, '').split('\n');
                const headline = [
                    ...new Set(lines.filter((line) => /\bFAIL\b|error TS\d+|^\s+\d+:\d+\s+error\s|^\s*✗/.test(line))),
                ];
                console.log([...headline, '…', ...lines.slice(-60)].join('\n'));
            }
        }
        if (result.passed) log.done(`preset ${name} scaffolds, type-checks, lints and tests.`);
        else log.failed(`preset ${name}${options.keep ? ` (kept at apps/${result.app})` : ''}`);
        passed = passed && result.passed;
    }
    return passed;
}
