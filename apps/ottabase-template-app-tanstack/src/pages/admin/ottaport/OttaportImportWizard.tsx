// ============================================================
// OttaPort Import Wizard
// ============================================================
// Step 1: Upload file → Step 2: Select model & map fields →
// Step 3: Validate & preview → Step 4: Execute & show results
// ============================================================

import { useCallback, useMemo, useState } from 'react';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Label,
    Progress,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
} from '@ottabase/ui-shadcn';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileUp, Loader2, Upload, XCircle } from 'lucide-react';

interface ModelInfo {
    entity: string;
    displayName: string;
    fields: Array<{
        name: string;
        type: string;
        label: string;
        required: boolean;
        editable: boolean;
    }>;
    primaryKey: string;
}

interface ParseResult {
    headers: string[];
    preview: Record<string, string>[];
    totalRows: number;
    format: string;
    filename: string;
    r2Key?: string;
}

interface FieldMapping {
    sourceColumn: string;
    targetField: string;
}

interface ImportResult {
    status: string;
    totalRows: number;
    totalCreated: number;
    totalUpdated: number;
    totalFailed: number;
    totalSkipped: number;
    errors: Array<{ row: number; field?: string; message: string }>;
    durationMs: number;
}

type WizardStep = 'upload' | 'mapping' | 'preview' | 'result';

