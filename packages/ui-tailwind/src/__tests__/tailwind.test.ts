import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const preset = require(resolve(packageRoot, 'tailwind.base.cjs')) as {
    darkMode: string[];
    theme: {
        extend: {
            colors: Record<string, unknown>;
            fontFamily: Record<string, string[]>;
            fontSize: Record<string, [string, Record<string, string>]>;
            borderRadius: Record<string, string>;
            typography: Record<string, { css: Record<string, string> }>;
        };
    };
    plugins: unknown[];
};
const packageJson = require(resolve(packageRoot, 'package.json')) as {
    main: string;
    files: string[];
    scripts: Record<string, string>;
    peerDependencies: Record<string, string>;
};

describe('@ottabase/ui-tailwind package boundary', () => {
    it('publishes a resolvable preset and base stylesheet', () => {
        expect(packageJson.main).toBe('tailwind.base.cjs');
        expect(packageJson.files).toEqual(expect.arrayContaining(['tailwind.base.cjs', 'styles', 'README.md']));
        expect(existsSync(resolve(packageRoot, packageJson.main))).toBe(true);
        expect(existsSync(resolve(packageRoot, 'styles/tailwind.base.css'))).toBe(true);
    });

    it('declares every runtime plugin loaded by the preset as a peer dependency', () => {
        expect(Object.keys(packageJson.peerDependencies)).toEqual(
            expect.arrayContaining([
                'tailwindcss',
                '@tailwindcss/forms',
                '@tailwindcss/typography',
                'tailwindcss-animate',
            ]),
        );
        expect(preset.plugins).toEqual([
            require('@tailwindcss/forms'),
            require('@tailwindcss/typography'),
            require('tailwindcss-animate'),
        ]);
    });

    it('exposes every required workspace gate', () => {
        expect(packageJson.scripts).toMatchObject({
            build: 'pnpm pack --dry-run',
            lint: 'eslint src',
            'type-check': 'tsc --noEmit',
            test: 'vitest',
        });
    });
});

describe('shared Tailwind preset', () => {
    it('uses class dark mode and maps semantic colors to runtime theme variables', () => {
        expect(preset.darkMode).toEqual(['class']);
        expect(preset.theme.extend.colors).toMatchObject({
            background: 'hsl(var(--background) / <alpha-value>)',
            foreground: 'hsl(var(--foreground) / <alpha-value>)',
            primary: {
                DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
                foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
            },
            overlay: 'hsl(var(--overlay) / <alpha-value>)',
        });
    });

    it('keeps typography, fonts, and radii backed by Brand Engine variables', () => {
        expect(preset.theme.extend.fontFamily.sans[0]).toBe('var(--font-body)');
        expect(preset.theme.extend.fontSize.base).toEqual([
            'var(--text-base, 1rem)',
            {
                lineHeight: 'var(--text-base-lh, 1.5rem)',
                letterSpacing: 'var(--text-base-ls, inherit)',
            },
        ]);
        expect(preset.theme.extend.borderRadius.full).toBe('var(--radius-full, 9999px)');
        expect(preset.theme.extend.typography.DEFAULT.css['--tw-prose-links']).toBe('hsl(var(--primary))');
    });

    it('ships the Tailwind layers and reusable button class', () => {
        const css = readFileSync(resolve(packageRoot, 'styles/tailwind.base.css'), 'utf8');

        expect(css).toContain('@tailwind base;');
        expect(css).toContain('@tailwind components;');
        expect(css).toContain('@tailwind utilities;');
        expect(css).toContain('.btn-tw');
    });
});
