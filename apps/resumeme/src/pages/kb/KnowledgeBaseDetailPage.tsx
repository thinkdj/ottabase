// ---------------------------------------------------------------------------
// KnowledgeBaseDetailPage — Detail view for a single Knowledge Base folder.
// Shows metadata editing, file management, and AI analysis results.
// This is the app's USP page — the core experience.
// ---------------------------------------------------------------------------

import {
    Badge,
    Button,
    Card,
    CardContent,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Separator,
    Textarea,
} from '@ottabase/ui-shadcn';
import {
    IconArrowLeft,
    IconBrain,
    IconBuildingSkyscraper,
    IconChevronDown,
    IconChevronUp,
    IconDeviceFloppy,
    IconFile,
    IconFileText,
    IconPhoto,
    IconSparkles,
    IconTarget,
    IconTrash,
    IconUpload,
} from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────

interface KnowledgeBaseDetail {
    id: string;
    name: string;
    description?: string;
    targetRole?: string;
    targetCompany?: string;
    status?: string;
    analysisResult?: string | null;
    lastAnalysisAt?: number | string | null;
    fileCount?: number;
    createdAt?: number | string;
    updatedAt?: number | string;
}

interface KnowledgeBaseFile {
    id: string;
    fileName: string;
    fileType?: string;
    mimeType?: string;
    fileSize?: number;
    status?: string;
    extractedText?: string | null;
    createdAt?: number | string;
}

interface AnalysisResult {
    matchScore: number;
    summary: string;
    skillMatches: Array<{ skill: string; relevance: 'high' | 'medium' | 'low'; note: string }>;
    skillGaps: Array<{ skill: string; importance: 'critical' | 'important' | 'nice-to-have'; suggestion: string }>;
    resumeImprovements: Array<{ section: string; suggestion: string; priority: 'high' | 'medium' | 'low' }>;
    talkingPoints: string[];
    interviewTips: string[];
}

// ── Helpers ──────────────────────────────────────────────────

