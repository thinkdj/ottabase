import {
    AdvancedImageTool,
    DEFAULT_PLUGIN_NAMES,
    useOttaEditor,
    type BlockToolConstructable,
    type OutputData,
    type UseOttaEditorOptions,
} from "@ottabase/ottaeditor";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Label,
    RadioGroup,
    RadioGroupItem,
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
                text: "This editor uses the <b>AdvancedImageTool</b> for image handling. Try dragging and dropping an image or pasting a URL!",
            },
        },
        // We'll let the user add an image manually to test upload
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

type UploadProvider = "r2" | "cloudflare-images";

interface DemoEditorProps {
    title: string;
    description: React.ReactNode;
    config: UseOttaEditorOptions;
    sampleData: OutputData;
    id: string; // Used for key to force remount
}

function DemoEditor({ title, description, config, sampleData, id }: DemoEditorProps) {
    const [savedData, setSavedData] = useState<OutputData | null>(null);

    const editor = useOttaEditor({
        ...config,
        data: sampleData,
    });

    const handleSave = async () => {
        const data = await editor.save();
        if (data) {
            setSavedData(data);
            alert("Editor saved successfully!");
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>{title}</span>
                    <div className="flex items-center gap-2">
                        {editor.isReady ? (
                            <Badge>Ready</Badge>
                        ) : (
                            <Badge variant="secondary">Initializing...</Badge>
                        )}
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
                <div ref={editor.editorRef} className="min-h-[300px] prose prose-slate dark:prose-invert max-w-none rounded-lg border p-4" />
                {savedData ? (
                    <details className="mt-4">
                        <summary className="cursor-pointer text-sm font-semibold">
                            Show Saved JSON
                        </summary>
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
    const [uploadProvider, setUploadProvider] = useState<UploadProvider>("r2");

    return (
        <div className="mx-auto max-w-7xl space-y-8 p-6">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo">← Back to Demo Gallery</Link>
            </Button>

            <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">OttaEditor Demo</h1>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <p className="text-lg text-muted-foreground">
                        Demonstrates plugin configuration and Cloudflare integration.
                    </p>

                    <Card className="w-full md:w-auto">
                        <CardContent className="pt-6">
                            <Label className="mb-2 block text-sm font-medium">Upload Provider</Label>
                            <RadioGroup
                                value={uploadProvider}
                                onValueChange={(v) => setUploadProvider(v as UploadProvider)}
                                className="flex gap-4"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="r2" id="r2" />
                                    <Label htmlFor="r2">Cloudflare R2</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="cloudflare-images" id="cf-images" />
                                    <Label htmlFor="cf-images">Cloudflare Images</Label>
                                </div>
                            </RadioGroup>
                            <p className="mt-2 text-xs text-muted-foreground">
                                Switches the backend service used by AdvancedImageTool.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <DemoEditor
                id={`editor-1-${uploadProvider}`}
                title="Editor 1: Full-Featured"
                description={
                    <span>
                        Using <code>AdvancedImageTool</code> with <strong>{uploadProvider === 'r2' ? 'R2' : 'CF Images'}</strong> provider.
                    </span>
                }
                config={{
                    defaultPlugins: "all",
                    placeholder: "Editor with all default plugins...",
                    minHeight: 300,
                    additionalPlugins: [
                        {
                            name: "image", // Override default 'image' tool
                            tool: AdvancedImageTool as unknown as BlockToolConstructable,
                            config: {
                                provider: uploadProvider,
                                uploadEndpoint: '/api/upload',
                            },
                        },
                    ],
                }}
                sampleData={sampleDataFull}
            />

            <DemoEditor
                id="editor-2"
                title="Editor 2: Minimal Configuration"
                description={
                    <span>
                        Using <code>defaultPlugins: ['header', 'paragraph']</code> + custom Alert plugin
                    </span>
                }
                config={{
                    defaultPlugins: [DEFAULT_PLUGIN_NAMES.HEADER, DEFAULT_PLUGIN_NAMES.PARAGRAPH],
                    additionalPlugins: [
                        {
                            name: "alert",
                            tool: CustomAlertPlugin as unknown as BlockToolConstructable,
                            config: { defaultType: "info" } as Record<string, unknown>,
                        },
                    ],
                    placeholder: "Editor with header, paragraph, and custom alert plugin...",
                    minHeight: 300,
                }}
                sampleData={sampleDataMinimal}
            />
        </div>
    );
}
