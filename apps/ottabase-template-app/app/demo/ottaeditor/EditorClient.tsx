'use client';

import {
    DEFAULT_PLUGIN_NAMES,
    useOttaEditor,
    type OutputData,
    type BlockToolConstructable,
} from '@ottabase/ottaeditor';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import Link from 'next/link';
import { useState } from 'react';
import CustomAlertPlugin from './CustomAlertPlugin';

const sampleDataFull: OutputData = {
    time: Date.now(),
    blocks: [
        {
            type: 'header',
            data: {
                text: 'Welcome to OttaEditor Demo! 🎉',
                level: 1,
            },
        },
        {
            type: 'paragraph',
            data: {
                text: 'This is a comprehensive demo of the <mark>OttaEditor</mark> package with all <u>EditorJS plugins</u> registered. Try out the various tools below!',
            },
        },
        {
            type: 'header',
            data: {
                text: 'Available Tools',
                level: 2,
            },
        },
        {
            type: 'list',
            data: {
                style: 'unordered',
                items: [
                    {
                        content: 'Header - Different heading levels',
                        items: [],
                    },
                    {
                        content:
                            'Paragraph - Basic text editing with <mark>marker</mark>, <u>underline</u>, and <code class="inline-code">inline code</code>',
                        items: [],
                    },
                    {
                        content: 'Nested List - Hierarchical lists',
                        items: [
                            {
                                content: 'Nested item 1',
                                items: [],
                            },
                            {
                                content: 'Nested item 2',
                                items: [],
                            },
                        ],
                    },
                    {
                        content: 'Checklist - Task management',
                        items: [],
                    },
                    {
                        content: 'Code - Syntax highlighting',
                        items: [],
                    },
                    {
                        content: 'Quote - Blockquotes',
                        items: [],
                    },
                    {
                        content: 'Table - Data organization',
                        items: [],
                    },
                    {
                        content: 'Warning - Important callouts',
                        items: [],
                    },
                    {
                        content: 'Delimiter - Section separators',
                        items: [],
                    },
                    {
                        content: 'Link - URL embedding',
                        items: [],
                    },
                    {
                        content: 'Embed - Media embedding (YouTube, Vimeo, etc.)',
                        items: [],
                    },
                    {
                        content: 'Raw HTML - Direct HTML input',
                        items: [],
                    },
                ],
            },
        },
        {
            type: 'delimiter',
            data: {},
        },
        {
            type: 'header',
            data: {
                text: 'Code Example',
                level: 3,
            },
        },
        {
            type: 'code',
            data: {
                code: 'import { useOttaEditor } from "@ottabase/ottaeditor";\n\nfunction MyEditor() {\n  const { editorRef, save, clear } = useOttaEditor({\n    placeholder: "Start writing...",\n    autofocus: true,\n  });\n\n  return <div ref={editorRef} />;\n}',
            },
        },
        {
            type: 'header',
            data: {
                text: 'Checklist Example',
                level: 3,
            },
        },
        {
            type: 'checklist',
            data: {
                items: [
                    {
                        text: 'Install @ottabase/ottaeditor',
                        checked: true,
                    },
                    {
                        text: 'Register EditorJS plugins',
                        checked: true,
                    },
                    {
                        text: 'Create your first editor',
                        checked: false,
                    },
                ],
            },
        },
        {
            type: 'quote',
            data: {
                text: 'The best way to predict the future is to invent it.',
                caption: 'Alan Kay',
                alignment: 'left',
            },
        },
        {
            type: 'warning',
            data: {
                title: 'Important Note',
                message: 'Make sure to save your editor content before navigating away!',
            },
        },
        {
            type: 'table',
            data: {
                withHeadings: true,
                content: [
                    ['Plugin', 'Purpose', 'Status'],
                    ['Header', 'Headings', '✅'],
                    ['Paragraph', 'Text', '✅'],
                    ['List', 'Lists', '✅'],
                    ['Code', 'Code blocks', '✅'],
                ],
            },
        },
    ],
    version: '2.30.7',
};

const sampleDataMinimal: OutputData = {
    time: Date.now(),
    blocks: [
        {
            type: 'header',
            data: {
                text: 'Editor 2: Custom Configuration',
                level: 2,
            },
        },
        {
            type: 'paragraph',
            data: {
                text: 'This editor only has Header, Paragraph plugins plus a custom Alert plugin!',
            },
        },
        {
            type: 'alert',
            data: {
                type: 'info',
                message: 'This is a custom Alert plugin! Change the type dropdown above to see different styles.',
            },
        },
    ],
    version: '2.30.7',
};

