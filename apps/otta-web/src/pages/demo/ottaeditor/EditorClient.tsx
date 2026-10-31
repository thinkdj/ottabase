import {
    AdvancedImageTool,
    BlockPalette,
    DEFAULT_PLUGIN_NAMES,
    useOttaEditor,
    type BlockToolConstructable,
    type OutputData,
    type UseOttaEditorOptions,
} from '@ottabase/ottaeditor';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@ottabase/ui';
import { useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';
import CustomAlertPlugin from './CustomAlertPlugin';

const sampleDataFull: OutputData = {
    time: Date.now(),
    blocks: [
        {
            type: 'header',
            data: { text: 'Welcome to OttaEditor Demo!', level: 1 },
        },
        {
            type: 'paragraph',
            data: {
                text: 'This editor uses the <b>AdvancedImageTool</b> for image handling. Try dragging and dropping an image or pasting a URL!',
            },
        },
        {
            type: 'steps',
            data: {
                items: [
                    {
                        title: 'Plan the sequence',
                        content: 'Use a short title and one or two lines of supporting context for each step.',
                    },
                    {
                        title: 'Refine the details',
                        content: 'Reorder or delete steps from the actions menu to keep the flow concise.',
                    },
                    {
                        title: 'Save and render',
                        content: 'The same block data renders as a vertical timeline in ottarenderer.',
                    },
                ],
            },
        },
        // We'll let the user add an image manually to test upload
    ],
    version: '2.30.7',
};

const sampleDataMinimal: OutputData = {
    time: Date.now(),
    blocks: [
        {
            type: 'header',
            data: { text: 'Editor 2: Custom Configuration', level: 2 },
        },
        {
            type: 'paragraph',
            data: {
                text: 'Header, paragraph and one custom block written with the editor kit. The ending of this sentence is an <span class="cdx-spoiler">inline spoiler</span>: select any words and press the eye-off button (or Ctrl+Shift+H) to make one.',
            },
        },
        {
            type: 'alert',
            data: {
                type: 'info',
                title: 'Custom blocks fit in',
                message:
                    'This alert is a third-party block built from the editor kit. Pick a tone, type the title and message straight into the card.',
            },
        },
    ],
    version: '2.30.7',
};

interface DemoEditorProps {
    title: string;
    description: React.ReactNode;
    config: UseOttaEditorOptions;
    sampleData: OutputData;
}

function DemoEditor({ title, description, config, sampleData }: DemoEditorProps) {
    const [savedData, setSavedData] = useState<OutputData | null>(null);

    const editor = useOttaEditor({
        ...config,
        data: sampleData,
    });

    const handleSave = async () => {
        const data = await editor.save();
        if (data) {
            setSavedData(data);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>{title}</span>
                    <div className="flex items-center gap-2">
                        {editor.isReady ? <Badge>Ready</Badge> : <Badge variant="secondary">Initializing...</Badge>}
                    </div>
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={!editor.isReady || !editor.hasUnsavedChanges}>
                        Save
                    </Button>
                    <Button onClick={() => editor.clear()} disabled={!editor.isReady} variant="destructive">
                        Clear
                    </Button>
                    <Button onClick={() => editor.render(sampleData)} disabled={!editor.isReady} variant="outline">
                        Reload Sample
                    </Button>
                </div>
                <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                    {/* The canvas styles itself: no prose wrapper, no padding */}
                    <div
                        ref={editor.editorRef}
                        className="min-h-[300px] rounded-xl border border-border/60 bg-background py-3"
                    />
                    <aside className="hidden lg:block rounded-xl bg-muted/40 p-3 max-h-[32rem] overflow-y-auto">
                        <BlockPalette editor={editor.editor} />
                    </aside>
                </div>
                {savedData ? (
                    <details className="mt-4">
                        <summary className="cursor-pointer text-sm font-semibold">Show Saved JSON</summary>
                        <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-4 text-xs">
                            {JSON.stringify(savedData, null, 2)}
                        </pre>
                    </details>
                ) : null}
            </CardContent>
        </Card>
    );
}

export function EditorClient() {
    const [alertDialog, setAlertDialog] = useState<{ open: boolean; title: string; message: string }>({
        open: false,
        title: '',
        message: '',
    });

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="OttaEditor"
                description="Demonstrates plugin configuration and uploads through the files service."
            />

            <DemoEditor
                key="editor-1"
                title="Editor 1: Full-Featured"
                description={
                    <span>
                        Using <code>AdvancedImageTool</code>: uploads go to <code>POST /api/files</code> as media
                        library files.
                    </span>
                }
                config={{
                    defaultPlugins: 'all',
                    placeholder: 'Editor with all default plugins...',
                    minHeight: 300,
                    additionalPlugins: [
                        {
                            name: 'image', // Override default 'image' tool
                            tool: AdvancedImageTool as unknown as BlockToolConstructable,
                            config: {
                                uploadEndpoint: '/api/files',
                                purpose: 'media',
                            },
                        },
                    ],
                }}
                sampleData={sampleDataFull}
            />

            <DemoEditor
                key="editor-2"
                title="Editor 2: Minimal Configuration"
                description={
                    <span>
                        Using <code>defaultPlugins: ['header', 'paragraph', 'inlineSpoiler']</code> plus a custom Alert
                        block built with the editor kit
                    </span>
                }
                config={{
                    defaultPlugins: [
                        DEFAULT_PLUGIN_NAMES.HEADER,
                        DEFAULT_PLUGIN_NAMES.PARAGRAPH,
                        DEFAULT_PLUGIN_NAMES.INLINE_SPOILER,
                    ],
                    additionalPlugins: [
                        {
                            name: 'alert',
                            tool: CustomAlertPlugin as unknown as BlockToolConstructable,
                            config: { defaultType: 'info' } as Record<string, unknown>,
                        },
                    ],
                    placeholder: 'Editor with header, paragraph, and custom alert plugin...',
                    minHeight: 300,
                }}
                sampleData={sampleDataMinimal}
            />

            <AlertDialog
                open={alertDialog.open}
                onOpenChange={(open) => !open && setAlertDialog({ ...alertDialog, open: false })}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
                        <AlertDialogDescription>{alertDialog.message}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setAlertDialog({ ...alertDialog, open: false })}>
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
