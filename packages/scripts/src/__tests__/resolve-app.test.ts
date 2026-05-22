import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG_FILENAME, _resetCachesForTests, getDeployApps, resolveActiveApp } from '../lib/resolve-app.js';

describe('resolveActiveApp', () => {
    const originalEnv = process.env.OTTABASE_APP;

    beforeEach(() => {
        delete process.env.OTTABASE_APP;
        _resetCachesForTests();
    });

    afterEach(() => {
        if (originalEnv === undefined) delete process.env.OTTABASE_APP;
        else process.env.OTTABASE_APP = originalEnv;
        _resetCachesForTests();
    });

    it('resolves --app=<name> flag with highest priority', () => {
        process.env.OTTABASE_APP = 'otta-web';
        const result = resolveActiveApp({ argv: ['--app=otta-landing', 'pass-through'] });
        expect(result.app).toBe('otta-landing');
        expect(result.source).toBe('cli');
        expect(result.restArgv).toEqual(['pass-through']);
    });

    it('resolves --app <name> space-separated flag', () => {
        const result = resolveActiveApp({ argv: ['--app', 'otta-landing'] });
        expect(result.app).toBe('otta-landing');
        expect(result.source).toBe('cli');
        expect(result.restArgv).toEqual([]);
    });

    it('falls back to OTTABASE_APP env var when no CLI flag', () => {
        process.env.OTTABASE_APP = 'otta-landing';
        const result = resolveActiveApp({ argv: [] });
        expect(result.app).toBe('otta-landing');
        expect(result.source).toBe('env');
    });

    it('falls back to ottabase.config.json defaultApp', () => {
        // No CLI flag, no env var → reads config file at monorepo root.
        const result = resolveActiveApp({ argv: [] });
        expect(['config', 'auto']).toContain(result.source);
        expect(typeof result.app).toBe('string');
        expect(result.app.length).toBeGreaterThan(0);
    });

    it('returns the workspace package name from package.json', () => {
        const result = resolveActiveApp({ argv: ['--app=otta-web'] });
        expect(result.packageName).toBe('@ottabase/otta-web');
        expect(result.appPath).toMatch(/apps[/\\]otta-web$/);
    });

    it('preserves non --app args in restArgv for forwarding', () => {
        const result = resolveActiveApp({ argv: ['--app=otta-web', '--force', 'extra'] });
        expect(result.restArgv).toEqual(['--force', 'extra']);
    });

    it('throws with a helpful message when the requested app does not exist', () => {
        expect(() => resolveActiveApp({ argv: ['--app=no-such-app-xyz'] })).toThrow(
            /does not exist under apps\/.*Available:/,
        );
    });

    it('exports CONFIG_FILENAME pointing at ottabase.config.json', () => {
        expect(CONFIG_FILENAME).toBe('ottabase.config.json');
    });
});

describe('getDeployApps', () => {
    beforeEach(() => _resetCachesForTests());
    afterEach(() => _resetCachesForTests());

    it('returns an array of strings', () => {
        const result = getDeployApps();
        expect(Array.isArray(result)).toBe(true);
        result.forEach((name) => expect(typeof name).toBe('string'));
    });

    it('includes apps with a wrangler.jsonc when no deployApps is configured', () => {
        // This monorepo ships otta-web + otta-landing, both with wrangler.jsonc.
        // If ottabase.config.json declares deployApps, that takes precedence — either
        // outcome must contain both shipped apps as a sanity check.
        const result = getDeployApps();
        expect(result).toContain('otta-web');
        expect(result).toContain('otta-landing');
    });
});
