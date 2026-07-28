/**
 * Scripts Demo Page
 * Demonstrates @ottabase/scripts: CLI tools for command discovery, Cloudflare setup, local env
 * secrets, and cache/state cleanup.
 */
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Cloud, Database, Key, Plug, RotateCcw, Terminal, Trash2 } from 'lucide-react';
import { DemoPageHeader } from '../DemoPageHeader';

/**
 * The pnpm scripts wired at the repo root for @ottabase/scripts' CLIs.
 *
 * These are NOT runnable via `npx <bin-name>`. @ottabase/scripts is never declared as a
 * dependency of any workspace package (it's invoked only via `pnpm --filter`), so pnpm
 * never links its `bin` entries into any node_modules/.bin, and npx falls through to the
 * public registry (404). Always go through the `pnpm <name>` script below.
 * `Cloudflare` commands act on the remote account; `Environment` and `Cleanup` commands are local only.
 */
const CLI_COMMANDS = [
    {
        name: 'commands',
        icon: Terminal,
        desc: 'Print every root package.json script as a grouped, annotated table. Generated from package.json, so it never drifts.',
        usage: 'pnpm commands clean',
        category: 'Discovery',
    },
    {
        name: 'cf:login',
        icon: Cloud,
        desc: 'Verify Wrangler authentication and log in if needed. Opens a browser for OAuth.',
        usage: 'pnpm cf:login',
        category: 'Cloudflare',
    },
    {
        name: 'cf:setup',
        icon: Cloud,
        desc: 'Interactively create Cloudflare resources: D1 databases, KV namespaces, R2 buckets, Queues. Prints the resource IDs for use as GitHub Secrets. Does not modify wrangler.jsonc.',
        usage: 'pnpm cf:setup',
        category: 'Cloudflare',
    },
    {
        name: 'cf:validate',
        icon: Cloud,
        desc: 'Check that every resource named in wrangler.jsonc exists in your Cloudflare account. Read-only; reports mismatches.',
        usage: 'pnpm cf:validate',
        category: 'Cloudflare',
    },
    {
        name: 'env:secrets',
        icon: Key,
        desc: "Fill the target app's .env.local with development-safe secrets, using .env.example for the key list. Existing values are preserved, so it is safe to re-run.",
        usage: 'pnpm env:secrets',
        category: 'Environment',
    },
    {
        name: 'clean:cache',
        icon: Trash2,
        desc: 'Clear Turborepo caches (.turbo and node_modules/.cache/turbo). Useful after dependency or config changes.',
        usage: 'pnpm clean:cache -- -y',
        category: 'Cleanup',
    },
    {
        name: 'clean:d1',
        icon: Database,
        desc: 'Delete local D1 state (.wrangler/state/*/d1). Local only, your Cloudflare account is untouched.',
        usage: 'pnpm clean:d1 -- -y',
        category: 'Cleanup',
    },
    {
        name: 'clean:kv',
        icon: Database,
        desc: 'Delete local KV state (platform state cache, RBAC, queue, rate limits). Local only.',
        usage: 'pnpm clean:kv -- -y',
        category: 'Cleanup',
    },
    {
        name: 'clean:state',
        icon: Database,
        desc: 'Delete all local Wrangler state: D1, KV and R2. Re-run bootstrap afterwards to bring the platform back up.',
        usage: 'pnpm clean:state -- -y',
        category: 'Cleanup',
    },
    {
        name: 'clean:all',
        icon: RotateCcw,
        desc: 'Everything clean:state removes, plus build caches and packages/*/dist. Does not remove node_modules.',
        usage: 'pnpm clean:all -- -y',
        category: 'Cleanup',
    },
    {
        name: 'dev:kill',
        icon: Plug,
        desc: 'Kill processes on the dev ports (3003, 3004). Frees up ports for the dev server.',
        usage: 'pnpm dev:kill',
        category: 'Cleanup',
    },
];

/**
 * Notes rendered under a category heading. Mirrors GROUP_NOTES in help.ts, so the
 * local-vs-remote distinction is stated once per category rather than repeated
 * (or inconsistently omitted) in every individual command's description.
 */
