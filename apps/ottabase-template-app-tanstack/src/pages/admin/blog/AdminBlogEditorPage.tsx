/**
 * Admin Blog Editor Page
 *
 * Full-featured blog post editor with OttaEditor integration,
 * hero image upload, SEO settings, and all post fields.
 */
import {
    CONTENT_TYPES,
    formatDate,
    POST_STATUSES,
    generateSlug,
    type ContentType,
    type HeroImage,
    type PostStatus,
    type SeoMeta,
} from '@ottabase/ottablog';
import {
    AdvancedImageTool,
    useOttaEditor,
    type BlockToolConstructable,
    type OutputData,
    type ToolSettings,
} from '@ottabase/ottaeditor';
import { SERIES_LIST_QUERY_CONFIG, VERSION_HISTORY_QUERY_CONFIG } from '@/config/queryConfig';
import { createModelHooks } from '@ottabase/ottaorm/client';
import { useQueryClient } from '@tanstack/react-query';
import { Blocks, customRenderers, defaultEJSRConfigs } from '@ottabase/ottarenderer';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea,
} from '@ottabase/ui-shadcn';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import {
    ArrowLeft,
    Calendar,
    FileText,
    History,
    Image as ImageIcon,
    Layers,
    Loader2,
    Save,
    Search,
    Send,
    Settings,
    StickyNote,
    Trash2,
    User,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: OutputData | null;
    contentType: ContentType;
    status: PostStatus;
    categoryId: string | null;
    seriesId: string | null;
    seriesOrder: number | null;
    heroImage: HeroImage | null;
    seoMeta: SeoMeta | null;
    privateNotes: OutputData | null;
    footnotes: OutputData | null;
    authorId: string | null;
    authorName: string | null;
    authorEmail: string | null;
    isFeatured: boolean;
    allowComments: boolean;
    publishedAt: string | null;
    maxVersionsToKeep: number | null;
    wordCount: number | null;
    appId: string | null;
}

interface BlogSeries {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    isComplete: boolean;
}

interface BlogPostVersion {
    id: string;
    postId: string;
    versionNumber: number;
    title: string;
    content: OutputData | null;
    excerpt: string | null;
    privateNotes: OutputData | null;
    footnotes: OutputData | null;
    changedBy?: string | null;
    changeNote?: string | null;
    createdAt: string;
    wordCount: number | null;
}

const blogPostHooks = createModelHooks<BlogPost>({ entityName: 'posts' });
const blogSeriesHooks = createModelHooks<BlogSeries>({ entityName: 'series' });
const blogPostVersionHooks = createModelHooks<BlogPostVersion>({ entityName: 'post_versions' });

// Editor configuration with image upload
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
    ],
});

// Wrapper component that handles data loading
export function AdminBlogEditorPage() {
    const params = useParams({ strict: false });
    const postId = (params as { postId?: string }).postId;
    const isEditMode = Boolean(postId);

    // Fetch data in the wrapper
    const { data: existingPost, isLoading: isLoadingPost } = blogPostHooks.useDetail(postId || '');

    // Show loading state until data is ready (for edit mode)
    if (isEditMode && (isLoadingPost || !existingPost)) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Render the form only when data is ready
    return <BlogEditorForm postId={postId} isEditMode={isEditMode} initialData={existingPost ?? undefined} />;
}

// Inner component that uses the editor hook - only mounted when data is ready
interface BlogEditorFormProps {
    postId?: string;
    isEditMode: boolean;
    initialData?: BlogPost;
}

