import tailwindcss from '@tailwindcss/postcss';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss, { type AcceptedPlugin } from 'postcss';
import { beforeAll, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stylesheet = resolve(packageRoot, 'styles/tailwind.base.css');
const packageJson = require(resolve(packageRoot, 'package.json')) as {
    main: string;
    files: string[];
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
};

/** Compile the shared stylesheet the way an app does, generating only `classes`. */
async function compile(classes: string[]): Promise<string> {
    const input = `@import '${stylesheet.split('\\').join('/')}';\n@source inline(${JSON.stringify(classes.join(' '))});`;
    const result = await postcss([tailwindcss({ base: packageRoot }) as unknown as AcceptedPlugin]).process(input, {
        from: resolve(packageRoot, 'src/__tests__/entry.css'),
    });
    return result.css;
}

/** Body of the first rule whose selector is exactly `selector`. */
function rule(css: string, selector: string): string {
    const start = css.indexOf(`${selector} {`);
    if (start === -1) throw new Error(`no rule for ${selector}`);
    return css.slice(start, css.indexOf('\n  }', start));
}

describe('@ottabase/ui-tailwind package boundary', () => {
    it('publishes the stylesheet as the package entry, and no JavaScript preset', () => {
        expect(packageJson.main).toBe('styles/tailwind.base.css');
        expect(packageJson.files).toEqual(expect.arrayContaining(['styles', 'README.md']));
        expect(existsSync(stylesheet)).toBe(true);
        expect(existsSync(resolve(packageRoot, 'tailwind.base.cjs'))).toBe(false);
    });

    it('owns the plugins its stylesheet loads; apps only bring tailwindcss', () => {
        expect(Object.keys(packageJson.peerDependencies)).toEqual(['tailwindcss']);
        expect(Object.keys(packageJson.dependencies)).toEqual(
            expect.arrayContaining(['@tailwindcss/typography', 'tw-animate-css']),
        );
        const css = readFileSync(stylesheet, 'utf8');
        expect(css).toContain(`@import 'tailwindcss';`);
        expect(css).toContain(`@import 'tw-animate-css';`);
        // No forms plugin: its global preset paints a fixed blue focus ring on every field
        expect(css).not.toContain('@tailwindcss/forms');
        expect(packageJson.dependencies).not.toHaveProperty('@tailwindcss/forms');
        expect(css).toContain(`@plugin '@tailwindcss/typography';`);
    });

    it('exposes every required workspace gate', () => {
        expect(packageJson.scripts).toMatchObject({
            build: 'pnpm pack --dry-run',
            lint: 'eslint src',
            'type-check': 'tsc --noEmit',
            test: 'vitest run',
        });
    });
});

describe('shared Tailwind theme (compiled)', () => {
    let css: string;

    beforeAll(async () => {
        css = await compile([
            'bg-primary',
            'bg-primary/50',
            'bg-primary-hover',
            'text-overlay',
            'text-subtle-foreground',
            'bg-success-soft',
            'text-warning-text',
            'border-destructive-line',
            'bg-chart-8',
            'text-chart-label',
            'bg-sidebar',
            'dark:bg-background',
            'rounded',
            'rounded-sm',
            'rounded-full',
            'shadow',
            'shadow-md',
            'text-base',
            'font-sans',
            'font-mono',
            'border',
            'border-strong',
            'duration-fast',
            'duration-theme',
            'ease-theme',
            'transition',
            'z-header',
            'z-toast',
            'p-section',
            'p-theme-section',
            'prose',
            'animate-accordion-down',
            'animate-page-in',
            'animate-shimmer',
            'animate-in',
            'btn-tw',
        ]);
    }, 30_000);

    it('maps semantic colours to runtime HSL channels, with opacity modifiers', () => {
        expect(rule(css, '.bg-primary')).toContain('background-color: hsl(var(--primary))');
        expect(rule(css, '.bg-primary\\/50')).toContain('color-mix(in oklab, hsl(var(--primary)) 50%, transparent)');
        expect(rule(css, '.text-overlay')).toContain('color: hsl(var(--overlay))');
        expect(rule(css, '.bg-sidebar')).toContain('hsl(var(--sidebar-background))');
    });

    it('falls back to a base token where a theme may not define the extra', () => {
        expect(rule(css, '.bg-primary-hover')).toContain('hsl(var(--primary-hover, var(--primary)))');
        expect(rule(css, '.text-subtle-foreground')).toContain(
            'hsl(var(--subtle-foreground, var(--muted-foreground)))',
        );
        expect(rule(css, '.text-chart-label')).toContain('hsl(var(--chart-label, var(--muted-foreground)))');
    });

    it('carries the status tones: solid, text, soft fill and line', () => {
        expect(rule(css, '.bg-success-soft')).toContain('hsl(var(--success-soft))');
        expect(rule(css, '.text-warning-text')).toContain('hsl(var(--warning-text, var(--warning)))');
        expect(rule(css, '.border-destructive-line')).toContain('hsl(var(--destructive-line))');
        expect(rule(css, '.bg-chart-8')).toContain('hsl(var(--chart-8))');
    });

    it('uses class-based dark mode', () => {
        expect(css).toContain('.dark\\:bg-background:is(.dark *)');
    });

    it('reads Brand Engine radius/shadow/type tokens with stock fallbacks', () => {
        expect(rule(css, '.rounded')).toContain('border-radius: var(--radius-sm, calc(var(--radius) - 4px))');
        expect(rule(css, '.rounded-full')).toContain('var(--radius-full, 9999px)');
        expect(rule(css, '.shadow')).toContain('--tw-shadow: var(--shadow-sm)');
        expect(rule(css, '.shadow-md')).toContain('--tw-shadow: var(--shadow-md)');
        const text = rule(css, '.text-base');
        expect(text).toContain('font-size: var(--text-base, 1rem)');
        expect(text).toContain('var(--text-base-lh, 1.5rem)');
        expect(text).toContain('var(--text-base-ls, inherit)');
        expect(rule(css, '.font-sans')).toContain('font-family: var(--font-body), ui-sans-serif');
        expect(rule(css, '.font-mono')).toContain('font-family: var(--font-mono), ui-monospace');
    });

    it('never emits a :root variable that would shadow an engine token of the same name', () => {
        const theme = css.slice(css.indexOf('@layer theme {'), css.indexOf('@layer base {'));
        for (const name of [
            '--radius-sm',
            '--radius-full',
            '--shadow-sm',
            '--shadow-md',
            '--text-base',
            '--font-mono',
            '--spacing-section',
            '--color-primary',
        ]) {
            expect(theme).not.toContain(`${name}:`);
        }
    });

    it('keeps border width, motion, z-index and spacing token-driven', () => {
        expect(css).toMatch(/\.border \{[^}]*border-width: var\(--border-width, 1px\)/);
        expect(rule(css, '.border-strong')).toContain('var(--border-width-strong, 2px)');
        expect(rule(css, '.duration-fast')).toContain('transition-duration: var(--duration-fast)');
        expect(rule(css, '.duration-theme')).toContain('var(--duration-theme, 320ms)');
        expect(rule(css, '.ease-theme')).toContain('transition-timing-function: var(--ease)');
        expect(rule(css, '.transition')).toContain('var(--tw-duration, var(--duration-normal))');
        expect(rule(css, '.z-header')).toContain('z-index: var(--z-header, 40)');
        expect(rule(css, '.z-toast')).toContain('z-index: var(--z-toast, 100)');
        expect(rule(css, '.p-section')).toContain('padding: var(--spacing-section)');
    });

    it('wires prose to design tokens and ships the animations', () => {
        expect(css).toContain('--tw-prose-links: hsl(var(--primary))');
        expect(css).toContain('--tw-prose-invert-body: hsl(var(--foreground))');
        expect(rule(css, '.animate-accordion-down')).toContain('accordion-down var(--duration-normal) var(--ease)');
        expect(rule(css, '.animate-page-in')).toContain('page-in var(--duration-slow) var(--ease-enter) both');
        expect(rule(css, '.animate-shimmer')).toContain('shimmer 1.4s linear infinite');
        expect(css).toContain('@keyframes accordion-down');
        expect(css).toContain('@keyframes page-in');
        expect(css).toContain('@keyframes shimmer');
        expect(css).toContain('.animate-in');
        expect(rule(css, '.btn-tw')).toContain('display: inline-flex');
    });
});
