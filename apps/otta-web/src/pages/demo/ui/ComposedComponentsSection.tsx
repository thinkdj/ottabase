/**
 * The composed components of @ottabase/ui (built from its primitives): MessageBox,
 * DarkModeToggle and JsonEditor. ConfirmDialog is shown under Dialogs & Overlays;
 * SplitPane has its own page at /demo/split-pane.
 */
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    DarkModeToggle,
    MessageBox,
    type MessageTypes,
} from '@ottabase/ui';
import { JsonEditor, type JsonValue } from '@ottabase/ui/json-editor';
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

const SAMPLE_JSON: JsonValue = {
    title: 'Hello Ottabase',
    published: true,
    views: 42,
    tags: ['edge', 'workers'],
    author: { name: 'Ada', email: null },
};

export function ComposedComponentsSection() {
    const [json, setJson] = useState<JsonValue>(SAMPLE_JSON);

    return (
        <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Composed Components</h2>

            <Card>
                <CardHeader>
                    <CardTitle>MessageBox</CardTitle>
                    <CardDescription>
                        A centered status panel: one icon and one message for an empty, failed, locked or loading
                        region. Takes a string, a node, an Error or a plain object.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {MESSAGE_TYPES.map(({ type, message }) => (
                            <div key={type} className="rounded-lg bg-background ring-1 ring-border">
                                <div className="border-b border-border/60 px-3 py-1.5">
                                    <code className="text-xs">{type}</code>
                                </div>
                                <MessageBox message={message} messageType={type} />
                            </div>
                        ))}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-lg bg-background ring-1 ring-border">
                            <div className="border-b border-border/60 px-3 py-1.5">
                                <code className="text-xs">isLoading (spinner)</code>
                            </div>
                            <MessageBox isLoading loadingType="spinner" />
                        </div>
                        <div className="rounded-lg bg-background ring-1 ring-border">
                            <div className="border-b border-border/60 px-3 py-1.5">
                                <code className="text-xs">isLoading (skeleton)</code>
                            </div>
                            <MessageBox isLoading loadingType="skeleton" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>DarkModeToggle</CardTitle>
                        <CardDescription>
                            Theme switch on next-themes. The icon shows where it goes, and colours ease once.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap items-start gap-6">
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                    type=&quot;toggle-switch&quot;
                                </p>
                                <DarkModeToggle type="toggle-switch" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">type=&quot;button&quot;</p>
                                <DarkModeToggle type="button" title="Toggle color theme" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>JsonEditor</CardTitle>
                        <CardDescription>
                            Tree and Raw modes, inline editing, live validation. Imported from{' '}
                            <code>@ottabase/ui/json-editor</code>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <JsonEditor value={json} onChange={setJson} rootLabel="post" />
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
