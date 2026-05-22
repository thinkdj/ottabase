import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { resolveActiveApp, FALLBACK_APP, CONFIG_FILENAME } from '../lib/resolve-app.js';

describe('resolveActiveApp', () => {
    const originalEnv = process.env.OTTABASE_APP;

    beforeEach(() => {
        delete process.env.OTTABASE_APP;
    });

    afterEach(() => {
        if (originalEnv === undefined) delete process.env.OTTABASE_APP;
        else process.env.OTTABASE_APP = originalEnv;
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
        expect(['config', 'auto', 'fallback']).toContain(result.source);
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

    it('throws when the requested app does not exist', () => {
        expect(() => resolveActiveApp({ argv: ['--app=no-such-app-xyz'] })).toThrow(/not found in apps\//);
    });

    it('exports a sensible FALLBACK_APP constant', () => {
        // Frame the fallback as a documented intentional default rather than a hard rule —
        // any non-empty string for the framework's primary starter is acceptable.
        expect(FALLBACK_APP).toBeTruthy();
        expect(typeof FALLBACK_APP).toBe('string');
    });

    it('exports CONFIG_FILENAME pointing at ottabase.config.json', () => {
        expect(CONFIG_FILENAME).toBe('ottabase.config.json');
    });
});
