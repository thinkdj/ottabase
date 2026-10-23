import tailwindcss from '@tailwindcss/postcss';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss, { type AcceptedPlugin } from 'postcss';
import { beforeAll, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stylesheet = resolve(packageRoot, 'styles/tailwind.base.css');
const spaceCompat = require(resolve(packageRoot, 'space-compat.cjs'));

const CLASSES = ['space-y-2', 'space-x-4', '-space-x-2', 'md:space-y-6', 'space-y-reverse', 'space-x-px'];

async function compile(withCompat: boolean): Promise<string> {
    const input = `@import '${stylesheet.split('\\').join('/')}';\n@source inline(${JSON.stringify(CLASSES.join(' '))});`;
    // @tailwindcss/postcss carries its own copy of postcss, whose plugin type this copy does not accept
    const tailwind = tailwindcss({ base: packageRoot }) as unknown as AcceptedPlugin;
    const plugins: AcceptedPlugin[] = withCompat ? [tailwind, spaceCompat()] : [tailwind];
    return (await postcss(plugins).process(input, { from: resolve(packageRoot, 'src/__tests__/entry.css') })).css;
}

function rule(css: string, selector: string): string {
    const start = css.indexOf(`${selector} {`);
    if (start === -1) throw new Error(`no rule for ${selector}`);
    return css.slice(start, css.indexOf('}', start));
}

describe('space-compat PostCSS plugin', () => {
    let plain: string;
    let compat: string;

    beforeAll(async () => {
        [plain, compat] = await Promise.all([compile(false), compile(true)]);
    }, 30_000);

    it('is a no-op for Tailwind 4 on its own: the built-in rules stay', () => {
        expect(plain).toContain(':where(.space-y-2 > :not(:last-child))');
        expect(plain).not.toContain('.space-y-2 > :not([hidden]) ~ :not([hidden])');
    });

    it('puts the margin back on the siblings after the first, as Tailwind 3 did', () => {
        expect(compat).not.toMatch(/:where\(\.[^)]*space-[xy]-/);
        const y = rule(compat, '.space-y-2 > :not([hidden]) ~ :not([hidden])');
        // v4 starts with margin-block-start = S * reverse and ends with S * (1 - reverse); here they are swapped
        expect(y).toContain('margin-block-start: calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)))');
        expect(y).toContain('margin-block-end: calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse))');
    });

    it('does the same for the inline axis, negative values, arbitrary units and responsive variants', () => {
        const x = rule(compat, '.space-x-4 > :not([hidden]) ~ :not([hidden])');
        expect(x).toContain(
            'margin-inline-start: calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-x-reverse)))',
        );
        expect(x).toContain('margin-inline-end: calc(calc(var(--spacing) * 4) * var(--tw-space-x-reverse))');
        expect(rule(compat, '.-space-x-2 > :not([hidden]) ~ :not([hidden])')).toContain('var(--spacing) * -2');
        expect(rule(compat, '.space-x-px > :not([hidden]) ~ :not([hidden])')).toContain('1px');
        expect(compat).toContain('.md\\:space-y-6 > :not([hidden]) ~ :not([hidden])');
    });

    it('keeps space-y-reverse working on the rewritten selector', () => {
        expect(rule(compat, '.space-y-reverse > :not([hidden]) ~ :not([hidden])')).toContain('--tw-space-y-reverse: 1');
    });
});