export function EditorClient() {
    const [savedData1, setSavedData1] = useState<OutputData | null>(null);
    const [savedData2, setSavedData2] = useState<OutputData | null>(null);

    // Editor 1: All default plugins
    const editor1 = useOttaEditor({
        defaultPlugins: 'all',
        placeholder: 'Editor with all default plugins...',
        data: sampleDataFull,
        minHeight: 300,
    });

    // Editor 2: Specific plugins + custom plugin
    const editor2 = useOttaEditor({
        defaultPlugins: [DEFAULT_PLUGIN_NAMES.HEADER, DEFAULT_PLUGIN_NAMES.PARAGRAPH],
        additionalPlugins: [
            {
                name: 'alert',
                tool: CustomAlertPlugin as unknown as BlockToolConstructable,
                config: { defaultType: 'info' } as Record<string, unknown>,
            },
        ],
        placeholder: 'Editor with header, paragraph, and custom alert plugin...',
        data: sampleDataMinimal,
        minHeight: 300,
    });

    const handleSave1 = async () => {
        const data = await editor1.save();
        if (data) {
            setSavedData1(data);
            console.log('Editor 1 saved:', data);
            alert('Editor 1 saved successfully!');
        }
    };

    const handleSave2 = async () => {
        const data = await editor2.save();
        if (data) {
            setSavedData2(data);
            console.log('Editor 2 saved:', data);
            alert('Editor 2 saved successfully!');
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8">
            {/* Back to Demo Gallery */}
            <Link href="/demo" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
                ← Back to Demo Gallery
            </Link>

            {/* Header */}
            <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">OttaEditor Demo - New Plugin Configuration</h1>
                <p className="text-lg text-muted-foreground">
                    Demonstrating the new typesafe plugin configuration system with two editors side-by-side.
                </p>
            </div>

            {/* Configuration Examples */}
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <CardHeader>
                    <CardTitle>New Typesafe Plugin Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <p className="text-sm font-semibold mb-2">Editor 1: All Plugins</p>
                        <pre className="bg-slate-900 text-slate-50 p-4 rounded-md overflow-x-auto text-sm">
                            <code>{`const editor1 = useOttaEditor({
  defaultPlugins: 'all',  // Loads all 15 default plugins
  placeholder: 'Start writing...',
});`}</code>
                        </pre>
                    </div>
                    <div>
                        <p className="text-sm font-semibold mb-2">Editor 2: Specific Plugins + Custom Plugin</p>
                        <pre className="bg-slate-900 text-slate-50 p-4 rounded-md overflow-x-auto text-sm">
                            <code>{`import { useOttaEditor, DEFAULT_PLUGIN_NAMES } from '@ottabase/ottaeditor';
import CustomAlertPlugin from './CustomAlertPlugin';

const editor2 = useOttaEditor({
  defaultPlugins: [
    DEFAULT_PLUGIN_NAMES.HEADER,      // TypeScript autocomplete!
    DEFAULT_PLUGIN_NAMES.PARAGRAPH,
  ],
  additionalPlugins: [
    { name: 'alert', tool: CustomAlertPlugin }
  ],
});`}</code>
                        </pre>
                    </div>
                </CardContent>
            </Card>

            {/* Editor 1 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Editor 1: All Default Plugins</span>
                        <div className="flex items-center gap-2">
                            {editor1.isReady ? (
                                <Badge variant="default" className="bg-green-500">
                                    ✅ Ready
                                </Badge>
                            ) : (
                                <Badge variant="secondary">⏳ Initializing...</Badge>
                            )}
                        </div>
                    </CardTitle>
                    <CardDescription>
                        Using <code>defaultPlugins: &apos;all&apos;</code> - loads all 15 default plugins
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Button onClick={handleSave1} disabled={!editor1.isReady || !editor1.hasUnsavedChanges}>
                            💾 Save Editor 1{editor1.hasUnsavedChanges && <span className="ml-2 text-xs">●</span>}
                        </Button>
                        <Button onClick={() => editor1.clear()} disabled={!editor1.isReady} variant="destructive">
                            🗑️ Clear
                        </Button>
                        <Button
                            onClick={() => editor1.render(sampleDataFull)}
                            disabled={!editor1.isReady}
                            variant="outline"
                        >
                            📝 Reload Sample
                        </Button>
                    </div>
                    <div
                        ref={editor1.editorRef}
                        className="min-h-[300px] prose prose-slate dark:prose-invert max-w-none border rounded-lg p-4"
                    />
                    {savedData1 && (
                        <details className="mt-4">
                            <summary className="cursor-pointer text-sm font-semibold">Show Saved JSON</summary>
                            <pre className="bg-slate-900 text-slate-50 p-4 rounded-md overflow-auto max-h-48 text-xs mt-2">
                                <code>{JSON.stringify(savedData1, null, 2)}</code>
                            </pre>
                        </details>
                    )}
                </CardContent>
            </Card>

            {/* Editor 2 */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Editor 2: Specific Plugins + Custom Plugin</span>
                        <div className="flex items-center gap-2">
                            {editor2.isReady ? (
                                <Badge variant="default" className="bg-green-500">
                                    ✅ Ready
                                </Badge>
                            ) : (
                                <Badge variant="secondary">⏳ Initializing...</Badge>
                            )}
                        </div>
                    </CardTitle>
                    <CardDescription>
                        Using <code>defaultPlugins: [&apos;header&apos;, &apos;paragraph&apos;]</code> + custom Alert
                        plugin
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Button onClick={handleSave2} disabled={!editor2.isReady || !editor2.hasUnsavedChanges}>
                            💾 Save Editor 2{editor2.hasUnsavedChanges && <span className="ml-2 text-xs">●</span>}
                        </Button>
                        <Button onClick={() => editor2.clear()} disabled={!editor2.isReady} variant="destructive">
                            🗑️ Clear
                        </Button>
                        <Button
                            onClick={() => editor2.render(sampleDataMinimal)}
                            disabled={!editor2.isReady}
                            variant="outline"
                        >
                            📝 Reload Sample
                        </Button>
                    </div>
                    <div
                        ref={editor2.editorRef}
                        className="min-h-[300px] prose prose-slate dark:prose-invert max-w-none border rounded-lg p-4"
                    />
                    {savedData2 && (
                        <details className="mt-4">
                            <summary className="cursor-pointer text-sm font-semibold">Show Saved JSON</summary>
                            <pre className="bg-slate-900 text-slate-50 p-4 rounded-md overflow-auto max-h-48 text-xs mt-2">
                                <code>{JSON.stringify(savedData2, null, 2)}</code>
                            </pre>
                        </details>
                    )}
                </CardContent>
            </Card>

            {/* Available Plugin Names */}
            <Card>
                <CardHeader>
                    <CardTitle>Available Default Plugin Names</CardTitle>
                    <CardDescription>All these names have TypeScript autocomplete support</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[
                            { name: 'header', label: 'Header' },
                            { name: 'paragraph', label: 'Paragraph' },
                            { name: 'list', label: 'Nested List' },
                            { name: 'checklist', label: 'Checklist' },
                            { name: 'code', label: 'Code' },
                            { name: 'quote', label: 'Quote' },
                            { name: 'table', label: 'Table' },
                            { name: 'warning', label: 'Warning' },
                            { name: 'delimiter', label: 'Delimiter' },
                            { name: 'linkTool', label: 'Link Tool' },
                            { name: 'embed', label: 'Embed' },
                            { name: 'raw', label: 'Raw HTML' },
                            { name: 'Marker', label: 'Marker (inline)' },
                            { name: 'underline', label: 'Underline (inline)' },
                            { name: 'inlineCode', label: 'Inline Code' },
                        ].map(({ name, label }) => (
                            <div key={name} className="flex flex-col p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                <code className="text-xs font-mono text-blue-600 dark:text-blue-400">
                                    &apos;{name}&apos;
                                </code>
                                <span className="text-sm text-muted-foreground mt-1">{label}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Features */}
            <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <CardHeader>
                    <CardTitle>✨ Key Features</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2">
                        <li>
                            ✅ <strong>TypeScript Autocomplete</strong> - Plugin names have full IDE support
                        </li>
                        <li>
                            ✅ <strong>&apos;all&apos; Option</strong> - Load all plugins with a single keyword
                        </li>
                        <li>
                            ✅ <strong>Selective Loading</strong> - Pick only the plugins you need
                        </li>
                        <li>
                            ✅ <strong>Easy Custom Plugins</strong> - Use <code>additionalPlugins</code> to add your own
                        </li>
                        <li>
                            ✅ <strong>Unsaved Changes Detection</strong> - <code>hasUnsavedChanges</code> flag enables
                            smart save buttons
                        </li>
                        <li>
                            ✅ <strong>Backward Compatible</strong> - Old code still works
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
