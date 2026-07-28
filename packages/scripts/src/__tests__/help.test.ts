import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildHelpModel, readRootScripts, render } from '../cli/help';

// Render assertions compare plain text, so pin colors off regardless of the runner's TTY.
const previousNoColor = process.env.NO_COLOR;
beforeAll(() => {
    process.env.NO_COLOR = '1';
});
afterAll(() => {
    if (previousNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = previousNoColor;
});

/** Minimal script map standing in for the root package.json. */
const SCRIPTS = {
    dev: 'node dev.js',
    'clean:d1': 'pnpm --filter @ottabase/scripts run clean-d1',
    'clean:state': 'pnpm --filter @ottabase/scripts run clean-state',
    'cf:setup': 'node packages/scripts/bin/cloudflare-setup.cjs',
    prepare: 'husky',
    'some:new:script': 'echo hi',
};

function rowsFor(model: ReturnType<typeof buildHelpModel>, group: string) {
    return model.groups.find((entry) => entry.group === group)?.rows ?? [];
}

let tempDirs: string[] = [];
function makeTempDir(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
    tempDirs = [];
});

describe('help', () => {
    it('groups documented commands and carries the underlying command through', () => {
        const model = buildHelpModel({ scripts: SCRIPTS });

        expect(rowsFor(model, 'Development').map((row) => row.name)).toEqual(['dev']);
        expect(rowsFor(model, 'Cleanup').map((row) => row.name)).toEqual(['clean:d1', 'clean:state']);
        expect(rowsFor(model, 'Cloudflare').map((row) => row.name)).toEqual(['cf:setup']);
        expect(rowsFor(model, 'Development')[0]?.runs).toBe('node dev.js');
    });

    it('surfaces scripts that have no documentation instead of dropping them', () => {
        const model = buildHelpModel({ scripts: SCRIPTS });
        const other = rowsFor(model, 'Other');

        expect(other.map((row) => row.name)).toEqual(['some:new:script']);
        expect(other[0]?.desc).toBe('(undocumented)');
    });

    it('reports documented commands whose script no longer exists', () => {
        const model = buildHelpModel({ scripts: SCRIPTS });

        // The registry documents the full script set, so anything absent here is stale.
        expect(model.stale).toContain('clean:all');
        expect(model.stale).toContain('env:secrets');
        expect(model.stale).not.toContain('clean:d1');
    });

    it('hides internal lifecycle scripts unless --all is passed', () => {
        const visible = buildHelpModel({ scripts: SCRIPTS });
        const all = buildHelpModel({ scripts: SCRIPTS, all: true });

        expect(rowsFor(visible, 'Repo').map((row) => row.name)).not.toContain('prepare');
        expect(rowsFor(all, 'Repo').map((row) => row.name)).toContain('prepare');
        expect(all.total).toBe(visible.total + 1);
    });

    it('filters by command name, description, and group', () => {
        const byName = buildHelpModel({ scripts: SCRIPTS, filter: 'clean' });
        expect(byName.groups.flatMap((entry) => entry.rows).map((row) => row.name)).toEqual([
            'clean:d1',
            'clean:state',
        ]);

        // Description matches cross group boundaries: `dev` mentions Wrangler too.
        const byDesc = buildHelpModel({ scripts: SCRIPTS, filter: 'wrangler' });
        expect(byDesc.groups.flatMap((entry) => entry.rows).map((row) => row.name)).toEqual(['dev', 'clean:state']);

        const byGroup = buildHelpModel({ scripts: SCRIPTS, filter: 'cloudflare' });
        expect(byGroup.groups.flatMap((entry) => entry.rows).map((row) => row.name)).toEqual(['cf:setup']);

        expect(buildHelpModel({ scripts: SCRIPTS, filter: 'nothing-matches' }).total).toBe(0);
    });

    it('marks destructive commands and notes the local/remote split', () => {
        const output = render(buildHelpModel({ scripts: SCRIPTS }));

        expect(output).toContain('! pnpm clean:d1');
        expect(output).toContain('  pnpm dev');
        expect(output).not.toContain('! pnpm dev');
        expect(output).toContain('never touches your Cloudflare account');
        expect(output).toContain('REMOTE Cloudflare account');
    });

    it('explains itself when a filter matches nothing', () => {
        const model = buildHelpModel({ scripts: SCRIPTS, filter: 'nope' });
        const output = render(model, { filter: 'nope' });

        expect(output).toContain('No command matches "nope"');
        expect(output).toContain('Run without a filter');
    });

    it('does not blame an "undefined" filter when there is no filter and nothing to show', () => {
        // Distinct from the filter-mismatch case above: no filter was given at all, so the
        // message must not reference one. This is also the shape a broken package.json
        // would have produced before readRootScripts started throwing instead of swallowing.
        const model = buildHelpModel({ scripts: {} });
        const output = render(model, {});

        expect(output).not.toContain('undefined');
        expect(output).toContain('No commands found.');
    });

    it('distinguishes risk tiers instead of a single destructive marker', () => {
        const output = render(
            buildHelpModel({
                scripts: {
                    'clean:cache': 'node bin/clean-cache.cjs',
                    'clean:d1': 'pnpm --filter @ottabase/scripts run clean-d1',
                    'cf:setup': 'node packages/scripts/bin/cloudflare-setup.cjs',
                    'cf:validate': 'node packages/scripts/bin/cloudflare-validate.cjs',
                },
            }),
        );

        // Real data loss, a billable remote action, and a trivially-rebuildable cache
        // must not share one marker - they carry meaningfully different consequences.
        expect(output).toContain('! pnpm clean:d1');
        expect(output).toContain('$ pnpm cf:setup');
        expect(output).toContain('~ pnpm clean:cache');
        expect(output).not.toContain('! pnpm cf:setup');
        expect(output).not.toContain('! pnpm clean:cache');
        expect(output).toContain('   pnpm cf:validate'); // unmarked: three leading spaces, no risk symbol
        expect(output).toContain('deletes real local data');
        expect(output).toContain('creates billable resources in your Cloudflare account');
        expect(output).toContain('rebuildable cache only');
    });

    it('readRootScripts throws a clear error instead of silently returning nothing', () => {
        const emptyDir = makeTempDir('ottabase-help-missing-');
        expect(() => readRootScripts(emptyDir)).toThrow(/Could not read/);

        const badJsonDir = makeTempDir('ottabase-help-badjson-');
        fs.writeFileSync(path.join(badJsonDir, 'package.json'), '{ this is not valid json', 'utf8');
        expect(() => readRootScripts(badJsonDir)).toThrow(/Could not parse/);

        const emptyScriptsDir = makeTempDir('ottabase-help-noscripts-');
        fs.writeFileSync(path.join(emptyScriptsDir, 'package.json'), JSON.stringify({ name: 'x' }), 'utf8');
        expect(readRootScripts(emptyScriptsDir)).toEqual({});
    });

    it('reads the real root package.json and documents every script it finds', () => {
        const scripts = readRootScripts();
        expect(Object.keys(scripts).length).toBeGreaterThan(0);

        // Guards against drift: every root script needs a COMMAND_REGISTRY entry.
        const model = buildHelpModel({ all: true });
        expect(rowsFor(model, 'Other')).toEqual([]);
        expect(model.stale).toEqual([]);
    });
});