function BlogEditorForm({ postId, isEditMode, initialData }: BlogEditorFormProps) {
    const navigate = useNavigate();

    // Form state - initialized from props
    const [title, setTitle] = useState(initialData?.title || '');
    const [slug, setSlug] = useState(initialData?.slug || '');
    const [excerpt, setExcerpt] = useState(initialData?.excerpt || '');
    const [contentType, setContentType] = useState<ContentType>(initialData?.contentType || 'blog');
    const [status, setStatus] = useState<PostStatus>(initialData?.status || 'draft');
    const [authorName, setAuthorName] = useState(initialData?.authorName || '');
    const [isFeatured, setIsFeatured] = useState(initialData?.isFeatured || false);
    const [allowComments, setAllowComments] = useState(initialData?.allowComments ?? true);
    const [publishedAt, setPublishedAt] = useState(
        initialData?.publishedAt ? new Date(initialData.publishedAt).toISOString().slice(0, 16) : '',
    );

    // Hero image state
    const [heroImage, setHeroImage] = useState<HeroImage | null>(initialData?.heroImage || null);
    const [isUploadingHero, setIsUploadingHero] = useState(false);

    // SEO state - initialized from props
    const [seoTitle, setSeoTitle] = useState(initialData?.seoMeta?.title || '');
    const [seoDescription, setSeoDescription] = useState(initialData?.seoMeta?.description || '');
    const [seoKeywords, setSeoKeywords] = useState(initialData?.seoMeta?.keywords?.join(', ') || '');
    const [seoNoIndex, setSeoNoIndex] = useState(initialData?.seoMeta?.noIndex || false);

    // Series state
    const [seriesId, setSeriesId] = useState<string | null>(initialData?.seriesId || null);
    const [seriesOrder, setSeriesOrder] = useState<number | null>(initialData?.seriesOrder || null);

    // Version history settings
    const [maxVersionsToKeep, setMaxVersionsToKeep] = useState<number | null>(initialData?.maxVersionsToKeep || null);

    // Fetch series list for dropdown
    const { data: seriesListData } = blogSeriesHooks.useList(undefined, SERIES_LIST_QUERY_CONFIG);
    const seriesList = seriesListData?.data || [];

    const {
        data: versionsData,
        refetch: refetchVersions,
        isLoading: isLoadingVersions,
    } = blogPostVersionHooks.useList(
        {
            where: postId ? { postId } : undefined,
            orderBy: 'versionNumber',
            orderDirection: 'desc',
            limit: 20,
        },
        {
            enabled: isEditMode && !!postId,
            ...VERSION_HISTORY_QUERY_CONFIG,
        },
    );
    // Normalize: API may return array or { data: array, pagination }
    const versions = useMemo(() => {
        if (!isEditMode) return [];
        if (Array.isArray(versionsData)) return versionsData;
        const data = versionsData as { data?: BlogPostVersion[] } | undefined;
        return Array.isArray(data?.data) ? data.data : [];
    }, [isEditMode, versionsData]);
    const versionHistory = versions.length > 0 ? versions.slice(1) : [];

    // API hooks
    const createPost = blogPostHooks.useCreate();
    const updatePost = blogPostHooks.useUpdate();
    const deletePost = blogPostHooks.useDelete();
    const createVersion = blogPostVersionHooks.useCreate();
    const deleteVersion = blogPostVersionHooks.useDelete();

    const isSaving = createPost.isPending || updatePost.isPending;
    const queryClient = useQueryClient();

    // Active tab
    const [activeTab, setActiveTab] = useState('content');
    const [previewVersion, setPreviewVersion] = useState<BlogPostVersion | null>(null);
    const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
    const [loadVersionDialog, setLoadVersionDialog] = useState<{ open: boolean; versionNumber?: number } | null>(null);
    const [deleteVersionDialog, setDeleteVersionDialog] = useState<{
        open: boolean;
        versionId?: string;
        versionNumber?: number;
    } | null>(null);
    const [deletePostDialog, setDeletePostDialog] = useState(false);
    const [alertDialog, setAlertDialog] = useState<{ open: boolean; title: string; message: string }>({
        open: false,
        title: '',
        message: '',
    });
    const [slugError, setSlugError] = useState<string | null>(null);
    const justSavedRef = useRef(false);

    // After save we invalidate; when initialData refreshes, sync form state so isDirty stays false
    useEffect(() => {
        if (!justSavedRef.current || !initialData) return;
        justSavedRef.current = false;
        setTitle(initialData.title ?? '');
        setSlug(initialData.slug ?? '');
        setExcerpt(initialData.excerpt ?? '');
        setContentType(initialData.contentType ?? 'blog');
        setStatus(initialData.status ?? 'draft');
        setAuthorName(initialData.authorName ?? '');
        setIsFeatured(initialData.isFeatured ?? false);
        setAllowComments(initialData.allowComments ?? true);
        setPublishedAt(initialData.publishedAt ? new Date(initialData.publishedAt).toISOString().slice(0, 16) : '');
        setHeroImage(initialData.heroImage ?? null);
        setSeoTitle(initialData.seoMeta?.title ?? '');
        setSeoDescription(initialData.seoMeta?.description ?? '');
        setSeoKeywords(initialData.seoMeta?.keywords?.join(', ') ?? '');
        setSeoNoIndex(initialData.seoMeta?.noIndex ?? false);
        setSeriesId(initialData.seriesId ?? null);
        setSeriesOrder(initialData.seriesOrder ?? null);
        setMaxVersionsToKeep(initialData.maxVersionsToKeep ?? null);
    }, [initialData]);

    // Content editors - initialData is guaranteed to be available in edit mode
    const mainEditor = useOttaEditor({
        ...getEditorConfig('Start writing your post...'),
        data: initialData?.content ?? undefined,
    });

    const notesEditor = useOttaEditor({
        ...getEditorConfig('Private notes (not shown publicly)...'),
        data: initialData?.privateNotes ?? undefined,
    });

    const footnotesEditor = useOttaEditor({
        ...getEditorConfig('Add footnotes and references...'),
        data: initialData?.footnotes ?? undefined,
    });

    // Dirty state: form fields or any editor (EditorJS) has changes (Save enabled when dirty in edit mode)
    const isDirty = useMemo(() => {
        if (!initialData && !isEditMode) return true; // New post: allow save
        const formSame =
            initialData &&
            title === (initialData.title ?? '') &&
            slug === (initialData.slug ?? '') &&
            excerpt === (initialData.excerpt ?? '') &&
            contentType === initialData.contentType &&
            status === initialData.status &&
            authorName === (initialData.authorName ?? '') &&
            isFeatured === initialData.isFeatured &&
            allowComments === initialData.allowComments &&
            (publishedAt || '') ===
                (initialData.publishedAt ? new Date(initialData.publishedAt).toISOString().slice(0, 16) : '') &&
            (seriesId ?? '') === (initialData.seriesId ?? '') &&
            (seriesOrder ?? '') === (initialData.seriesOrder ?? '') &&
            (maxVersionsToKeep ?? '') === (initialData.maxVersionsToKeep ?? '') &&
            JSON.stringify(heroImage) === JSON.stringify(initialData.heroImage) &&
            JSON.stringify({
                title: seoTitle,
                description: seoDescription,
                keywords: seoKeywords
                    ?.split(',')
                    .map((k) => k.trim())
                    .filter(Boolean),
                noIndex: seoNoIndex,
            }) ===
                JSON.stringify({
                    title: initialData.seoMeta?.title ?? '',
                    description: initialData.seoMeta?.description ?? '',
                    keywords: initialData.seoMeta?.keywords ?? [],
                    noIndex: initialData.seoMeta?.noIndex ?? false,
                });
        const formDirty = !initialData ? false : !formSame;
        const editorDirty =
            mainEditor.hasUnsavedChanges || notesEditor.hasUnsavedChanges || footnotesEditor.hasUnsavedChanges;
        return formDirty || editorDirty;
    }, [
        title,
        slug,
        excerpt,
        contentType,
        status,
        authorName,
        isFeatured,
        allowComments,
        publishedAt,
        seriesId,
        seriesOrder,
        maxVersionsToKeep,
        heroImage,
        seoTitle,
        seoDescription,
        seoKeywords,
        seoNoIndex,
        initialData,
        isEditMode,
        mainEditor.hasUnsavedChanges,
        notesEditor.hasUnsavedChanges,
        footnotesEditor.hasUnsavedChanges,
    ]);

    const saveDisabled = isSaving || (isEditMode && !isDirty);

    const applyVersionToEditor = async (version: BlogPostVersion) => {
        if (!version) return;

        handleTitleChange(version.title || '');
        setExcerpt(version.excerpt || '');

        if (version.content) {
            await mainEditor.render(version.content);
        } else {
            await mainEditor.clear();
        }

        if (version.privateNotes) {
            await notesEditor.render(version.privateNotes);
        } else {
            await notesEditor.clear();
        }

        if (version.footnotes) {
            await footnotesEditor.render(version.footnotes);
        } else {
            await footnotesEditor.clear();
        }

        setActiveTab('content');
    };

    const previewPost = previewVersion
        ? {
              title: previewVersion.title,
              excerpt: previewVersion.excerpt,
              content: previewVersion.content,
              footnotes: previewVersion.footnotes,
              publishedAt,
              authorName,
              heroImage,
              contentType,
              isFeatured,
          }
        : null;

    const hasPreviewContent = previewPost?.content?.blocks && previewPost.content.blocks.length > 0;
    const hasPreviewFootnotes = previewPost?.footnotes?.blocks && previewPost.footnotes.blocks.length > 0;

    // Slug availability check: run only on Title or Slug blur (not on every keystroke)
    const doSlugCheck = useCallback(
        (slugToCheck?: string) => {
            const toCheck = (slugToCheck ?? (slug || generateSlug(title))).trim();
            if (!toCheck) {
                setSlugStatus('idle');
                setSlugError(null);
                return;
            }
            const isSlugValid = /^[A-Za-z0-9_-]+$/.test(toCheck);
            if (!isSlugValid) {
                setSlugStatus('idle');
                setSlugError('Slug can only contain letters, numbers, hyphens, and underscores.');
                return;
            }
            setSlugError(null);
            setSlugStatus('checking');
            const params = new URLSearchParams();
            params.set('uniqueField', 'slug');
            params.set('uniqueValue', toCheck);
            if (postId) params.set('uniqueIgnoreId', postId);
            if (initialData?.appId) params.set('where', JSON.stringify({ appId: initialData.appId }));
            fetch(`/api/ottaorm/posts/unique?${params.toString()}`)
                .then((res) => res.json())
                .then((result: { unique?: boolean }) => setSlugStatus(result.unique ? 'available' : 'taken'))
                .catch(() => setSlugStatus('idle'));
        },
        [slug, title, postId, initialData?.appId],
    );

    // Initial slug (from server) – only run availability check when slug has changed from this
    const initialSlug = (initialData?.slug ?? '').trim();

    // Auto-generate slug from title only on Title blur (not on every keystroke)
    const handleTitleChange = (newTitle: string) => {
        setTitle(newTitle);
        setSlugStatus('idle');
    };

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

    // Handle hero image upload
    const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingHero(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Upload failed');

            const data = (await response.json()) as {
                url?: string;
                cfImageId?: string;
            };
            if (data.url) {
                setHeroImage({
                    url: data.url,
                    alt: heroImage?.alt || file.name,
                    cfImageId: data.cfImageId,
                });
            }
        } catch (error) {
            console.error('Hero image upload failed:', error);
            setAlertDialog({ open: true, title: 'Error', message: 'Failed to upload image. Please try again.' });
        } finally {
            setIsUploadingHero(false);
        }
    };

    // Update hero image URL
    const handleHeroUrlChange = (url: string) => {
        setHeroImage(url ? { url, alt: heroImage?.alt || '' } : null);
    };

    // Update hero image alt
    const handleHeroAltChange = (alt: string) => {
        if (heroImage) {
            setHeroImage({ ...heroImage, alt });
        }
    };

    // Calculate word count from EditorJS content
    const calculateWordCount = (data: OutputData | null): number => {
        if (!data?.blocks) return 0;
        let text = '';
        for (const block of data.blocks) {
            if (block.data?.text) text += ' ' + block.data.text;
            if (block.data?.items) {
                for (const item of block.data.items as string[]) {
                    text += ' ' + item;
                }
            }
        }
        return text.trim().split(/\s+/).filter(Boolean).length;
    };

    // Get next version number
    const getNextVersionNumber = (): number => {
        if (versions.length === 0) return 1;
        const maxVersion = Math.max(...versions.map((v) => v.versionNumber));
        return maxVersion + 1;
    };

    // Prune old versions if maxVersionsToKeep is set
    const pruneOldVersions = async (versionList: BlogPostVersion[], keepCount: number) => {
        if (keepCount < 1 || versionList.length <= keepCount) return;

        const versionsToDelete = versionList.slice(keepCount);
        for (const version of versionsToDelete) {
            try {
                await deleteVersion.mutateAsync(version.id);
            } catch (error) {
                console.error('Failed to delete old version:', error);
            }
        }
    };

    // Save post
    const handleSave = async (publishNow = false) => {
        if (!title.trim()) {
            setAlertDialog({ open: true, title: 'Validation Error', message: 'Title is required' });
            return;
        }

        const baseSlug = (slug || generateSlug(title)).trim();
        if (!/^[A-Za-z0-9_-]+$/.test(baseSlug)) {
            setAlertDialog({
                open: true,
                title: 'Validation Error',
                message: 'Slug can only contain letters, numbers, hyphens, and underscores.',
            });
            return;
        }

        if (slugStatus === 'taken') {
            setAlertDialog({
                open: true,
                title: 'Validation Error',
                message: 'Slug already in use. Please choose a different slug.',
            });
            return;
        }

        try {
            // Get editor content
            const content = await mainEditor.save();
            const privateNotes = await notesEditor.save();
            const footnotes = await footnotesEditor.save();

            // Calculate word count
            const wordCount = calculateWordCount(content);

            // Build SEO meta
            const seoMeta: SeoMeta = {
                title: seoTitle || undefined,
                description: seoDescription || undefined,
                keywords: seoKeywords
                    ? seoKeywords
                          .split(',')
                          .map((k) => k.trim())
                          .filter(Boolean)
                    : undefined,
                noIndex: seoNoIndex,
                ogType: 'article',
                twitterCard: 'summary_large_image',
            };

            if (baseSlug !== slug) {
                setSlug(baseSlug);
            }

            const postData: Partial<BlogPost> = {
                title,
                slug: baseSlug,
                excerpt: excerpt || undefined,
                content: content || undefined,
                contentType,
                status: publishNow ? 'published' : status,
                heroImage,
                seoMeta,
                privateNotes: privateNotes || undefined,
                footnotes: footnotes || undefined,
                authorName: authorName || undefined,
                isFeatured,
                allowComments,
                publishedAt: publishNow && !publishedAt ? new Date().toISOString() : publishedAt || undefined,
                seriesId: seriesId || undefined,
                seriesOrder: seriesOrder || undefined,
                maxVersionsToKeep: maxVersionsToKeep || undefined,
                wordCount,
            };

            // Create version snapshot before saving (edit mode only)
            if (isEditMode && postId && initialData) {
                try {
                    await createVersion.mutateAsync({
                        postId,
                        versionNumber: getNextVersionNumber(),
                        title: initialData.title,
                        content: initialData.content,
                        excerpt: initialData.excerpt,
                        privateNotes: initialData.privateNotes,
                        footnotes: initialData.footnotes,
                        wordCount: initialData.wordCount,
                    });
                } catch (error) {
                    console.error('Failed to create version:', error);
                    // Continue with save even if version creation fails
                }
            }

            if (isEditMode && postId) {
                await updatePost.mutateAsync({ id: postId, data: postData });
                justSavedRef.current = true;
                // Invalidate post detail; when initialData refreshes we sync form state so isDirty stays false
                queryClient.invalidateQueries({ queryKey: ['posts'] });

                // Prune old versions if setting is enabled
                if (maxVersionsToKeep && maxVersionsToKeep > 0) {
                    const refreshed = await refetchVersions();
                    const latestVersions = ((refreshed.data || []) as BlogPostVersion[]) ?? [];
                    await pruneOldVersions(latestVersions, maxVersionsToKeep);
                }
                // Stay on same editor page after save
            } else {
                const created = await createPost.mutateAsync(postData);
                justSavedRef.current = true;
                // Go to the new post's editor so user stays on "blog details" for that post
                if (created?.id) {
                    navigate({ to: '/admin/blog/$postId/edit', params: { postId: created.id } });
                } else {
                    navigate({ to: '/admin/blog' });
                }
            }
        } catch (error) {
            console.error('Failed to save post:', error);
            setAlertDialog({ open: true, title: 'Error', message: 'Failed to save post. Please try again.' });
        }
    };

    const handleLoadVersion = async () => {
        if (loadVersionDialog?.open && loadVersionDialog.versionNumber !== undefined) {
            try {
                // Find the version object by versionNumber (fixed: use 'versions' not 'allVersions')
                const version = versions?.find((v) => v.versionNumber === loadVersionDialog.versionNumber);
                if (version) {
                    await applyVersionToEditor(version);
                }
            } catch (error) {
                console.error('Failed to load version:', error);
            } finally {
                setLoadVersionDialog(null);
            }
        }
    };

    const handleDeleteVersion = async () => {
        if (deleteVersionDialog?.open && deleteVersionDialog.versionId) {
            try {
                await deleteVersion.mutateAsync(deleteVersionDialog.versionId);
                refetchVersions();
            } catch (error) {
                console.error('Failed to delete version:', error);
                setAlertDialog({
                    open: true,
                    title: 'Error',
                    message: error instanceof Error ? error.message : 'Failed to delete version',
                });
            } finally {
                setDeleteVersionDialog(null);
            }
        }
    };

    const handleDeletePost = async () => {
        if (deletePostDialog && postId) {
            try {
                // Use OttaORM delete hook (same as list page) instead of non-existent /api/admin/blog/:id
                await deletePost.mutateAsync(postId);
                navigate({ to: '/admin/blog' });
            } catch (error) {
                console.error('Failed to delete post:', error);
                setAlertDialog({
                    open: true,
                    title: 'Error',
                    message: error instanceof Error ? error.message : 'Failed to delete post. Please try again.',
                });
            } finally {
                setDeletePostDialog(false);
            }
        }
    };

    return (
        <div className="space-y-6 pb-16">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link to="/admin/blog">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{isEditMode ? 'Edit Post' : 'New Post'}</h1>
                        <p className="text-sm text-muted-foreground">
                            {isEditMode ? 'Update your blog post' : 'Create a new blog post'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Badge variant={status === 'published' ? 'default' : 'secondary'}>
                        {POST_STATUSES[status].label}
                    </Badge>
                    <Button variant="outline" onClick={() => handleSave(false)} disabled={saveDisabled}>
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save
                    </Button>
                    <Button onClick={() => handleSave(true)} disabled={saveDisabled}>
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="mr-2 h-4 w-4" />
                        )}
                        Publish
                    </Button>
                </div>
            </div>

            {/* Main Form */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Title & Slug */}
                    <Card>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    value={title}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    onBlur={handleTitleBlur}
                                    placeholder="Enter post title..."
                                    className="text-lg font-semibold"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="slug">Slug</Label>
                                <Input
                                    id="slug"
                                    value={slug}
                                    onChange={(e) => {
                                        setSlug(e.target.value);
                                        setSlugStatus('idle');
                                    }}
                                    onBlur={handleSlugBlur}
                                    placeholder="url-friendly-slug"
                                    aria-invalid={slugStatus === 'taken' || !!slugError}
                                    className={
                                        slugStatus === 'taken' || slugError
                                            ? 'border-destructive focus-visible:ring-destructive'
                                            : undefined
                                    }
                                />
                                {slugError && <p className="text-xs text-destructive">{slugError}</p>}
                                {slugStatus === 'checking' && (
                                    <p className="text-xs text-muted-foreground">Checking slug...</p>
                                )}
                                {slugStatus === 'taken' && (
                                    <p className="text-xs text-destructive">Slug already in use.</p>
                                )}
                                {slugStatus === 'available' && (
                                    <p className="text-xs text-muted-foreground">Slug is available.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Content Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="content" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Content
                            </TabsTrigger>
                            <TabsTrigger value="notes" className="flex items-center gap-2">
                                <StickyNote className="h-4 w-4" />
                                Notes
                            </TabsTrigger>
                            <TabsTrigger value="footnotes" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Footnotes
                            </TabsTrigger>
                            <TabsTrigger value="seo" className="flex items-center gap-2">
                                <Search className="h-4 w-4" />
                                SEO
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="content" className="mt-4 data-[state=inactive]:hidden" forceMount>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Main Content</CardTitle>
                                    <CardDescription>
                                        Write your post content using the rich text editor
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div
                                        ref={mainEditor.editorRef}
                                        className="min-h-[400px] prose prose-slate dark:prose-invert max-w-none rounded-lg border p-4"
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="notes" className="mt-4 data-[state=inactive]:hidden" forceMount>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Private Notes</CardTitle>
                                    <CardDescription>
                                        Personal notes for the author (not shown publicly)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div
                                        ref={notesEditor.editorRef}
                                        className="min-h-[300px] prose prose-slate dark:prose-invert max-w-none rounded-lg border p-4 bg-yellow-50/50 dark:bg-yellow-900/10"
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="footnotes" className="mt-4 data-[state=inactive]:hidden" forceMount>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Footnotes & References</CardTitle>
                                    <CardDescription>
                                        Add footnotes, citations, and references (shown at the end of the post)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div
                                        ref={footnotesEditor.editorRef}
                                        className="min-h-[200px] prose prose-slate dark:prose-invert max-w-none rounded-lg border p-4"
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="seo" className="mt-4 data-[state=inactive]:hidden">
                            <Card>
                                <CardHeader>
                                    <CardTitle>SEO Settings</CardTitle>
                                    <CardDescription>Optimize your post for search engines</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="seoTitle">SEO Title</Label>
                                        <Input
                                            id="seoTitle"
                                            value={seoTitle}
                                            onChange={(e) => setSeoTitle(e.target.value)}
                                            placeholder={title || 'Defaults to post title'}
                                        />
                                        <p className="text-xs text-muted-foreground">{seoTitle.length}/60 characters</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="seoDescription">Meta Description</Label>
                                        <Textarea
                                            id="seoDescription"
                                            value={seoDescription}
                                            onChange={(e) => setSeoDescription(e.target.value)}
                                            placeholder="Brief description for search results..."
                                            rows={3}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            {seoDescription.length}/160 characters
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="seoKeywords">Keywords</Label>
                                        <Input
                                            id="seoKeywords"
                                            value={seoKeywords}
                                            onChange={(e) => setSeoKeywords(e.target.value)}
                                            placeholder="keyword1, keyword2, keyword3"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="seoNoIndex"
                                            aria-label="Hide from search engines"
                                            checked={seoNoIndex}
                                            onChange={(e) => setSeoNoIndex(e.target.checked)}
                                            className="rounded"
                                        />
                                        <Label htmlFor="seoNoIndex">Hide from search engines (noindex)</Label>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>

                    {/* Excerpt */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Excerpt</CardTitle>
                            <CardDescription>Short summary shown in listings (auto-generated if empty)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                value={excerpt}
                                onChange={(e) => setExcerpt(e.target.value)}
                                placeholder="Brief summary of the post..."
                                rows={3}
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Settings */}
                <div className="space-y-6">
                    {/* Hero Image */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ImageIcon className="h-4 w-4" />
                                Hero Image
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {heroImage?.url ? (
                                <div className="relative">
                                    <img
                                        src={heroImage.url}
                                        alt={heroImage.alt || 'Hero image'}
                                        className="w-full rounded-lg object-cover aspect-video"
                                    />
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-2 right-2"
                                        onClick={() => setHeroImage(null)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                                    <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                                    <p className="mt-2 text-sm text-muted-foreground">No hero image set</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Upload Image</Label>
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleHeroImageUpload}
                                    disabled={isUploadingHero}
                                />
                                {isUploadingHero && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Uploading...
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Or paste URL</Label>
                                <Input
                                    value={heroImage?.url || ''}
                                    onChange={(e) => handleHeroUrlChange(e.target.value)}
                                    placeholder="https://..."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Alt Text</Label>
                                <Input
                                    value={heroImage?.alt || ''}
                                    onChange={(e) => handleHeroAltChange(e.target.value)}
                                    placeholder="Describe the image..."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Post Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="contentType">Content Type</Label>
                                <select
                                    id="contentType"
                                    aria-label="Content type"
                                    value={contentType}
                                    onChange={(e) => setContentType(e.target.value as ContentType)}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    {Object.entries(CONTENT_TYPES).map(([value, { label }]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="postStatus">Status</Label>
                                <select
                                    id="postStatus"
                                    aria-label="Post status"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as PostStatus)}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    {Object.entries(POST_STATUSES).map(([value, { label }]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label>Author Name</Label>
                                <Input
                                    value={authorName}
                                    onChange={(e) => setAuthorName(e.target.value)}
                                    placeholder="Author name..."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Publish Date</Label>
                                <Input
                                    type="datetime-local"
                                    value={publishedAt}
                                    onChange={(e) => setPublishedAt(e.target.value)}
                                />
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="isFeatured"
                                        aria-label="Featured post"
                                        checked={isFeatured}
                                        onChange={(e) => setIsFeatured(e.target.checked)}
                                        className="rounded"
                                    />
                                    <Label htmlFor="isFeatured">Featured Post</Label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="allowComments"
                                        aria-label="Allow comments"
                                        checked={allowComments}
                                        onChange={(e) => setAllowComments(e.target.checked)}
                                        className="rounded"
                                    />
                                    <Label htmlFor="allowComments">Allow Comments</Label>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Series */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                Series
                            </CardTitle>
                            <CardDescription>Group this post with related content</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="seriesSelect">Series</Label>
                                <select
                                    id="seriesSelect"
                                    aria-label="Series"
                                    value={seriesId || ''}
                                    onChange={(e) => setSeriesId(e.target.value || null)}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    <option value="">No series</option>
                                    {seriesList.map((series) => (
                                        <option key={series.id} value={series.id}>
                                            {series.title}
                                            {series.isComplete ? ' ✓' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {seriesId && (
                                <div className="space-y-2">
                                    <Label>Order in Series</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={seriesOrder || ''}
                                        onChange={(e) =>
                                            setSeriesOrder(e.target.value ? parseInt(e.target.value, 10) : null)
                                        }
                                        placeholder="1, 2, 3..."
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Position within the series (e.g., Part 1, Part 2)
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Version History */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-4 w-4" />
                                Version History
                            </CardTitle>
                            <CardDescription>Track changes and restore previous versions</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="maxVersionsToKeep">Keep Previous Versions</Label>
                                <select
                                    id="maxVersionsToKeep"
                                    aria-label="Keep previous versions"
                                    value={maxVersionsToKeep || ''}
                                    onChange={(e) =>
                                        setMaxVersionsToKeep(e.target.value ? parseInt(e.target.value, 10) : null)
                                    }
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    <option value="">Keep all versions</option>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                                        <option key={n} value={n}>
                                            Keep last {n} version{n > 1 ? 's' : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    Older versions will be automatically deleted on save
                                </p>
                                {isEditMode &&
                                    maxVersionsToKeep != null &&
                                    maxVersionsToKeep > 0 &&
                                    versions.length > maxVersionsToKeep && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                            {versions.length - maxVersionsToKeep} version
                                            {versions.length - maxVersionsToKeep === 1 ? '' : 's'} in the database would
                                            be deleted on next save.
                                        </p>
                                    )}
                            </div>

                            {isEditMode && isLoadingVersions && (
                                <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Loading version history...
                                </div>
                            )}

                            {isEditMode && !isLoadingVersions && versionHistory.length > 0 && (
                                <div className="space-y-2">
                                    <Label>Recent Versions ({versionHistory.length})</Label>
                                    <div className="max-h-[200px] overflow-y-auto rounded-md border divide-y">
                                        {versionHistory.map((version) => (
                                            <div
                                                key={version.id}
                                                className="flex items-center justify-between p-2 text-sm hover:bg-muted/50"
                                            >
                                                <div>
                                                    <span className="font-medium">v{version.versionNumber}</span>
                                                    <span className="text-muted-foreground ml-2">
                                                        {new Date(version.createdAt).toLocaleDateString()}
                                                    </span>
                                                    {version.wordCount && (
                                                        <span className="text-muted-foreground ml-2">
                                                            {version.wordCount} words
                                                        </span>
                                                    )}
                                                    {version.changeNote && (
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            {version.changeNote}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="h-6 px-2"
                                                        onClick={() => setPreviewVersion(version)}
                                                    >
                                                        Preview
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-6 px-2"
                                                        onClick={() =>
                                                            setLoadVersionDialog({
                                                                open: true,
                                                                versionNumber: version.versionNumber,
                                                            })
                                                        }
                                                    >
                                                        Load
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-2 text-destructive hover:text-destructive"
                                                        onClick={() =>
                                                            setDeleteVersionDialog({
                                                                open: true,
                                                                versionId: version.id,
                                                                versionNumber: version.versionNumber,
                                                            })
                                                        }
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {isEditMode && versions.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    No version history yet. Versions are created when you save changes.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Danger Zone */}
                    {isEditMode && (
                        <Card className="border-destructive/50">
                            <CardHeader>
                                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    variant="destructive"
                                    className="w-full"
                                    onClick={() => setDeletePostDialog(true)}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Post
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <Dialog
                open={!!previewVersion}
                onOpenChange={(open) => {
                    if (!open) setPreviewVersion(null);
                }}
            >
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Preview - Version {previewVersion?.versionNumber}</DialogTitle>
                        <DialogDescription>This is a read-only preview of the selected version.</DialogDescription>
                    </DialogHeader>

                    {previewPost && (
                        <article className="max-w-3xl mx-auto">
                            {/* Hero Image */}
                            {previewPost.heroImage?.url && (
                                <figure className="mb-8">
                                    <img
                                        src={previewPost.heroImage.url}
                                        alt={previewPost.heroImage.alt || previewPost.title}
                                        className="w-full rounded-lg object-cover aspect-video"
                                    />
                                    {previewPost.heroImage.caption && (
                                        <figcaption className="mt-2 text-center text-sm text-muted-foreground">
                                            {previewPost.heroImage.caption}
                                        </figcaption>
                                    )}
                                </figure>
                            )}

                            {/* Content Type Badge */}
                            {previewPost.contentType !== 'blog' && (
                                <span className="inline-block mb-4 px-3 py-1 bg-secondary text-secondary-foreground text-sm rounded-full capitalize">
                                    {previewPost.contentType}
                                </span>
                            )}

                            {/* Title */}
                            <h1 className="text-4xl font-bold mb-4 leading-tight">{previewPost.title}</h1>

                            {/* Metadata */}
                            <div className="flex flex-wrap items-center gap-4 mb-8 text-sm text-muted-foreground">
                                {previewPost.authorName && (
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4" />
                                        <span className="font-medium text-foreground">{previewPost.authorName}</span>
                                    </div>
                                )}
                                {previewPost.publishedAt && (
                                    <div className="flex items-center gap-1">
                                        <Calendar className="h-4 w-4" />
                                        <time dateTime={previewPost.publishedAt}>
                                            {formatDate(previewPost.publishedAt)}
                                        </time>
                                    </div>
                                )}
                                {previewPost.isFeatured && (
                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium">
                                        Featured
                                    </span>
                                )}
                            </div>

                            {/* Excerpt */}
                            {previewPost.excerpt && (
                                <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                                    {previewPost.excerpt}
                                </p>
                            )}

                            {/* Main Content */}
                            {hasPreviewContent && (
                                <div className="prose prose-slate dark:prose-invert max-w-none mb-12">
                                    <Blocks
                                        data={previewPost.content!}
                                        renderers={customRenderers}
                                        config={defaultEJSRConfigs}
                                    />
                                </div>
                            )}

                            {/* Footnotes */}
                            {hasPreviewFootnotes && (
                                <aside className="border-t pt-8 mt-12">
                                    <h2 className="text-xl font-semibold mb-4">Footnotes</h2>
                                    <div className="prose prose-sm prose-slate dark:prose-invert max-w-none text-muted-foreground">
                                        <Blocks
                                            data={previewPost.footnotes!}
                                            renderers={customRenderers}
                                            config={defaultEJSRConfigs}
                                        />
                                    </div>
                                </aside>
                            )}
                        </article>
                    )}
                </DialogContent>
            </Dialog>

            {/* Load Version Confirmation Dialog */}
            <AlertDialog
                open={loadVersionDialog?.open ?? false}
                onOpenChange={(open) => !open && setLoadVersionDialog(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Load Version?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Load version {loadVersionDialog?.versionNumber} into the editor?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleLoadVersion}>Load</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Version Confirmation Dialog */}
            <AlertDialog
                open={deleteVersionDialog?.open ?? false}
                onOpenChange={(open) => !open && setDeleteVersionDialog(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Version?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Delete version {deleteVersionDialog?.versionNumber}?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteVersion}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Post Confirmation Dialog */}
            <AlertDialog open={deletePostDialog} onOpenChange={setDeletePostDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Post?</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure you want to delete this post?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeletePost}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* General Alert Dialog */}
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
