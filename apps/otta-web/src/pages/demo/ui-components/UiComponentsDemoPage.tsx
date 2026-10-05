/**
 * UI Components Demo Page — live examples for exported @ottabase/ui-components.
 */
import {
    BlogPagination,
    ConfirmDialog,
    DarkModeToggle,
    EmptyState,
    HistoryGoBackButton,
    LoadingState,
    Logo,
} from '@ottabase/ui-components';
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { IconArrowLeft, IconMoon, IconPhoto } from '@tabler/icons-react';
import { AlertTriangle, Blocks, Inbox, Info } from 'lucide-react';
import { useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

const NOTICES = [
    ['info', 'Drafts autosave every 30 seconds.'],
    ['success', 'Post published.'],
    ['warning', 'This slug is already in use on another site.'],
    ['destructive', 'Could not save. Check your connection and try again.'],
] as const;

export function UiComponentsDemoPage() {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmResult, setConfirmResult] = useState<string | null>(null);
    const [destructiveOpen, setDestructiveOpen] = useState(false);
    const [unsavedOpen, setUnsavedOpen] = useState(false);
    const [blogPage, setBlogPage] = useState(3);

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="UI Components"
                description="Shared React components built on shadcn/ui primitives: confirmation dialogs, empty and loading states, logo, pagination, and utilities."
                actions={
                    <Badge variant="secondary" className="uppercase">
                        @ottabase/ui-components
                    </Badge>
                }
            />

            {/* ConfirmDialog */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <AlertTriangle className="h-4 w-4" />
                        ConfirmDialog
                    </CardTitle>
                    <CardDescription>
                        Confirmation dialog with three tones: <code>default</code>, <code>destructive</code>, and{' '}
                        <code>unsaved-changes</code>. Built on shadcn AlertDialog.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                        {/* Default tone */}
                        <ConfirmDialog
                            open={confirmOpen}
                            onOpenChange={setConfirmOpen}
                            title="Confirm Action"
                            description="Are you sure you want to proceed with this action?"
                            onConfirm={() => {
                                setConfirmResult('Confirmed (default tone)');
                                setConfirmOpen(false);
                            }}
                            onCancel={() => {
                                setConfirmResult('Cancelled');
                                setConfirmOpen(false);
                            }}
                            trigger={<Button variant="outline">Default Confirm</Button>}
                        />

                        {/* Destructive tone */}
                        <ConfirmDialog
                            open={destructiveOpen}
                            onOpenChange={setDestructiveOpen}
                            title="Delete Item"
                            description="This action cannot be undone. This will permanently delete the item."
                            tone="destructive"
                            confirmLabel="Delete"
                            onConfirm={() => {
                                setConfirmResult('Confirmed (destructive tone)');
                                setDestructiveOpen(false);
                            }}
                            onCancel={() => {
                                setConfirmResult('Cancelled');
                                setDestructiveOpen(false);
                            }}
                            trigger={<Button variant="destructive">Destructive Confirm</Button>}
                        />

                        {/* Unsaved changes tone */}
                        <ConfirmDialog
                            open={unsavedOpen}
                            onOpenChange={setUnsavedOpen}
                            title="Unsaved Changes"
                            description="You have unsaved changes. Are you sure you want to leave?"
                            tone="unsaved-changes"
                            onConfirm={() => {
                                setConfirmResult('Left without saving');
                                setUnsavedOpen(false);
                            }}
                            onCancel={() => {
                                setConfirmResult('Stayed to keep editing');
                                setUnsavedOpen(false);
                            }}
                            trigger={<Button variant="secondary">Unsaved Changes</Button>}
                        />
                    </div>

                    {confirmResult && (
                        <div className="rounded-lg bg-background p-3 text-sm ring-1 ring-border">
                            <span className="font-medium">Result:</span> {confirmResult}
                        </div>
                    )}

                    <pre className="overflow-x-auto rounded-lg bg-background p-4 text-xs ring-1 ring-border">
                        <code>{`import { ConfirmDialog } from '@ottabase/ui-components';

<ConfirmDialog
    title="Delete Item"
    description="This action cannot be undone."
    tone="destructive"
    confirmLabel="Delete"
    onConfirm={() => handleDelete()}
    trigger={<Button variant="destructive">Delete</Button>}
/>`}</code>
                    </pre>
                </CardContent>
            </Card>

            {/* Empty, loading and notice states */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <Info className="h-4 w-4" />
                        EmptyState, LoadingState and Alert
                    </CardTitle>
                    <CardDescription>
                        One component each for "nothing here", "still loading" and "something to tell you", so every
                        page says it the same way.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                            <code className="text-xs">EmptyState</code>
                            <EmptyState
                                icon={<Inbox />}
                                title="No posts yet"
                                description="Write the first one and it shows up here."
                                action={
                                    <Button size="sm" variant="outline">
                                        New post
                                    </Button>
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <code className="text-xs">LoadingState kind="table"</code>
                            <LoadingState kind="table" count={3} columns={3} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <code className="text-xs">Alert variants (from @ottabase/ui-shadcn)</code>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {NOTICES.map(([variant, text]) => (
                                <Alert key={variant} variant={variant}>
                                    {text}
                                </Alert>
                            ))}
                        </div>
                    </div>

                    <pre className="overflow-x-auto rounded-lg bg-background p-4 text-xs ring-1 ring-border">
                        <code>{`import { EmptyState, LoadingState } from '@ottabase/ui-components';
import { Alert } from '@ottabase/ui-shadcn';

{isLoading ? (
    <LoadingState kind="table" count={5} />
) : rows.length === 0 ? (
    <EmptyState icon={<Inbox />} title="No posts yet" action={<Button>New post</Button>} />
) : (
    <Table>…</Table>
)}

{error && <Alert variant="destructive">{error}</Alert>}`}</code>
                    </pre>
                </CardContent>
            </Card>

            {/* Logo */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <IconPhoto className="h-4 w-4" aria-hidden />
                        Logo
                    </CardTitle>
                    <CardDescription>
                        App name and optional logo image from <code>createAppConfig()</code> defaults; optional built-in
                        theme control.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                        <Logo appName="Ottabase UI Components" darkModeSwitcher />
                    </div>
                    <pre className="overflow-x-auto rounded-lg bg-background p-4 text-xs ring-1 ring-border">
                        <code>{`import { Logo } from '@ottabase/ui-components';

<Logo appName="My App" darkModeSwitcher linkUrl="/" />`}</code>
                    </pre>
                </CardContent>
            </Card>

            {/* DarkModeToggle */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <IconMoon className="h-4 w-4" aria-hidden />
                        DarkModeToggle
                    </CardTitle>
                    <CardDescription>Uses next-themes; switch or button presentation.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-center gap-6 rounded-lg bg-background p-4 ring-1 ring-border">
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">type=&quot;toggle-switch&quot;</p>
                            <DarkModeToggle type="toggle-switch" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">type=&quot;button&quot;</p>
                            <DarkModeToggle type="button" title="Toggle color theme" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* HistoryGoBackButton */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <IconArrowLeft className="h-4 w-4" aria-hidden />
                        HistoryGoBackButton
                    </CardTitle>
                    <CardDescription>
                        Calls <code>history.back()</code> when history length allows.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                        <HistoryGoBackButton />
                    </div>
                </CardContent>
            </Card>

            {/* BlogPagination */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <Blocks className="h-4 w-4" />
                        BlogPagination
                    </CardTitle>
                    <CardDescription>Previous/next and numbered pages with ellipsis for long ranges.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <BlogPagination page={blogPage} lastPage={12} perPage={10} onPageChange={setBlogPage} />
                    <p className="text-xs text-muted-foreground">
                        Current page: <span className="font-mono text-foreground">{blogPage}</span>
                    </p>
                </CardContent>
            </Card>

            {/* Component list */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <Blocks className="h-4 w-4" />
                        All Exported Components
                    </CardTitle>
                    <CardDescription>Summary of exports from @ottabase/ui-components.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[
                            {
                                name: 'ConfirmDialog',
                                desc: 'AlertDialog wrapper with default/destructive/unsaved-changes tones.',
                                import: "import { ConfirmDialog } from '@ottabase/ui-components';",
                            },
                            {
                                name: 'EmptyState',
                                desc: 'The "nothing here" tile: icon, title, description and next step.',
                                import: "import { EmptyState } from '@ottabase/ui-components';",
                            },
                            {
                                name: 'LoadingState',
                                desc: 'One status region of pulsing tiles: blocks, text, table or form.',
                                import: "import { LoadingState } from '@ottabase/ui-components';",
                            },
                            {
                                name: 'DarkModeToggle',
                                desc: 'Theme switcher (toggle-switch or button) using next-themes.',
                                import: "import { DarkModeToggle } from '@ottabase/ui-components';",
                            },
                            {
                                name: 'Logo',
                                desc: 'App logo with optional app name, link, and dark mode toggle.',
                                import: "import { Logo } from '@ottabase/ui-components';",
                            },
                            {
                                name: 'HistoryGoBackButton',
                                desc: 'Browser history back navigation button.',
                                import: "import { HistoryGoBackButton } from '@ottabase/ui-components';",
                            },
                            {
                                name: 'BlogPagination',
                                desc: 'Page number pagination with previous/next and ellipsis.',
                                import: "import { BlogPagination } from '@ottabase/ui-components';",
                            },
                        ].map((comp) => (
                            <div key={comp.name} className="rounded-lg bg-background p-3 ring-1 ring-border">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">{comp.name}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{comp.desc}</p>
                                <code className="text-xs text-muted-foreground mt-1 block">{comp.import}</code>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