const CATEGORY_NOTES: Partial<Record<string, string>> = {
    Cloudflare: 'Acts on your remote Cloudflare account: creates or verifies real resources.',
    Cleanup:
        'Local only: deletes files in your working copy, never your Cloudflare account. Prompts for a typed YES unless you pass -- -y.',
};

export function ScriptsDemoPage() {
    const categories = [...new Set(CLI_COMMANDS.map((c) => c.category))];

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Scripts"
                description="Discover, set up, and clean up from the terminal: list every command, provision Cloudflare resources, fill in local secrets, or clear cache and state. These are terminal commands, not runtime code."
                actions={
                    <Badge
                        variant="outline"
                        className="rounded-full border-transparent bg-background text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border"
                    >
                        @ottabase/scripts
                    </Badge>
                }
            />

            {/* Overview */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <Terminal className="h-5 w-5" />
                        How to Use
                    </CardTitle>
                    <div className="space-y-2 text-sm text-muted-foreground">
                        <p>
                            The underlying binaries live in{' '}
                            <code className="rounded bg-background px-1 py-0.5 text-xs ring-1 ring-border">
                                @ottabase/scripts
                            </code>
                            , but that package isn&apos;t a dependency of anything else in the workspace, so its{' '}
                            <code>bin</code> entries are never linked, so <code>npx &lt;bin-name&gt;</code> won&apos;t
                            find them. Always run the <code>pnpm</code> script wired at the repo root instead, shown
                            under each command below. <code>pnpm commands</code> lists every one of them.
                        </p>
                        <pre className="rounded-lg bg-background p-3 text-xs ring-1 ring-border">
                            <code>{`# Example: full development reset
pnpm clean:cache -- -y && pnpm dev:kill && pnpm dev`}</code>
                        </pre>
                    </div>
                </CardHeader>
            </Card>

            {/* Commands by category */}
            {categories.map((category) => (
                <Card key={category} className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader>
                        <CardTitle className="text-[0.9375rem] font-semibold">{category} Commands</CardTitle>
                        {CATEGORY_NOTES[category] && (
                            <CardDescription className="text-xs">{CATEGORY_NOTES[category]}</CardDescription>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {CLI_COMMANDS.filter((c) => c.category === category).map((cmd) => (
                                <div key={cmd.name} className="rounded-lg bg-background p-4 ring-1 ring-border">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground ring-1 ring-border">
                                            <cmd.icon className="h-4 w-4" />
                                        </div>
                                        <code className="text-sm font-semibold">{cmd.name}</code>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-2">{cmd.desc}</p>
                                    <pre className="rounded bg-muted/60 p-2 text-xs ring-1 ring-border">
                                        <code>{cmd.usage}</code>
                                    </pre>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ))}

            {/* Typical workflow */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Typical Workflows</CardTitle>
                    <CardDescription>Common command sequences for development tasks.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">First-time Cloudflare Setup</h4>
                        <pre className="overflow-x-auto rounded-lg bg-background p-4 text-xs ring-1 ring-border">
                            <code>{`pnpm cf:login       # Authenticate
pnpm cf:setup       # Create D1, KV, R2, etc.
pnpm cf:validate    # Verify resources exist
pnpm env:secrets    # Fill .env.local with local secrets`}</code>
                        </pre>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Clean Development Environment</h4>
                        <pre className="overflow-x-auto rounded-lg bg-background p-4 text-xs ring-1 ring-border">
                            <code>{`pnpm clean:cache -- -y # Clear build caches
pnpm dev:kill           # Free dev ports
pnpm dev                # Start fresh`}</code>
                        </pre>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Nuclear Reset (start from scratch)</h4>
                        <pre className="overflow-x-auto rounded-lg bg-background p-4 text-xs ring-1 ring-border">
                            <code>{`pnpm clean:all -- -y   # Local state + caches + packages/*/dist
pnpm install           # Only if you also removed node_modules
pnpm build:pkg         # Rebuild packages
pnpm dev               # Start dev server
                       # Then visit /__bootstrap__ to re-initialize`}</code>
                        </pre>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
