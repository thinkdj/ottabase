/**
 * Admin changelog editor — OttaEditor body + optional hero image/video JSON.
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { useSession } from '@/lib/auth';
import {
    AdvancedImageTool,
    MediaLibraryTool,
    useOttaEditor,
    type BlockToolConstructable,
    type OutputData,
    type ToolSettings,
} from '@ottabase/ottaeditor';
import { createModelHooks } from '@ottabase/ottaorm/client';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
} from '@ottabase/ui-shadcn';
import { generateSlug } from '@ottabase/ottablog';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { IconArrowLeft, IconLoader2 } from '@tabler/icons-react';
import { useCallback, useState } from 'react';

type ChangelogStatus = 'draft' | 'published' | 'archived';

type HeroMediaState =
    | { kind: 'image'; url: string; alt: string; caption: string }
    | { kind: 'video'; url: string; caption: string; mimeType: string };

interface ChangelogEntry {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    content: OutputData | null;
    heroMedia: Record<string, unknown> | null;
    status: ChangelogStatus;
    publishedAt: string | null;
    appId: string | null;
    authorName: string | null;
}

const changelogHooks = createModelHooks<ChangelogEntry>({ entityName: 'changelog_entries' });

const getEditorConfig = (placeholder: string) => ({
    defaultPlugins: 'all' as const,
    placeholder,
    minHeight: 200,
    additionalPlugins: [
        {
            name: 'image',
            tool: AdvancedImageTool as unknown as BlockToolConstructable,
            config: {
                provider: 'r2',
                uploadEndpoint: '/api/upload',
            } as ToolSettings,
        },
        {
            name: 'mediaLibrary',
            tool: MediaLibraryTool as unknown as BlockToolConstructable,
            config: {} as ToolSettings,
        },
    ],
});

function parseHeroMedia(raw: Record<string, unknown> | null): HeroMediaState | null {
    if (!raw || typeof raw !== 'object') return null;
    const kind = raw.kind;
    if (kind === 'video' && typeof raw.url === 'string') {
        return {
            kind: 'video',
            url: raw.url,
            caption: typeof raw.caption === 'string' ? raw.caption : '',
            mimeType: typeof raw.mimeType === 'string' ? raw.mimeType : 'video/mp4',
        };
    }
    if (kind === 'image' && typeof raw.url === 'string') {
        return {
            kind: 'image',
            url: raw.url,
            alt: typeof raw.alt === 'string' ? raw.alt : '',
            caption: typeof raw.caption === 'string' ? raw.caption : '',
        };
    }
    return null;
}

export function AdminChangelogEditorPage() {
    const params = useParams({ strict: false });
    const entryId = (params as { entryId?: string }).entryId;
    const isEditMode = Boolean(entryId);
    const { data: existing, isLoading } = changelogHooks.useDetail(entryId || '', {
        enabled: isEditMode && !!entryId,
        ...ADMIN_LIST_QUERY_CONFIG,
    });

    if (isEditMode && (isLoading || !existing)) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <IconLoader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
            </div>
        );
    }

    return <ChangelogEditorForm entryId={entryId} isEditMode={isEditMode} initialData={existing ?? undefined} />;
}

function ChangelogEditorForm({
    entryId,
    isEditMode,
    initialData,
}: {
    entryId?: string;
    isEditMode: boolean;
    initialData?: ChangelogEntry;
}) {
    const navigate = useNavigate();
    const { user } = useSession({ skipAutoSync: true });
    const [title, setTitle] = useState(initialData?.title ?? '');
    const [slug, setSlug] = useState(initialData?.slug ?? '');
    const [summary, setSummary] = useState(initialData?.summary ?? '');
    const [status, setStatus] = useState<ChangelogStatus>(initialData?.status ?? 'draft');
    const [publishedAt, setPublishedAt] = useState(
        initialData?.publishedAt ? new Date(initialData.publishedAt).toISOString().slice(0, 16) : '',
    );
    const [heroKind, setHeroKind] = useState<'none' | 'image' | 'video'>(() => {
        const h = parseHeroMedia(initialData?.heroMedia ?? null);
        if (!h) return 'none';
        return h.kind;
    });
    const [heroImageUrl, setHeroImageUrl] = useState(() => {
        const h = parseHeroMedia(initialData?.heroMedia ?? null);
        return h?.kind === 'image' ? h.url : '';
    });
    const [heroImageAlt, setHeroImageAlt] = useState(() => {
        const h = parseHeroMedia(initialData?.heroMedia ?? null);
        return h?.kind === 'image' ? h.alt : '';
    });
    const [heroVideoUrl, setHeroVideoUrl] = useState(() => {
        const h = parseHeroMedia(initialData?.heroMedia ?? null);
        return h?.kind === 'video' ? h.url : '';
    });
    const [heroCaption, setHeroCaption] = useState(() => {
        const h = parseHeroMedia(initialData?.heroMedia ?? null);
        return h?.caption ?? '';
    });
    const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
    const [slugError, setSlugError] = useState<string | null>(null);
    const [alertMsg, setAlertMsg] = useState<string | null>(null);

    const editor = useOttaEditor({
        ...getEditorConfig('Write the full announcement…'),
        data: initialData?.content ?? undefined,
    });

    const createEntry = changelogHooks.useCreate();
    const updateEntry = changelogHooks.useUpdate();
    const isSaving = createEntry.isPending || updateEntry.isPending;

    const doSlugCheck = useCallback(
        (slugToCheck?: string) => {
            const toCheck = (slugToCheck ?? (slug || generateSlug(title))).trim();
            if (!toCheck) {
                setSlugStatus('idle');
                setSlugError(null);
                return;
            }
            if (!/^[A-Za-z0-9_-]+$/.test(toCheck)) {
                setSlugStatus('idle');
                setSlugError('Slug can only contain letters, numbers, hyphens, and underscores.');
                return;
            }
            setSlugError(null);
            setSlugStatus('checking');
            const params = new URLSearchParams();
            params.set('uniqueField', 'slug');
            params.set('uniqueValue', toCheck);
            if (entryId) params.set('uniqueIgnoreId', entryId);
            if (initialData?.appId) {
                params.set('where', JSON.stringify({ appId: initialData.appId }));
            } else {
                params.set('where', JSON.stringify({ appId: null }));
            }
            fetch(`/api/ottaorm/changelog_entries/unique?${params.toString()}`)
                .then((res) => res.json())
                .then((result: unknown) => {
                    const u = result as { unique?: boolean };
                    setSlugStatus(u.unique ? 'available' : 'taken');
                })
                .catch(() => setSlugStatus('idle'));
        },
        [slug, title, entryId, initialData?.appId],
    );

    const initialSlug = (initialData?.slug ?? '').trim();

    const handleTitleBlur = () => {
        if (!isEditMode || !slug) {
            const newSlug = generateSlug(title);
            setSlug(newSlug);
            if (newSlug !== initialSlug) doSlugCheck(newSlug);
        } else if (slug.trim() !== initialSlug) {
            doSlugCheck();
        }
    };

    const handleSlugBlur = () => {
        if (slug.trim() !== initialSlug) doSlugCheck();
    };

    const buildHeroMedia = (): Record<string, unknown> | null => {
        if (heroKind === 'image' && heroImageUrl.trim()) {
            return {
                kind: 'image',
                url: heroImageUrl.trim(),
                alt: heroImageAlt.trim() || undefined,
                caption: heroCaption.trim() || undefined,
            };
        }
        if (heroKind === 'video' && heroVideoUrl.trim()) {
            return {
                kind: 'video',
                url: heroVideoUrl.trim(),
                mimeType: 'video/mp4',
                caption: heroCaption.trim() || undefined,
            };
        }
        return null;
    };

    const handleSave = async () => {
        if (!title.trim()) {
            setAlertMsg('Title is required');
            return;
        }
        const baseSlug = (slug || generateSlug(title)).trim();
        if (!/^[A-Za-z0-9_-]+$/.test(baseSlug)) {
            setAlertMsg('Invalid slug');
            return;
        }
        if (slugStatus === 'taken') {
            setAlertMsg('Slug is already in use');
            return;
        }
        setAlertMsg(null);
        try {
            const content = await editor.save();
            const body: Record<string, unknown> = {
                title: title.trim(),
                slug: baseSlug,
                summary: summary.trim() || null,
                content,
                heroMedia: buildHeroMedia(),
                status,
                authorName: user?.name ?? initialData?.authorName ?? null,
            };
            if (publishedAt) {
                body.publishedAt = new Date(publishedAt).toISOString();
            } else if (status === 'published' && !isEditMode) {
                body.publishedAt = new Date().toISOString();
            }
            if (isEditMode && entryId) {
                await updateEntry.mutateAsync({ id: entryId, data: body });
            } else {
                await createEntry.mutateAsync(body);
            }
            navigate({ to: '/admin/changelog' });
        } catch (e) {
            setAlertMsg(e instanceof Error ? e.message : 'Save failed');
        }
    };

    return (
        <div className="mx-auto max-w-4xl px-4 py-8">
            <Button variant="ghost" size="sm" asChild className="mb-6">
                <Link to="/admin/changelog">
                    <IconArrowLeft className="mr-1.5 size-4" aria-hidden />
                    Changelog list
                </Link>
            </Button>

            <Card className="border-border dark:border-border">
                <CardHeader>
                    <CardTitle>{isEditMode ? 'Edit entry' : 'New changelog entry'}</CardTitle>
                    <CardDescription>OttaEditor content; optional hero image or video for the listing.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {alertMsg && (
                        <p className="text-sm text-destructive dark:text-destructive" role="alert">
                            {alertMsg}
                        </p>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="cl-title">Title</Label>
                        <Input
                            id="cl-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={handleTitleBlur}
                            className="bg-background dark:bg-background"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="cl-slug">Slug</Label>
                        <Input
                            id="cl-slug"
                            value={slug}
                            onChange={(e) => {
                                setSlug(e.target.value);
                                setSlugStatus('idle');
                            }}
                            onBlur={handleSlugBlur}
                            aria-invalid={slugStatus === 'taken' || !!slugError}
                            className="bg-background font-mono text-sm dark:bg-background"
                        />
                        {slugError && <p className="text-xs text-destructive">{slugError}</p>}
                        {slugStatus === 'taken' && <p className="text-xs text-destructive">Slug already in use</p>}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="cl-summary">Summary (listing teaser)</Label>
                        <Textarea
                            id="cl-summary"
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            rows={3}
                            className="bg-background dark:bg-background"
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select value={status} onValueChange={(v) => setStatus(v as ChangelogStatus)}>
                                <SelectTrigger className="bg-background dark:bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="published">Published</SelectItem>
                                    <SelectItem value="archived">Archived</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="cl-published">Published at</Label>
                            <Input
                                id="cl-published"
                                type="datetime-local"
                                value={publishedAt}
                                onChange={(e) => setPublishedAt(e.target.value)}
                                className="bg-background dark:bg-background"
                            />
                        </div>
                    </div>

                    <div className="rounded-lg border border-border p-4 dark:border-border">
                        <Label className="mb-3 block">Hero media (listing)</Label>
                        <Select
                            value={heroKind}
                            onValueChange={(v) => setHeroKind(v as 'none' | 'image' | 'video')}
                        >
                            <SelectTrigger className="mb-3 bg-background dark:bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="image">Image</SelectItem>
                                <SelectItem value="video">Video</SelectItem>
                            </SelectContent>
                        </Select>
                        {heroKind === 'image' && (
                            <div className="space-y-2">
                                <Input
                                    placeholder="Image URL"
                                    value={heroImageUrl}
                                    onChange={(e) => setHeroImageUrl(e.target.value)}
                                    className="bg-background dark:bg-background"
                                />
                                <Input
                                    placeholder="Alt text"
                                    value={heroImageAlt}
                                    onChange={(e) => setHeroImageAlt(e.target.value)}
                                    className="bg-background dark:bg-background"
                                />
                            </div>
                        )}
                        {heroKind === 'video' && (
                            <Input
                                placeholder="Video URL (mp4)"
                                value={heroVideoUrl}
                                onChange={(e) => setHeroVideoUrl(e.target.value)}
                                className="bg-background dark:bg-background"
                            />
                        )}
                        {(heroKind === 'image' || heroKind === 'video') && (
                            <Input
                                placeholder="Caption (optional)"
                                value={heroCaption}
                                onChange={(e) => setHeroCaption(e.target.value)}
                                className="mt-2 bg-background dark:bg-background"
                            />
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label>Body</Label>
                        <div
                            ref={editor.editorRef}
                            className="min-h-[400px] max-w-none rounded-lg border border-border p-4 prose prose-neutral dark:prose-invert dark:border-border"
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
                            {isSaving ? (
                                <IconLoader2 className="mr-2 size-4 animate-spin" aria-hidden />
                            ) : null}
                            Save
                        </Button>
                        <Button type="button" variant="outline" asChild>
                            <Link to="/admin/changelog">Cancel</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default AdminChangelogEditorPage;
