/**
 * PostCSS plugin: keep Tailwind 3's `space-x-*` / `space-y-*` placement under Tailwind 4.
 *
 * Tailwind 3 put the margin on the top (left) of every sibling after the first:
 *     .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: .5rem }
 * Tailwind 4 puts it on the bottom (right) of every child but the last:
 *     :where(.space-y-2 > :not(:last-child)) { margin-bottom: .5rem }
 *
 * The two agree for block children. They differ when a child is inline or inline-flex (a bare <label>, a button
 * rendered as a link, a badge): the margin lands on a different side of the line box, and the gap under it comes out a
 * few pixels short. Every stack in the app was laid out against the v3 placement, so this rewrites v4's rules back to
 * it: same selector as v3, the start and end margins swapped.
 *
 * Optional. Without it Tailwind's own rules apply and nothing breaks; stacks that hold inline children are a little
 * tighter. New code should reach for flex or grid with `gap` instead.
 *
 *     // postcss.config.cjs
 *     module.exports = {
 *         plugins: { '@tailwindcss/postcss': {}, '@ottabase/ui-tailwind/space-compat.cjs': {} },
 *     };
 */
const BUILT_IN = /^:where\(\s*(\.[^\s>]*space-[xy]-[^\s>]*)\s*>\s*:not\(:last-child\)\s*\)$/;

const SWAP = {
    'margin-block-start': 'margin-block-end',
    'margin-block-end': 'margin-block-start',
    'margin-inline-start': 'margin-inline-end',
    'margin-inline-end': 'margin-inline-start',
};

/** @type {import('postcss').PluginCreator<void>} */
const plugin = () => ({
    postcssPlugin: 'ottabase-space-compat',
    Rule(rule) {
        const match = BUILT_IN.exec(rule.selector);
        if (!match) return;
        rule.selector = `${match[1]} > :not([hidden]) ~ :not([hidden])`;
        const values = new Map();
        rule.each((node) => {
            if (node.type === 'decl' && SWAP[node.prop]) values.set(node.prop, node.value);
        });
        rule.each((node) => {
            if (node.type === 'decl' && SWAP[node.prop]) node.value = values.get(SWAP[node.prop]) ?? node.value;
        });
    },
});

plugin.postcss = true;
module.exports = plugin;
