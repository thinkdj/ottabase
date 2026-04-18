/**
 * UI Components Demo Page — live examples for exported @ottabase/ui-components.
 */
import type { MessageTypes } from '@ottabase/ui-components';
import {
    BlogPagination,
    ConfirmDialog,
    DarkModeToggle,
    HistoryGoBackButton,
    Logo,
    MessageBox,
} from '@ottabase/ui-components';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { IconArrowLeft, IconMoon, IconPhoto } from '@tabler/icons-react';
import { AlertTriangle, Blocks, Info } from 'lucide-react';
import { useState } from 'react';

const MESSAGE_TYPES: { type: MessageTypes; message: string }[] = [
    { type: 'info', message: 'This is an informational message.' },
    { type: 'success', message: 'Operation completed successfully!' },
    { type: 'warning', message: 'Please review before continuing.' },
    { type: 'error', message: 'Something went wrong. Please try again.' },
    { type: 'help', message: 'Need assistance? Contact support.' },
    { type: 'loginRequired', message: 'Please sign in to continue.' },
    { type: 'disconnected', message: 'Connection lost. Retrying...' },
];

export function UiComponentsDemoPage() {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmResult, setConfirmResult] = useState<string | null>(null);
    const [destructiveOpen, setDestructiveOpen] = useState(false);
    const [unsavedOpen, setUnsavedOpen] = useState(false);
    const [blogPage, setBlogPage] = useState(3);

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <Button asChild variant="ghost" className="w-fit text-muted-foreground hover:text-foreground">
                    <Link to="/demo">← Back to Demo Gallery</Link>
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="uppercase">
                        @ottabase/ui-components
                    </Badge>
                    <h1 className="text-3xl font-semibold tracking-tight dark:text-foreground">UI Components Demo</h1>
                </div>
                <p className="max-w-3xl text-muted-foreground">
                    Shared React components built on shadcn/ui primitives: confirmation dialogs, message boxes, logo,
                    pagination, and utilities.
                </p>
            </div>

            {/* ConfirmDialog */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
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
                        <div className="rounded-lg bg-muted p-3 text-sm">
                            <span className="font-medium">Result:</span> {confirmResult}
                        </div>
                    )}

                    <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
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

            {/* MessageBox */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        MessageBox
                    </CardTitle>
                    <CardDescription>
                        Status message display with icon, color, and loading states. Handles strings, Error objects, and
                        JSON objects.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Message types grid */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {MESSAGE_TYPES.map(({ type, message }) => (
                            <div key={type} className="rounded-lg border">
                                <div className="border-b px-3 py-1.5">
                                    <code className="text-xs">{type}</code>
                                </div>
                                <MessageBox message={message} messageType={type} />
                            </div>
                        ))}
                    </div>

                    {/* Loading states */}
                    <div>
                        <h4 className="mb-3 text-sm font-medium">Loading States</h4>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-lg border">
                                <div className="border-b px-3 py-1.5">
                                    <code className="text-xs">spinner (default)</code>
                                </div>
                                <MessageBox isLoading loadingType="spinner" />
                            </div>
                            <div className="rounded-lg border">
                                <div className="border-b px-3 py-1.5">
                                    <code className="text-xs">skeleton</code>
                                </div>
                                <MessageBox isLoading loadingType="skeleton" />
                            </div>
                        </div>
                    </div>

                    <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
                        <code>{`import { MessageBox } from '@ottabase/ui-components';

// Status message
<MessageBox message="Operation completed!" messageType="success" />

// Loading spinner
<MessageBox isLoading />

// Skeleton loader
<MessageBox isLoading loadingType="skeleton" />`}</code>
                    </pre>
                </CardContent>
            </Card>

            {/* Logo */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <IconPhoto className="h-4 w-4" aria-hidden />
                        Logo
                    </CardTitle>
                    <CardDescription>
                        App name and optional logo image from <code>createAppConfig()</code> defaults; optional built-in
                        theme control.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg border border-border bg-muted/30 p-4 dark:bg-muted/20">
                        <Logo appName="Ottabase UI Components" darkModeSwitcher />
                    </div>
                    <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
                        <code>{`import { Logo } from '@ottabase/ui-components';

<Logo appName="My App" darkModeSwitcher linkUrl="/" />`}</code>
                    </pre>
                </CardContent>
            </Card>

            {/* DarkModeToggle */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <IconMoon className="h-4 w-4" aria-hidden />
                        DarkModeToggle
                    </CardTitle>
                    <CardDescription>Uses next-themes; switch or button presentation.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-center gap-6 rounded-lg border border-border p-4">
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
                    <CardTitle className="text-base flex items-center gap-2">
                        <IconArrowLeft className="h-4 w-4" aria-hidden />
                        HistoryGoBackButton
                    </CardTitle>
                    <CardDescription>
                        Calls <code>history.back()</code> when history length allows.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border border-border p-4">
                        <HistoryGoBackButton />
                    </div>
                </CardContent>
            </Card>

            {/* BlogPagination */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
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
                    <CardTitle className="text-base flex items-center gap-2">
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
                                name: 'MessageBox',
                                desc: 'Status display with icons for info/error/warning/success/help/loading states.',
                                import: "import { MessageBox } from '@ottabase/ui-components';",
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
                            <div key={comp.name} className="rounded-lg border p-3">
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