export function OttaportImportWizard() {
    const [step, setStep] = useState<WizardStep>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [format, setFormat] = useState<string>('csv');
    const [saveToR2, setSaveToR2] = useState(false);
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [selectedModel, setSelectedModel] = useState('');
    const [uniqueField, setUniqueField] = useState('');
    const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Fetch available models
    const { data: modelsData } = useQuery({
        queryKey: ['ottaport', 'models'],
        queryFn: async () => {
            const res = await fetch('/api/admin/ottaport/models');
            if (!res.ok) throw new Error('Failed to fetch models');
            return res.json();
        },
    });

    const models: ModelInfo[] = modelsData?.data || [];

    const selectedModelInfo = useMemo(() => models.find((m) => m.entity === selectedModel), [models, selectedModel]);

    // Parse file mutation
    const parseMutation = useMutation({
        mutationFn: async (uploadFile: File) => {
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('format', format);
            formData.append('saveToR2', String(saveToR2));

            const res = await fetch('/api/admin/ottaport/import/parse', {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to parse file');
            }
            return res.json();
        },
        onSuccess: (data) => {
            setParseResult(data.data);
            setStep('mapping');
        },
    });

    // Import mutation
    const importMutation = useMutation({
        mutationFn: async () => {
            if (!file) throw new Error('No file selected');

            const config = {
                modelEntity: selectedModel,
                fieldMappings,
                uniqueField,
                batchSize: 50,
                saveToR2,
            };

            const formData = new FormData();
            formData.append('file', file);
            formData.append('config', JSON.stringify(config));
            formData.append('format', format);

            const res = await fetch('/api/admin/ottaport/import/execute', {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Import failed');
            }
            return res.json();
        },
        onSuccess: (data) => {
            setImportResult(data.data);
            setStep('result');
        },
    });

    // Auto-map fields when model is selected
    const handleModelSelect = useCallback(
        (entity: string) => {
            setSelectedModel(entity);
            const model = models.find((m) => m.entity === entity);
            if (!model || !parseResult) return;

            // Auto-map by matching header names to field names (case-insensitive)
            const autoMappings: FieldMapping[] = [];
            for (const header of parseResult.headers) {
                const headerLower = header.toLowerCase().replace(/[_\s-]/g, '');
                const match = model.fields.find((f) => {
                    const fieldLower = f.name.toLowerCase().replace(/[_\s-]/g, '');
                    const labelLower = f.label.toLowerCase().replace(/[_\s-]/g, '');
                    return fieldLower === headerLower || labelLower === headerLower;
                });
                if (match) {
                    autoMappings.push({ sourceColumn: header, targetField: match.name });
                }
            }
            setFieldMappings(autoMappings);
        },
        [models, parseResult],
    );

    const updateMapping = (sourceColumn: string, targetField: string) => {
        setFieldMappings((prev) => {
            const existing = prev.findIndex((m) => m.sourceColumn === sourceColumn);
            if (targetField === '__skip__') {
                return prev.filter((m) => m.sourceColumn !== sourceColumn);
            }
            if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = { sourceColumn, targetField };
                return updated;
            }
            return [...prev, { sourceColumn, targetField }];
        });
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            setFile(droppedFile);
            // Auto-detect format
            const ext = droppedFile.name.split('.').pop()?.toLowerCase();
            if (ext === 'tsv' || ext === 'tab') setFormat('tsv');
            else if (ext === 'json') setFormat('json');
            else setFormat('csv');
        }
    }, []);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            setFile(selected);
            const ext = selected.name.split('.').pop()?.toLowerCase();
            if (ext === 'tsv' || ext === 'tab') setFormat('tsv');
            else if (ext === 'json') setFormat('json');
            else setFormat('csv');
        }
    };

    const resetWizard = () => {
        setStep('upload');
        setFile(null);
        setParseResult(null);
        setSelectedModel('');
        setUniqueField('');
        setFieldMappings([]);
        setImportResult(null);
    };

    // ── Step 1: Upload ──
    const renderUploadStep = () => (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileUp className="h-5 w-5" />
                    Upload File
                </CardTitle>
                <CardDescription>Upload a CSV, JSON, or TSV file to import data into any OttaORM model</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div
                    className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                        isDragging
                            ? 'border-primary bg-primary/5'
                            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                    }`}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                >
                    <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="mb-1 text-sm font-medium">Drag and drop your file here, or click to browse</p>
                    <p className="text-xs text-muted-foreground">Supports CSV, JSON, and TSV files</p>
                    <input
                        type="file"
                        accept=".csv,.json,.tsv,.tab,.txt"
                        onChange={handleFileInput}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        style={{ position: 'relative' }}
                    />
                </div>

                {file && (
                    <div className="flex items-center justify-between rounded-md bg-muted p-3">
                        <div className="flex items-center gap-2">
                            <FileUp className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{file.name}</span>
                            <Badge variant="secondary" className="text-xs">
                                {(file.size / 1024).toFixed(1)} KB
                            </Badge>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                            <XCircle className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <Label className="text-xs">File Format</Label>
                        <Select value={format} onValueChange={setFormat}>
                            <SelectTrigger className="mt-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="csv">CSV (Comma-separated)</SelectItem>
                                <SelectItem value="tsv">TSV (Tab-separated)</SelectItem>
                                <SelectItem value="json">JSON (Array of objects)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                        <Switch checked={saveToR2} onCheckedChange={setSaveToR2} id="save-r2" />
                        <Label htmlFor="save-r2" className="text-xs">
                            Save file to R2
                        </Label>
                    </div>
                </div>

                <Button
                    className="w-full"
                    disabled={!file || parseMutation.isPending}
                    onClick={() => file && parseMutation.mutate(file)}
                >
                    {parseMutation.isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Parsing...
                        </>
                    ) : (
                        <>
                            <ArrowRight className="mr-2 h-4 w-4" /> Parse & Continue
                        </>
                    )}
                </Button>

                {parseMutation.isError && (
                    <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        {parseMutation.error?.message}
                    </div>
                )}
            </CardContent>
        </Card>
    );

    // ── Step 2: Field Mapping ──
    const renderMappingStep = () => (
        <Card>
            <CardHeader>
                <CardTitle>Field Mapping</CardTitle>
                <CardDescription>
                    {parseResult?.totalRows} rows detected in <strong>{parseResult?.filename}</strong>. Select a target
                    model and map source columns to model fields.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label className="text-xs">Target Model</Label>
                        <Select value={selectedModel} onValueChange={handleModelSelect}>
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select a model..." />
                            </SelectTrigger>
                            <SelectContent>
                                {models.map((m) => (
                                    <SelectItem key={m.entity} value={m.entity}>
                                        {m.displayName} ({m.entity})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-xs">Unique Field (for upsert)</Label>
                        <Select value={uniqueField} onValueChange={setUniqueField}>
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select unique field..." />
                            </SelectTrigger>
                            <SelectContent>
                                {selectedModelInfo?.fields.map((f) => (
                                    <SelectItem key={f.name} value={f.name}>
                                        {f.label} ({f.name})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {selectedModel && parseResult && (
                    <div className="space-y-2">
                        <Label className="text-xs font-medium">Column Mappings</Label>
                        <div className="rounded-md border">
                            <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                                <span>Source Column</span>
                                <span>→</span>
                                <span>Target Field</span>
                            </div>
                            {parseResult.headers.map((header) => {
                                const mapping = fieldMappings.find((m) => m.sourceColumn === header);
                                return (
                                    <div
                                        key={header}
                                        className="grid grid-cols-[1fr,auto,1fr] items-center gap-2 border-b px-3 py-2 last:border-0"
                                    >
                                        <span className="text-sm font-mono">{header}</span>
                                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                        <Select
                                            value={mapping?.targetField || '__skip__'}
                                            onValueChange={(val) => updateMapping(header, val)}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__skip__">
                                                    <span className="text-muted-foreground">— Skip —</span>
                                                </SelectItem>
                                                {selectedModelInfo?.fields.map((f) => (
                                                    <SelectItem key={f.name} value={f.name}>
                                                        {f.label} ({f.name})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Preview table */}
                {parseResult && parseResult.preview.length > 0 && (
                    <div className="space-y-2">
                        <Label className="text-xs font-medium">Preview (first 5 rows)</Label>
                        <div className="overflow-x-auto rounded-md border">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        {parseResult.headers.map((h) => (
                                            <th key={h} className="px-3 py-1.5 text-left font-medium">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {parseResult.preview.map((row, i) => (
                                        <tr key={i} className="border-b last:border-0">
                                            {parseResult.headers.map((h) => (
                                                <td key={h} className="px-3 py-1.5 font-mono">
                                                    {row[h] || '—'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep('upload')}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button
                        className="flex-1"
                        disabled={!selectedModel || !uniqueField || fieldMappings.length === 0}
                        onClick={() => setStep('preview')}
                    >
                        Review & Import <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );

    // ── Step 3: Review & Execute ──
    const renderPreviewStep = () => (
        <Card>
            <CardHeader>
                <CardTitle>Review & Import</CardTitle>
                <CardDescription>Review the configuration before executing the import.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 rounded-md bg-muted/50 p-4 text-sm">
                    <div>
                        <span className="text-muted-foreground">File:</span> <strong>{parseResult?.filename}</strong>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Total Rows:</span>{' '}
                        <strong>{parseResult?.totalRows}</strong>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Target Model:</span>{' '}
                        <strong>{selectedModelInfo?.displayName}</strong>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Unique Field:</span> <strong>{uniqueField}</strong>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Mapped Fields:</span>{' '}
                        <strong>{fieldMappings.length}</strong>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Format:</span>{' '}
                        <Badge variant="secondary">{format.toUpperCase()}</Badge>
                    </div>
                </div>

                <div className="space-y-1">
                    <Label className="text-xs font-medium">Field Mappings</Label>
                    <div className="flex flex-wrap gap-1.5">
                        {fieldMappings.map((m) => (
                            <Badge key={m.sourceColumn} variant="outline" className="text-xs">
                                {m.sourceColumn} → {m.targetField}
                            </Badge>
                        ))}
                    </div>
                </div>

                {importMutation.isPending && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Importing data...
                        </div>
                        <Progress value={undefined} className="h-2" />
                    </div>
                )}

                {importMutation.isError && (
                    <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        {importMutation.error?.message}
                    </div>
                )}

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep('mapping')} disabled={importMutation.isPending}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button
                        className="flex-1"
                        onClick={() => importMutation.mutate()}
                        disabled={importMutation.isPending}
                    >
                        {importMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...
                            </>
                        ) : (
                            <>
                                <Upload className="mr-2 h-4 w-4" /> Execute Import
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );

    // ── Step 4: Results ──
    const renderResultStep = () => {
        if (!importResult) return null;
        const isSuccess = importResult.status === 'completed';
        const isPartial = importResult.status === 'partial';

        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {isSuccess ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : isPartial ? (
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                        ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        Import {isSuccess ? 'Completed' : isPartial ? 'Partially Completed' : 'Failed'}
                    </CardTitle>
                    <CardDescription>Processed in {(importResult.durationMs / 1000).toFixed(1)}s</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-4 gap-3">
                        <div className="rounded-md border p-3 text-center">
                            <div className="text-2xl font-bold">{importResult.totalRows}</div>
                            <div className="text-xs text-muted-foreground">Total Rows</div>
                        </div>
                        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-center dark:border-green-800 dark:bg-green-950">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {importResult.totalCreated}
                            </div>
                            <div className="text-xs text-muted-foreground">Created</div>
                        </div>
                        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-center dark:border-blue-800 dark:bg-blue-950">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {importResult.totalUpdated}
                            </div>
                            <div className="text-xs text-muted-foreground">Updated</div>
                        </div>
                        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-center dark:border-red-800 dark:bg-red-950">
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                                {importResult.totalFailed}
                            </div>
                            <div className="text-xs text-muted-foreground">Failed</div>
                        </div>
                    </div>

                    {importResult.errors.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-destructive">
                                Errors ({importResult.errors.length})
                            </Label>
                            <div className="max-h-48 overflow-y-auto rounded-md border border-red-200 dark:border-red-800">
                                {importResult.errors.slice(0, 50).map((err, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-2 border-b px-3 py-2 text-xs last:border-0"
                                    >
                                        <Badge variant="destructive" className="shrink-0 text-[10px]">
                                            Row {err.row}
                                        </Badge>
                                        <span className="text-muted-foreground">{err.message}</span>
                                    </div>
                                ))}
                                {importResult.errors.length > 50 && (
                                    <div className="px-3 py-2 text-xs text-muted-foreground">
                                        ...and {importResult.errors.length - 50} more errors
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <Button onClick={resetWizard} className="w-full">
                        Start New Import
                    </Button>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-4">
            {/* Step indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {(['upload', 'mapping', 'preview', 'result'] as WizardStep[]).map((s, i) => (
                    <div key={s} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-muted-foreground/50">›</span>}
                        <span className={step === s ? 'font-medium text-foreground' : ''}>
                            {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
                        </span>
                    </div>
                ))}
            </div>

            {step === 'upload' && renderUploadStep()}
            {step === 'mapping' && renderMappingStep()}
            {step === 'preview' && renderPreviewStep()}
            {step === 'result' && renderResultStep()}
        </div>
    );
}
