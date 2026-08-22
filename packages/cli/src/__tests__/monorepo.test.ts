import { describe, expect, it } from 'vitest';
import { APP_TEMPLATES, getPnpmInvocation, resolveApp, validateAppName } from '../utils/monorepo.js';

describe('app and process resolution', () => {
    it('resolves the root default while still accepting package names', () => {
        expect(resolveApp().name).toBe('otta-web');
        expect(resolveApp('@ottabase/otta-landing').name).toBe('otta-landing');
    });

    it('builds a safe cross-platform pnpm invocation', () => {
        const invocation = getPnpmInvocation(['run', 'dev:worker']);
        if (process.platform === 'win32') {
            expect(invocation.command.toLowerCase()).toMatch(/cmd\.exe$/);
            expect(invocation.args.at(-1)).toBe('pnpm run dev:worker');
        } else {
            expect(invocation).toEqual({ command: 'pnpm', args: ['run', 'dev:worker'] });
        }
        expect(() => getPnpmInvocation(['run', 'dev & whoami'])).toThrow(/Unsafe pnpm argument/);
    });
});

describe('validateAppName', () => {
    // Invalid-format tests: the regex check fires before any disk I/O, so these are pure.
    it('should reject empty names', () => {
        expect(validateAppName('').valid).toBe(false);
    });

    it('should reject names starting with uppercase', () => {
        expect(validateAppName('MyApp').valid).toBe(false);
    });

    it('should reject names starting with numbers', () => {
        expect(validateAppName('123app').valid).toBe(false);
    });

    it('should reject names with underscores', () => {
        expect(validateAppName('my_app').valid).toBe(false);
    });

    it('should reject names with spaces', () => {
        expect(validateAppName('my app').valid).toBe(false);
    });

    it('should reject names with trailing hyphens', () => {
        expect(validateAppName('my-app-').valid).toBe(false);
    });

    it('should reject names with consecutive hyphens', () => {
        expect(validateAppName('my--app').valid).toBe(false);
    });

    it('should reject names over 50 characters', () => {
        expect(validateAppName('a'.repeat(51)).valid).toBe(false);
    });

    // Valid-format tests also exercise the existence check via real disk reads.
    // Names below are chosen to not collide with any real app in this monorepo.
    it('should accept valid lowercase names', () => {
        expect(validateAppName('my-app').valid).toBe(true);
    });

    it('should accept names with numbers', () => {
        expect(validateAppName('app2').valid).toBe(true);
    });

    it('should accept simple names', () => {
        expect(validateAppName('dashboard').valid).toBe(true);
    });

    it('should accept names with multiple hyphens', () => {
        expect(validateAppName('my-cool-app').valid).toBe(true);
    });
    it('should reject names that already exist as apps', () => {
        // 'otta-web' is a real app in this monorepo — must be rejected by the existence check.
        const result = validateAppName('otta-web');
        expect(result.valid).toBe(false);
        // Narrow the union so TypeScript knows error is string on the false branch
        if (!result.valid) {
            expect(result.error).toMatch(/already exists/);
        }
    });
});

describe('APP_TEMPLATES', () => {
    it('should have web template', () => {
        expect(APP_TEMPLATES.web).toBeDefined();
        expect(APP_TEMPLATES.web.name).toBe('web');
        expect(APP_TEMPLATES.web.source).toBe('otta-web');
    });

    it('should have landing template', () => {
        expect(APP_TEMPLATES.landing).toBeDefined();
        expect(APP_TEMPLATES.landing.name).toBe('landing');
        expect(APP_TEMPLATES.landing.source).toBe('otta-landing');
    });

    it('should have descriptions for all templates', () => {
        for (const [, template] of Object.entries(APP_TEMPLATES)) {
            expect(template.description).toBeTruthy();
            expect(template.description.length).toBeGreaterThan(10);
        }
    });
});