function formatDate(ts: unknown): string {
    if (!ts) return '';
    const d = typeof ts === 'number' ? new Date(ts) : new Date(String(ts));
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatFileSize(bytes: unknown): string {
    const n = typeof bytes === 'number' ? bytes : Number(bytes);
    if (!n || isNaN(n)) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function parseAnalysisResult(raw: string | null | undefined): AnalysisResult | null {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as AnalysisResult;
    } catch {
        return null;
    }
}

/** Icon for a given file type */
function FileTypeIcon({ type }: { type?: string }) {
    const cls = 'h-5 w-5 shrink-0';
    switch (type) {
        case 'image':
            return <IconPhoto className={`${cls} text-pink-500`} />;
        case 'pdf':
            return <IconFile className={`${cls} text-red-500`} />;
        case 'txt':
        case 'md':
            return <IconFileText className={`${cls} text-blue-500`} />;
        case 'docx':
        case 'doc':
            return <IconFileText className={`${cls} text-indigo-500`} />;
        default:
            return <IconFile className={`${cls} text-muted-foreground`} />;
    }
}

// ── Badge colour maps ────────────────────────────────────────

const relevanceBadge: Record<string, string> = {
    high: 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400',
    medium: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    low: 'border-gray-400/40 bg-gray-400/10 text-gray-600 dark:text-gray-400',
};

const importanceBadge: Record<string, string> = {
    critical: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400',
    important: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    'nice-to-have': 'border-gray-400/40 bg-gray-400/10 text-gray-600 dark:text-gray-400',
};

const priorityBadge: Record<string, string> = {
    high: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400',
    medium: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    low: 'border-gray-400/40 bg-gray-400/10 text-gray-600 dark:text-gray-400',
};

const fileStatusBadge: Record<string, string> = {
    processed: 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400',
    uploaded: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400',
    error: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400',
};

/** Score colour based on thresholds */
function scoreColour(score: number): string {
    if (score >= 70) return 'text-green-600 dark:text-green-400';
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
}

function scoreBg(score: number): string {
    if (score >= 70) return 'from-green-500/10 to-green-500/5 border-green-500/20';
    if (score >= 40) return 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/20';
    return 'from-red-500/10 to-red-500/5 border-red-500/20';
}

// ── Component ────────────────────────────────────────────────

export function KnowledgeBaseDetailPage({ kbId }: { kbId: string }) {
    // ── State ────────────────────────────────────────────────
    const [kb, setKb] = useState<KnowledgeBaseDetail | null>(null);
    const [files, setFiles] = useState<KnowledgeBaseFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [analysing, setAnalysing] = useState(false);
    const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Editable form fields
    const [form, setForm] = useState({
        name: '',
        description: '',
        targetRole: '',
        targetCompany: '',
    });

    // ── Data loading ─────────────────────────────────────────

    const loadData = useCallback(async () => {
        try {
            const [kbRes, filesRes] = await Promise.all([fetch(`/api/kb/${kbId}`), fetch(`/api/kb/${kbId}/files`)]);

            if (kbRes.ok) {
                const kbJson = await kbRes.json();
                // API returns { success, data: {...} } envelope
                const kbData = (kbJson?.data ?? kbJson) as KnowledgeBaseDetail;
                setKb(kbData);
                setForm({
                    name: kbData.name ?? '',
                    description: kbData.description ?? '',
                    targetRole: kbData.targetRole ?? '',
                    targetCompany: kbData.targetCompany ?? '',
                });
            }

            if (filesRes.ok) {
                const filesJson = await filesRes.json();
                // API returns { success, data: [...] } envelope
                const filesData = filesJson?.data ?? filesJson;
                setFiles(Array.isArray(filesData) ? filesData : []);
            }
        } catch {
            toast.error('Failed to load knowledge base');
        } finally {
            setLoading(false);
        }
    }, [kbId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // ── Handlers ─────────────────────────────────────────────

    const handleSave = useCallback(async () => {
        if (!form.name.trim()) {
            toast.error('Name is required');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/kb/${kbId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name.trim(),
                    description: form.description.trim() || undefined,
                    targetRole: form.targetRole.trim() || undefined,
                    targetCompany: form.targetCompany.trim() || undefined,
                }),
            });
            if (!res.ok) throw new Error('Save failed');
            const json = await res.json();
            const updated = (json?.data ?? json) as KnowledgeBaseDetail;
            setKb(updated);
            toast.success('Changes saved');
        } catch {
            toast.error('Failed to save changes');
        } finally {
            setSaving(false);
        }
    }, [kbId, form]);

    const handleFileUpload = useCallback(
        async (file: File) => {
            setUploading(true);
            try {
                const formData = new FormData();
                formData.append('file', file);

                const res = await fetch(`/api/kb/${kbId}/files`, {
                    method: 'POST',
                    body: formData,
                });
                if (!res.ok) throw new Error('Upload failed');
                toast.success(`Uploaded ${file.name}`);
                // Refresh file list
                const filesRes = await fetch(`/api/kb/${kbId}/files`);
                if (filesRes.ok) {
                    const filesJson = await filesRes.json();
                    const filesData = filesJson?.data ?? filesJson;
                    setFiles(Array.isArray(filesData) ? filesData : []);
                }
            } catch {
                toast.error(`Failed to upload ${file.name}`);
            } finally {
                setUploading(false);
            }
        },
        [kbId],
    );

    const handleDeleteFile = useCallback(
        async (fileId: string) => {
            try {
                const res = await fetch(`/api/kb/${kbId}/files/${fileId}`, { method: 'DELETE' });
                if (!res.ok) throw new Error('Delete failed');
                setFiles((prev) => prev.filter((f) => f.id !== fileId));
                toast.success('File deleted');
            } catch {
                toast.error('Failed to delete file');
            }
            setDeleteFileId(null);
        },
        [kbId],
    );

    const handleAnalyse = useCallback(async () => {
        setAnalysing(true);
        try {
            const res = await fetch(`/api/kb/${kbId}/analyse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            if (!res.ok) throw new Error('Analysis failed');
            const json = await res.json();
            // API returns { success, data: analysisObject }
            const analysisData = json?.data ?? json;
            // Update KB with new analysis result
            setKb((prev) =>
                prev
                    ? {
                          ...prev,
                          analysisResult:
                              typeof analysisData === 'string' ? analysisData : JSON.stringify(analysisData),
                          lastAnalysisAt: Date.now(),
                      }
                    : prev,
            );
            toast.success('Analysis complete!');
        } catch {
            toast.error('Failed to run analysis');
        } finally {
            setAnalysing(false);
        }
    }, [kbId]);

    const toggleFileExpanded = useCallback((fileId: string) => {
        setExpandedFiles((prev) => {
            const next = new Set(prev);
            if (next.has(fileId)) next.delete(fileId);
            else next.add(fileId);
            return next;
        });
    }, []);

    // ── Derived state ────────────────────────────────────────

    const analysis = parseAnalysisResult(kb?.analysisResult);
    const hasExtractedText = files.some((f) => f.extractedText && f.extractedText.trim().length > 0);

    // ── Loading state ────────────────────────────────────────

    if (loading) {
        return (
            <div className="mx-auto max-w-4xl px-4 py-16">
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                    <p className="text-sm text-muted-foreground">Loading knowledge base…</p>
                </div>
            </div>
        );
    }

    if (!kb) {
        return (
            <div className="mx-auto max-w-4xl px-4 py-16 text-center">
                <p className="text-muted-foreground">Knowledge base not found.</p>
                <Button variant="outline" asChild className="mt-4 gap-2">
                    <Link to={'/kb' as any}>
                        <IconArrowLeft className="h-4 w-4" />
                        Back to Knowledge Base
                    </Link>
                </Button>
            </div>
        );
    }

    // ── Render ───────────────────────────────────────────────

    return (
        <div className="mx-auto max-w-4xl px-4 py-8">
            {/* ── Breadcrumb & Back ───────────────────────────── */}
            <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Link to={'/kb' as any} className="hover:text-foreground transition-colors">
                    Knowledge Base
                </Link>
                <span>/</span>
                <span className="text-foreground font-medium truncate">{kb.name}</span>
            </nav>

            {/* ════════════════════════════════════════════════════
                Section 1: Header & Metadata
               ════════════════════════════════════════════════════ */}
            <Card className="mb-8">
                <CardContent className="p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" asChild className="shrink-0 h-9 w-9">
                                <Link to={'/kb' as any}>
                                    <IconArrowLeft className="h-4 w-4" />
                                </Link>
                            </Button>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight">{kb.name}</h1>
                                {kb.createdAt && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        Created {formatDate(kb.createdAt)}
                                    </p>
                                )}
                            </div>
                        </div>
                        <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
                            <IconDeviceFloppy className="h-4 w-4" />
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </div>

                    <div className="grid gap-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="kb-name">Name *</Label>
                            <Input
                                id="kb-name"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Google SWE Application"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="kb-desc">Description</Label>
                            <Textarea
                                id="kb-desc"
                                rows={2}
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                placeholder="Brief description of this knowledge base"
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="grid gap-1.5">
                                <Label htmlFor="kb-role" className="flex items-center gap-1.5">
                                    <IconTarget className="h-3.5 w-3.5 text-muted-foreground" />
                                    Target Role
                                </Label>
                                <Input
                                    id="kb-role"
                                    value={form.targetRole}
                                    onChange={(e) => setForm((f) => ({ ...f, targetRole: e.target.value }))}
                                    placeholder="e.g. Senior Frontend Engineer"
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="kb-company" className="flex items-center gap-1.5">
                                    <IconBuildingSkyscraper className="h-3.5 w-3.5 text-muted-foreground" />
                                    Target Company
                                </Label>
                                <Input
                                    id="kb-company"
                                    value={form.targetCompany}
                                    onChange={(e) => setForm((f) => ({ ...f, targetCompany: e.target.value }))}
                                    placeholder="e.g. Google"
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ════════════════════════════════════════════════════
                Section 2: Files
               ════════════════════════════════════════════════════ */}
            <Card className="mb-8">
                <CardContent className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight">Files</h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Upload job descriptions, company info, and other documents.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            className="gap-2"
                            disabled={uploading}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <IconUpload className="h-4 w-4" />
                            {uploading ? 'Uploading…' : 'Upload File'}
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".pdf,.txt,.md,.docx,.png,.jpg,.jpeg"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(file);
                                // Reset so re-selecting the same file triggers onChange
                                e.target.value = '';
                            }}
                        />
                    </div>

                    {/* File list */}
                    {files.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center dark:border-white/10">
                            <IconUpload className="h-8 w-8 text-muted-foreground/40" />
                            <div>
                                <p className="text-sm text-muted-foreground">No files yet</p>
                                <p className="mt-1 text-xs text-muted-foreground/70">
                                    Drag &amp; drop or click Upload to add files
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-1 gap-2"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <IconUpload className="h-3.5 w-3.5" />
                                Choose File
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {files.map((file) => {
                                const isExpanded = expandedFiles.has(file.id);
                                const hasText = !!file.extractedText?.trim();

                                return (
                                    <Collapsible
                                        key={file.id}
                                        open={isExpanded}
                                        onOpenChange={() => toggleFileExpanded(file.id)}
                                    >
                                        <div className="group rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50 dark:border-white/10">
                                            <div className="flex items-center gap-3">
                                                <FileTypeIcon type={file.fileType} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium truncate">{file.fileName}</p>
                                                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                                        <span>{formatFileSize(file.fileSize)}</span>
                                                        {file.fileType && (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-[10px] px-1.5 py-0 font-normal uppercase tracking-wide"
                                                            >
                                                                {file.fileType}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-xs font-normal ${fileStatusBadge[file.status ?? ''] ?? ''}`}
                                                >
                                                    {file.status ?? 'uploaded'}
                                                </Badge>
                                                {hasText && (
                                                    <CollapsibleTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 shrink-0"
                                                        >
                                                            {isExpanded ? (
                                                                <IconChevronUp className="h-4 w-4" />
                                                            ) : (
                                                                <IconChevronDown className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </CollapsibleTrigger>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 shrink-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => setDeleteFileId(file.id)}
                                                >
                                                    <IconTrash className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            {/* Extracted text preview (collapsible) */}
                                            {hasText && (
                                                <CollapsibleContent>
                                                    <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap dark:bg-white/5">
                                                        {file.extractedText}
                                                    </div>
                                                </CollapsibleContent>
                                            )}
                                        </div>
                                    </Collapsible>
                                );
                            })}
                        </div>
                    )}

                    {/* Supported types hint */}
                    <p className="mt-3 text-[11px] text-muted-foreground/60">
                        Supported: .pdf, .txt, .md, .docx, .png, .jpg, .jpeg — max 10 MB
                    </p>
                </CardContent>
            </Card>

            {/* ════════════════════════════════════════════════════
                Section 3: AI Analysis
               ════════════════════════════════════════════════════ */}
            <Card>
                <CardContent className="p-6">
                    <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                            <IconBrain className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight">AI Analysis</h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Analyse your profile against this opportunity using AI.
                            </p>
                        </div>
                    </div>

                    {/* Analyse button */}
                    {!hasExtractedText && files.length > 0 ? (
                        <div className="mb-5 rounded-lg border border-dashed border-yellow-500/30 bg-yellow-500/5 p-4 text-center">
                            <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                Upload text-based files (.pdf, .txt, .md, .docx) to enable AI analysis. Image files
                                alone cannot be analysed.
                            </p>
                        </div>
                    ) : files.length === 0 ? (
                        <div className="mb-5 rounded-lg border border-dashed p-4 text-center dark:border-white/10">
                            <p className="text-sm text-muted-foreground">
                                Upload files first to run AI analysis against your profile.
                            </p>
                        </div>
                    ) : null}

                    <Button
                        size="lg"
                        className="w-full gap-2.5 bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500"
                        disabled={analysing || files.length === 0}
                        onClick={handleAnalyse}
                    >
                        {analysing ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                Analysing your profile against this opportunity…
                            </>
                        ) : (
                            <>
                                <IconSparkles className="h-5 w-5" />
                                Analyse with AI
                            </>
                        )}
                    </Button>

                    {kb.lastAnalysisAt && (
                        <p className="mt-2 text-center text-xs text-muted-foreground">
                            Last analysed {formatDate(kb.lastAnalysisAt)}
                        </p>
                    )}

                    {/* ── Analysis results ────────────────────────── */}
                    {analysis && (
                        <div className="mt-6 space-y-6">
                            <Separator />

                            {/* Match Score — hero element */}
                            <div
                                className={`rounded-xl border bg-gradient-to-br p-6 text-center ${scoreBg(analysis.matchScore)}`}
                            >
                                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Match Score
                                </p>
                                <p
                                    className={`text-5xl font-extrabold tabular-nums ${scoreColour(analysis.matchScore)}`}
                                >
                                    {analysis.matchScore}
                                    <span className="text-2xl font-semibold">%</span>
                                </p>
                            </div>

                            {/* Summary */}
                            {analysis.summary && (
                                <div>
                                    <h3 className="mb-2 text-sm font-semibold">Summary</h3>
                                    <p className="text-sm leading-relaxed text-muted-foreground">{analysis.summary}</p>
                                </div>
                            )}

                            {/* Skill Matches */}
                            {analysis.skillMatches?.length > 0 && (
                                <div>
                                    <h3 className="mb-3 text-sm font-semibold">Skill Matches</h3>
                                    <div className="overflow-hidden rounded-lg border dark:border-white/10">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-muted/50 dark:border-white/10">
                                                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                                                        Skill
                                                    </th>
                                                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                                                        Relevance
                                                    </th>
                                                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                                                        Note
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analysis.skillMatches.map((m, i) => (
                                                    <tr key={i} className="border-b last:border-0 dark:border-white/10">
                                                        <td className="px-4 py-2.5 font-medium">{m.skill}</td>
                                                        <td className="px-4 py-2.5">
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-xs ${relevanceBadge[m.relevance] ?? ''}`}
                                                            >
                                                                {m.relevance}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-muted-foreground">{m.note}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Skill Gaps */}
                            {analysis.skillGaps?.length > 0 && (
                                <div>
                                    <h3 className="mb-3 text-sm font-semibold">Skill Gaps</h3>
                                    <div className="overflow-hidden rounded-lg border dark:border-white/10">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-muted/50 dark:border-white/10">
                                                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                                                        Skill
                                                    </th>
                                                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                                                        Importance
                                                    </th>
                                                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                                                        Suggestion
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analysis.skillGaps.map((g, i) => (
                                                    <tr key={i} className="border-b last:border-0 dark:border-white/10">
                                                        <td className="px-4 py-2.5 font-medium">{g.skill}</td>
                                                        <td className="px-4 py-2.5">
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-xs ${importanceBadge[g.importance] ?? ''}`}
                                                            >
                                                                {g.importance}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-muted-foreground">
                                                            {g.suggestion}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Resume Improvements */}
                            {analysis.resumeImprovements?.length > 0 && (
                                <div>
                                    <h3 className="mb-3 text-sm font-semibold">Resume Improvements</h3>
                                    <div className="space-y-2">
                                        {analysis.resumeImprovements.map((imp, i) => (
                                            <div
                                                key={i}
                                                className="flex items-start gap-3 rounded-lg border p-3 dark:border-white/10"
                                            >
                                                <Badge
                                                    variant="outline"
                                                    className={`mt-0.5 shrink-0 text-xs ${priorityBadge[imp.priority] ?? ''}`}
                                                >
                                                    {imp.priority}
                                                </Badge>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium">{imp.section}</p>
                                                    <p className="mt-0.5 text-sm text-muted-foreground">
                                                        {imp.suggestion}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Talking Points */}
                            {analysis.talkingPoints?.length > 0 && (
                                <div>
                                    <h3 className="mb-3 text-sm font-semibold">Talking Points</h3>
                                    <ul className="space-y-2">
                                        {analysis.talkingPoints.map((point, i) => (
                                            <li
                                                key={i}
                                                className="flex items-start gap-2.5 text-sm text-muted-foreground"
                                            >
                                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Interview Tips */}
                            {analysis.interviewTips?.length > 0 && (
                                <div>
                                    <h3 className="mb-3 text-sm font-semibold">Interview Tips</h3>
                                    <ul className="space-y-2">
                                        {analysis.interviewTips.map((tip, i) => (
                                            <li
                                                key={i}
                                                className="flex items-start gap-2.5 text-sm text-muted-foreground"
                                            >
                                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                                {tip}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Delete file confirmation dialog ────────────── */}
            <Dialog open={!!deleteFileId} onOpenChange={() => setDeleteFileId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete File?</DialogTitle>
                        <DialogDescription>
                            This will permanently delete this file from the knowledge base. This action cannot be
                            undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteFileId(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => deleteFileId && handleDeleteFile(deleteFileId)}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
