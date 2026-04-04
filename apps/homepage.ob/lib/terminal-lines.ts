export type TerminalLine =
    | { type: 'gap' }
    | { type: 'cmd'; prompt: string; text: string }
    | { type: 'out'; text: string }
    | { type: 'success'; text: string };

export const TERMINAL_LINES: TerminalLine[] = [
    { type: 'cmd', prompt: '$', text: 'pnpm create ottabase@latest my-saas' },
    { type: 'out', text: '  ✓ Scaffolded 47 packages' },
    { type: 'out', text: '  ✓ Cloudflare Workers configured' },
    { type: 'gap' },
    { type: 'cmd', prompt: '$', text: 'cd my-saas && pnpm install' },
    { type: 'out', text: '  ✓ Dependencies installed' },
    { type: 'gap' },
    { type: 'cmd', prompt: '$', text: 'pnpm dev' },
    { type: 'out', text: '  ┌ Vite       → localhost:3003' },
    { type: 'out', text: '  └ Wrangler   → localhost:3004' },
    { type: 'gap' },
    { type: 'cmd', prompt: '$', text: 'curl -X POST localhost:3004/api/ottaorm/init' },
    { type: 'success', text: '  ✓ Database initialized. Your SaaS is alive.' },
];
