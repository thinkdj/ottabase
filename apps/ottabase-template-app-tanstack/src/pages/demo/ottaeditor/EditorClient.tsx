import {
    DEFAULT_PLUGIN_NAMES,
    useOttaEditor,
    type BlockToolConstructable,
    type OutputData,
} from "@ottabase/ottaeditor";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@ottabase/ui-shadcn";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import CustomAlertPlugin from "./CustomAlertPlugin";

const sampleDataFull: OutputData = {
    time: Date.now(),
    blocks: [
        {
            type: "header",
            data: { text: "Welcome to OttaEditor Demo!", level: 1 },
        },
        {
            type: "paragraph",
            data: {
                text: "This is a demo of the OttaEditor package with EditorJS plugins registered.",
            },
        },
    ],
    version: "2.30.7",
};

const sampleDataMinimal: OutputData = {
    time: Date.now(),
    blocks: [
        {
            type: "header",
            data: { text: "Editor 2: Custom Configuration", level: 2 },
        },
        {
            type: "paragraph",
            data: {
                text: "This editor only has Header + Paragraph plus a custom Alert plugin!",
            },
        },
        {
            type: "alert",
            data: {
                type: "info",
                message: "This is a custom Alert plugin!",
            },
        },
    ],
    version: "2.30.7",
};

export function EditorClient() {
    const [savedData1, setSavedData1] = useState<OutputData | null>(null);
    const [savedData2, setSavedData2] = useState<OutputData | null>(null);

    const editor1 = useOttaEditor({
        defaultPlugins: "all",
        placeholder: "Editor with all default plugins...",
        data: sampleDataFull,
        minHeight: 300,
    });

    const editor2 = useOttaEditor({
        defaultPlugins: [DEFAULT_PLUGIN_NAMES.HEADER, DEFAULT_PLUGIN_NAMES.PARAGRAPH],
        additionalPlugins: [
            {
                name: "alert",
                tool: CustomAlertPlugin as unknown as BlockToolConstructable,
                config: { defaultType: "info" } as Record<string, unknown>,
            },
        ],
        placeholder: "Editor with header, paragraph, and custom alert plugin...",
        data: sampleDataMinimal,
        minHeight: 300,
    });

    const handleSave1 = async () => {
        const data = await editor1.save();
        if (data) {
            setSavedData1(data);
            alert("Editor 1 saved successfully!");
        }
    };

    const handleSave2 = async () => {
        const data = await editor2.save();
        if (data) {
            setSavedData2(data);
            alert("Editor 2 saved successfully!");
        }
    };

    return (
        <div className="mx-auto max-w-7xl space-y-8 p-6">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo">← Back to Demo Gallery</Link>
            </Button>

            <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">OttaEditor Demo</h1>
                <p className="text-lg text-muted-foreground">
                    Demonstrates plugin configuration with two editors.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Editor 1: All Default Plugins</span>
                        <div className="flex items-center gap-2">
                            {editor1.isReady ? (
                                <Badge>Ready</Badge>
                            ) : (
                                <Badge variant="secondary">Initializing...</Badge>
                            )}
                        </div>
                    </CardTitle>
                    <CardDescription>
                        Using <code>defaultPlugins: &apos;all&apos;</code>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Button onClick={handleSave1} disabled={!editor1.isReady || !editor1.hasUnsavedChanges}>
                            Save
                        </Button>
                        <Button onClick={() => editor1.clear()} disabled={!editor1.isReady} variant="destructive">
                            Clear
                        </Button>
                        <Button onClick={() => editor1.render(sampleDataFull)} disabled={!editor1.isReady} variant="outline">
                            Reload Sample
                        </Button>
                    </div>
                    <div ref={editor1.editorRef} className="min-h-[300px] max-w-none rounded-lg border p-4" />
                    {savedData1 ? (
                        <details className="mt-4">
                            <summary className="cursor-pointer text-sm font-semibold">
                                Show Saved JSON
                            </summary>
                            <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-4 text-xs">
                                {JSON.stringify(savedData1, null, 2)}
                            </pre>
                        </details>
                    ) : null}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Editor 2: Specific Plugins + Custom Plugin</span>
                        <div className="flex items-center gap-2">
                            {editor2.isReady ? (
                                <Badge>Ready</Badge>
                            ) : (
                                <Badge variant="secondary">Initializing...</Badge>
                            )}
                        </div>
                    </CardTitle>
                    <CardDescription>
                        Using <code>defaultPlugins: ['header', 'paragraph']</code> + custom Alert plugin
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Button onClick={handleSave2} disabled={!editor2.isReady || !editor2.hasUnsavedChanges}>
                            Save
                        </Button>
                        <Button onClick={() => editor2.clear()} disabled={!editor2.isReady} variant="destructive">
                            Clear
                        </Button>
                        <Button onClick={() => editor2.render(sampleDataMinimal)} disabled={!editor2.isReady} variant="outline">
                            Reload Sample
                        </Button>
                    </div>
                    <div ref={editor2.editorRef} className="min-h-[300px] max-w-none rounded-lg border p-4" />
                    {savedData2 ? (
                        <details className="mt-4">
                            <summary className="cursor-pointer text-sm font-semibold">
                                Show Saved JSON
                            </summary>
                            <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-4 text-xs">
                                {JSON.stringify(savedData2, null, 2)}
                            </pre>
                        </details>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
