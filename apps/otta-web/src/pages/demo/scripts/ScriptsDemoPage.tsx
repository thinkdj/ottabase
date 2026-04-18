/**
 * Scripts Demo Page
 * Demonstrates @ottabase/scripts: CLI tools for Cloudflare setup, schema, migrations, and cache management.
 */
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { Cloud, Database, Key, Plug, RotateCcw, Terminal, Trash2 } from 'lucide-react';

/** All CLI commands exported by @ottabase/scripts. */
const CLI_COMMANDS = [
    {
        name: 'cloudflare-login',
        icon: Key,
        desc: 'Authenticate with Cloudflare API. Opens browser for OAuth or accepts API token.',
        usage: 'npx cloudflare-login',
        category: 'Cloudflare',
    },
    {
        name: 'cloudflare-setup',
        icon: Cloud,
        desc: 'Interactive setup for Cloudflare resources: D1 databases, KV namespaces, R2 buckets, Queues. Generates wrangler.jsonc bindings.',
        usage: 'npx cloudflare-setup',
        category: 'Cloudflare',
    },
    {
        name: 'cloudflare-validate',
        icon: Cloud,
        desc: 'Validate that wrangler.jsonc bindings match actual Cloudflare resources. Reports mismatches.',
        usage: 'npx cloudflare-validate',
        category: 'Cloudflare',
    },
    {
        name: 'clean-cache',
        icon: Trash2,
        desc: 'Clear build caches (Turborepo, Vite, tsup). Useful after dependency or config changes.',
        usage: 'npx clean-cache',
        category: 'Cleanup',
    },
    {
        name: 'clean-reset',
        icon: RotateCcw,
        desc: 'Full reset: remove node_modules, lockfile, dist folders, and caches. Then reinstall.',
        usage: 'npx clean-reset',
        category: 'Cleanup',
    },
    {
        name: 'clean-db',
        icon: Database,
        desc: 'Drop and recreate local D1 database. Wipes all data — use only in development.',
        usage: 'npx clean-db',
        category: 'Cleanup',
    },
    {
        name: 'clean-kv',
        icon: Database,
        desc: 'Flush local KV namespace (platform state cache, RBAC, queue, rate limits).',
        usage: 'npx clean-kv',
        category: 'Cleanup',
    },
    {
        name: 'kill-ports',
        icon: Plug,
        desc: 'Kill processes on common dev ports (3003, 3004, 8787). Frees up ports for dev server.',
        usage: 'npx kill-ports',
        category: 'Cleanup',
    },
];

export function ScriptsDemoPage() {
    const categories = [...new Set(CLI_COMMANDS.map((c) => c.category))];

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <Button asChild variant="ghost" className="w-fit text-muted-foreground hover:text-foreground">
                    <Link to="/demo">← Back to Demo Gallery</Link>
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="uppercase">
                        @ottabase/scripts
                    </Badge>
                    <h1 className="text-3xl font-semibold tracking-tight dark:text-foreground">Scripts Demo</h1>
                </div>
                <p className="max-w-3xl text-muted-foreground">
                    CLI tools for Cloudflare setup, validation, cache management, and database cleanup. These are
                    terminal commands — not runtime code.
                </p>
            </div>

            {/* Overview */}
            <Card className="border-primary/30 bg-primary/5 dark:border-primary/20 dark:bg-primary/10">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Terminal className="h-5 w-5" />
                        How to Use
                    </CardTitle>
                    <div className="text-sm text-muted-foreground space-y-2">
                        <p>
                            All commands are registered as <strong>bin</strong> entries in{' '}
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">@ottabase/scripts</code>. Run them
                            directly from the monorepo root with <code>npx</code> or add them to your{' '}
                            <code>package.json</code> scripts.
                        </p>
                        <pre className="rounded-lg bg-muted p-3 text-xs">
                            <code>{`# Example: full development reset
npx clean-cache && npx kill-ports && pnpm dev`}</code>
                        </pre>
                    </div>
                </CardHeader>
            </Card>

            {/* Commands by category */}
            {categories.map((category) => (
                <Card key={category}>
                    <CardHeader>
                        <CardTitle className="text-base">{category} Commands</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {CLI_COMMANDS.filter((c) => c.category === category).map((cmd) => (
                                <div key={cmd.name} className="rounded-lg border p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-1.5 rounded-md bg-primary/10">
                                            <cmd.icon className="h-4 w-4 text-primary" />
                                        </div>
                                        <code className="text-sm font-semibold">{cmd.name}</code>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-2">{cmd.desc}</p>
                                    <pre className="rounded bg-muted p-2 text-xs">
                                        <code>{cmd.usage}</code>
                                    </pre>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ))}

            {/* Typical workflow */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Typical Workflows</CardTitle>
                    <CardDescription>Common command sequences for development tasks.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">First-time Cloudflare Setup</h4>
                        <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
                            <code>{`npx cloudflare-login      # Authenticate
npx cloudflare-setup      # Create D1, KV, R2, etc.
npx cloudflare-validate   # Verify bindings`}</code>
                        </pre>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Clean Development Environment</h4>
                        <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
                            <code>{`npx clean-cache    # Clear build caches
npx kill-ports     # Free dev ports
pnpm dev           # Start fresh`}</code>
                        </pre>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Nuclear Reset (start from scratch)</h4>
                        <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
                            <code>{`npx clean-reset    # Remove everything + reinstall
npx clean-db       # Wipe local database
npx clean-kv       # Flush KV namespace
pnpm build:pkg     # Rebuild packages
pnpm dev           # Start dev server`}</code>
                        </pre>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
