import { cleanCrossposts, CrosspostsField, crosspostsKey } from '@/components/editor/CrosspostsField';
import { UnsavedChangesDialog } from '@/components/editor/UnsavedChangesDialog';
import { MediaLibraryBrowser } from '@/components/media-library/MediaLibraryBrowser';
import { blogPostHooks, blogTagHooks } from '@/hooks/blogHooks';
import { useEditorLeaveGuard } from '@/hooks/useEditorLeaveGuard';
import { useSession } from '@/lib/auth';
import type { MediaSelectionPayload } from '@ottabase/medialibrary';
import {
    createPhotoJournalTitle,
    PHOTO_JOURNAL_MAX_ITEMS,
    PHOTO_JOURNAL_NOTE_MAX_LENGTH,
    POST_STATUSES,
    type PhotoJournalItem,
    type PostCrosspost,
    type PostStatus,
} from '@ottabase/ottablog';
import { PhotoJournalRenderer } from '@ottabase/ottablog/renderer';
import {
    AdvancedImageTool,
    MediaGalleryTool,
    MediaLibraryTool,
    useOttaEditor,
    type BlockToolConstructable,
    type OutputData,
    type ToolSettings,
} from '@ottabase/ottaeditor';
import { createModelHooks, useApiMutation } from '@ottabase/ottaorm/client';
import { OttaSelect, type OttaSelectItem } from '@ottabase/ottaselect';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
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
    NativeSelect,
    NativeSelectOption,
    Textarea,
} from '@ottabase/ui-shadcn';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { Link, useNavigate } from '@tanstack/react-router';
import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    Images,
    Loader2,
    MapPin,
    Plus,
    Save,
    Send,
    Star,
    Tag,
    Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useBlogSurface } from './blogAdminPaths';

export interface PhotoJournalEditorPost {
    id: string;
    title: string;
    slug: string;
    photoNote: string | null;
    photoAlbum: PhotoJournalItem[] | null;
    content: OutputData | null;
    crossposts: PostCrosspost[] | null;
    status: PostStatus;
    allowComments: boolean;
    isFeatured: boolean;
    publishAt: number | null;
    publishedAt: number | null;
    authorId: string | null;
    author?: { id: string; name: string | null; image: string | null } | null;
}

interface PhotoJournalPayload {
    title: string | null;
    note: string | null;
    photos: PhotoJournalItem[];
    content: OutputData | null;
    crossposts: PostCrosspost[];
    status: PostStatus;
    allowComments: boolean;
    isFeatured: boolean;
    publishAt: number | null;
}

/**
 * The album is the opener and the SEO photo list; this editor is the story under it. It gets the
 * same tools as the article editor, so a journal alternates prose with its own galleries instead
 * of needing a second block system.
 */
const JOURNAL_BODY_EDITOR_CONFIG = {
    defaultPlugins: 'all' as const,
    placeholder: 'Tell the story: what happened between these frames...',
    minHeight: 200,
    additionalPlugins: [
        {
            name: 'image',
            tool: AdvancedImageTool as unknown as BlockToolConstructable,
            config: { provider: 'r2', uploadEndpoint: '/api/upload' } as ToolSettings,
        },
        {
            name: 'mediaLibrary',
            tool: MediaLibraryTool as unknown as BlockToolConstructable,
            config: {} as ToolSettings,
        },
        {
            name: 'mediaGallery',
            tool: MediaGalleryTool as unknown as BlockToolConstructable,
            config: {} as ToolSettings,
        },
    ],
};

interface PhotoTag {
    id: string;
    name: string;
}

interface PhotoTagLink {
    id: string;
    postId: string;
    tagId: string;
}

const blogTagLinkHooks = createModelHooks<PhotoTagLink>({ entityName: 'post_tag_links' });

function photoFromMedia(item: MediaSelectionPayload): PhotoJournalItem {
    return {
        id: item.mediaId || crypto.randomUUID(),
        mediaId: item.mediaId ?? null,
        url: item.url,
        thumbnailUrl: item.thumbnailUrl ?? null,
        previewUrl: item.previewUrl ?? null,
        title: item.title ?? null,
        alt: item.alt ?? null,
        caption: item.caption ?? null,
        location: null,
        takenAt: null,
        width: item.width ?? null,
        height: item.height ?? null,
        mimeType: item.mimeType ?? null,
    };
}

function dateInputValue(value: number | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function initialPublishAt(value: number | null | undefined): string {
    return value ? new Date(value).toISOString().slice(0, 16) : '';
}

export function AdminPhotoJournalEditor({ initialData }: { initialData?: PhotoJournalEditorPost }) {
    const surface = useBlogSurface();
    const navigate = useNavigate();
    const { user } = useSession();
    const isEditMode = Boolean(initialData);
    const [title, setTitle] = useState(initialData?.title ?? '');
    const [note, setNote] = useState(initialData?.photoNote ?? '');
    const [photos, setPhotos] = useState<PhotoJournalItem[]>(initialData?.photoAlbum ?? []);
    const [crossposts, setCrossposts] = useState<PostCrosspost[]>(initialData?.crossposts ?? []);
    const [status, setStatus] = useState<PostStatus>(initialData?.status ?? 'draft');
    const [allowComments, setAllowComments] = useState(initialData?.allowComments ?? true);
    const [isFeatured, setIsFeatured] = useState(initialData?.isFeatured ?? false);
    const [publishAt, setPublishAt] = useState(initialPublishAt(initialData?.publishAt));
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [alert, setAlert] = useState({ open: false, title: '', message: '' });

    const createPhotoJournal = useApiMutation<PhotoJournalEditorPost, PhotoJournalPayload>({
        endpoint: '/api/blog/photo-journals',
        method: 'POST',
        invalidateEntities: ['posts'],
    });
    const updatePhotoJournal = useApiMutation<PhotoJournalEditorPost, PhotoJournalPayload & { id: string }>({
        endpoint: (variables) => `/api/blog/photo-journals/${encodeURIComponent(variables.id)}`,
        method: 'PATCH',
        invalidateEntities: ['posts'],
    });
    const deletePost = blogPostHooks.useDelete();
    const { data: allTagsData } = blogTagHooks.useList(undefined, { staleTime: 30_000 });
    const allTags = useMemo<PhotoTag[]>(() => {
        if (Array.isArray(allTagsData)) return allTagsData;
        return (allTagsData as { data?: PhotoTag[] } | undefined)?.data ?? [];
    }, [allTagsData]);
    const selectedTagItems = useMemo<OttaSelectItem[]>(
        () =>
            selectedTagIds
                .map((id) => allTags.find((tag) => tag.id === id))
                .filter(Boolean)
                .map((tag) => ({ id: tag!.id, name: tag!.name })),
        [allTags, selectedTagIds],
    );
    const { data: tagLinksData } = blogTagLinkHooks.useList(
        { where: initialData ? { postId: initialData.id } : undefined },
        { enabled: Boolean(initialData), staleTime: 30_000 },
    );
    const tagLinks = useMemo<PhotoTagLink[]>(() => {
        if (!initialData) return [];
        if (Array.isArray(tagLinksData)) return tagLinksData;
        return (tagLinksData as { data?: PhotoTagLink[] } | undefined)?.data ?? [];
    }, [initialData, tagLinksData]);
    const createTagLink = blogTagLinkHooks.useCreate();
    const deleteTagLink = blogTagLinkHooks.useDelete();

    useEffect(() => {
        if (initialData && tagLinksData !== undefined) setSelectedTagIds(tagLinks.map((link) => link.tagId));
    }, [initialData, tagLinks, tagLinksData]);

    const bodyEditor = useOttaEditor({ ...JOURNAL_BODY_EDITOR_CONFIG, data: initialData?.content ?? undefined });

    const isSaving = createPhotoJournal.isPending || updatePhotoJournal.isPending;
    const isDirty = useMemo(() => {
        if (!initialData) {
            return (
                Boolean(title.trim() || note.trim() || photos.length || selectedTagIds.length) ||
                crosspostsKey(crossposts) !== '[]' ||
                bodyEditor.hasUnsavedChanges
            );
        }
        return (
            bodyEditor.hasUnsavedChanges ||
            title !== initialData.title ||
            note !== (initialData.photoNote ?? '') ||
            JSON.stringify(photos) !== JSON.stringify(initialData.photoAlbum ?? []) ||
            crosspostsKey(crossposts) !== crosspostsKey(initialData.crossposts) ||
            status !== initialData.status ||
            allowComments !== initialData.allowComments ||
            isFeatured !== initialData.isFeatured ||
            publishAt !== initialPublishAt(initialData.publishAt) ||
            JSON.stringify([...selectedTagIds].sort()) !== JSON.stringify(tagLinks.map((link) => link.tagId).sort())
        );
    }, [
        allowComments,
        bodyEditor.hasUnsavedChanges,
        crossposts,
        initialData,
        isFeatured,
        note,
        photos,
        publishAt,
        selectedTagIds,
        status,
        tagLinks,
        title,
    ]);
    const { blocker, allowNavigateRef } = useEditorLeaveGuard(isDirty);

    const setPhoto = (id: string, changes: Partial<PhotoJournalItem>) => {
        setPhotos((current) => current.map((photo) => (photo.id === id ? { ...photo, ...changes } : photo)));
    };

    const movePhoto = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= photos.length) return;
        setPhotos((current) => {
            const next = [...current];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const addPhotos = (items: MediaSelectionPayload[]) => {
        const incoming = items.map(photoFromMedia);
        const existingKeys = new Set(photos.flatMap((photo) => [photo.mediaId, photo.url]).filter(Boolean));
        const unique = incoming.filter(
            (photo) => !existingKeys.has(photo.mediaId || '') && !existingKeys.has(photo.url),
        );
        const available = PHOTO_JOURNAL_MAX_ITEMS - photos.length;
        setPhotos((current) => [...current, ...unique.slice(0, available)]);
        setLibraryOpen(false);
        if (unique.length > available) {
            setAlert({
                open: true,
                title: 'Album limit reached',
                message: `A photo journal can contain up to ${PHOTO_JOURNAL_MAX_ITEMS} photographs.`,
            });
        }
    };

    const handleSave = async (publishNow: boolean) => {
        if (photos.length === 0 || photos.length > PHOTO_JOURNAL_MAX_ITEMS) {
            setAlert({
                open: true,
                title: 'Add photographs',
                message: `Choose between 1 and ${PHOTO_JOURNAL_MAX_ITEMS} photographs for this journal.`,
            });
            return;
        }
        if (note.length > PHOTO_JOURNAL_NOTE_MAX_LENGTH) {
            setAlert({
                open: true,
                title: 'Field note is too long',
                message: `Keep the note to ${PHOTO_JOURNAL_NOTE_MAX_LENGTH} characters or fewer.`,
            });
            return;
        }

        const resolvedStatus = publishNow ? 'published' : status;
        const publishAtValue = publishAt ? new Date(publishAt).getTime() : null;
        if (resolvedStatus === 'scheduled' && !publishAtValue) {
            setAlert({
                open: true,
                title: 'Publish date required',
                message: 'Choose when this photo journal should go live.',
            });
            return;
        }

        // An empty editor saves as null so a journal without a story keeps a clean album-only page.
        const body = await bodyEditor.save();
        const payload: PhotoJournalPayload = {
            title: title.trim() || null,
            note: note.trim() || null,
            photos,
            content: body?.blocks?.length ? body : null,
            crossposts: cleanCrossposts(crossposts),
            status: resolvedStatus,
            allowComments,
            isFeatured,
            publishAt: resolvedStatus === 'scheduled' ? publishAtValue : null,
        };

        try {
            const saved = initialData
                ? await updatePhotoJournal.mutateAsync({ id: initialData.id, ...payload })
                : await createPhotoJournal.mutateAsync(payload);
            const existingTagIds = tagLinks.map((link) => link.tagId);
            const toAdd = selectedTagIds.filter((id) => !existingTagIds.includes(id));
            const toRemove = tagLinks.filter((link) => !selectedTagIds.includes(link.tagId));
            await Promise.all([
                ...toAdd.map((tagId) => createTagLink.mutateAsync({ postId: saved.id, tagId })),
                ...toRemove.map((link) => deleteTagLink.mutateAsync(link.id)),
            ]);
            allowNavigateRef.current = true;
            navigate({ to: surface.contentPath });
        } catch (error) {
            setAlert({
                open: true,
                title: 'Could not save photo journal',
                message: error instanceof Error ? error.message : 'Please try again.',
            });
        }
    };

    const handleDelete = async () => {
        if (!initialData) return;
        try {
            await deletePost.mutateAsync(initialData.id);
            allowNavigateRef.current = true;
            navigate({ to: surface.contentPath });
        } catch (error) {
            setAlert({
                open: true,
                title: 'Could not delete photo journal',
                message: error instanceof Error ? error.message : 'Please try again.',
            });
        } finally {
            setDeleteOpen(false);
        }
    };

    const previewTitle = createPhotoJournalTitle(title, photos[0]);

    return (
        <div className="space-y-6 pb-16">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link to={surface.contentPath} aria-label="Back to content">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                            {isEditMode ? 'Edit photo journal' : 'New photo journal'}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Tell the story in photographs; words are optional.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void handleSave(false)} disabled={isSaving || !isDirty}>
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save
                    </Button>
                    <Button onClick={() => void handleSave(true)} disabled={isSaving || photos.length === 0}>
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="mr-2 h-4 w-4" />
                        )}
                        Publish
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">Story frame</CardTitle>
                            <CardDescription>
                                A title and short field note set the mood without competing with the images.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="photoJournalTitle">
                                    Title <span className="font-normal text-muted-foreground">(optional)</span>
                                </Label>
                                <Input
                                    id="photoJournalTitle"
                                    value={title}
                                    maxLength={180}
                                    onChange={(event) => setTitle(event.target.value)}
                                    placeholder="Kyoto, in the rain"
                                    className="bg-background text-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="photoJournalNote">
                                    Field note <span className="font-normal text-muted-foreground">(optional)</span>
                                </Label>
                                <Textarea
                                    id="photoJournalNote"
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    rows={5}
                                    maxLength={PHOTO_JOURNAL_NOTE_MAX_LENGTH + 1}
                                    placeholder="The rain emptied the streets just before blue hour..."
                                    className="resize-y bg-background leading-relaxed"
                                />
                                <p
                                    className={`text-right text-xs tabular-nums ${note.length > PHOTO_JOURNAL_NOTE_MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}
                                >
                                    {note.length}/{PHOTO_JOURNAL_NOTE_MAX_LENGTH}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                                    <Images className="h-4 w-4 text-muted-foreground" />
                                    Photographs
                                </CardTitle>
                                <CardDescription className="mt-1.5">
                                    The first frame is the cover. Order the rest as you want the journey to unfold.
                                </CardDescription>
                            </div>
                            <Button
                                onClick={() => setLibraryOpen(true)}
                                disabled={photos.length >= PHOTO_JOURNAL_MAX_ITEMS}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Add
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {photos.length === 0 ? (
                                <button
                                    type="button"
                                    onClick={() => setLibraryOpen(true)}
                                    className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/60 px-6 py-16 text-center outline-none transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <Images className="mb-4 h-10 w-10 text-muted-foreground" />
                                    <span className="font-medium">Choose the photographs</span>
                                    <span className="mt-1 max-w-sm text-sm text-muted-foreground">
                                        Select several at once from the media library, or upload a fresh set.
                                    </span>
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    {photos.map((photo, index) => {
                                        const imageUrl = sanitizeUrl(
                                            photo.thumbnailUrl || photo.previewUrl || photo.url,
                                        );
                                        return (
                                            <details
                                                key={photo.id}
                                                className="group rounded-xl border border-border bg-background open:ring-1 open:ring-ring/20"
                                            >
                                                <summary className="flex cursor-pointer list-none items-center gap-3 p-3 marker:hidden">
                                                    <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                                                        {imageUrl !== '#' && (
                                                            <img
                                                                src={imageUrl}
                                                                alt=""
                                                                className="h-full w-full object-cover"
                                                            />
                                                        )}
                                                        {index === 0 && (
                                                            <span className="absolute left-1.5 top-1.5 rounded-full bg-background/90 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-foreground shadow-sm">
                                                                Cover
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                            Frame {index + 1}
                                                        </p>
                                                        <p className="mt-1 truncate text-sm font-medium">
                                                            {photo.caption || photo.title || photo.alt || 'Add details'}
                                                        </p>
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            Open to add caption, place, date, and alt text
                                                        </p>
                                                    </div>
                                                    <div
                                                        className="flex shrink-0 items-center gap-1"
                                                        onClick={(event) => event.preventDefault()}
                                                    >
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={index === 0}
                                                            onClick={() => movePhoto(index, -1)}
                                                            aria-label={`Move frame ${index + 1} up`}
                                                        >
                                                            <ArrowUp className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={index === photos.length - 1}
                                                            onClick={() => movePhoto(index, 1)}
                                                            aria-label={`Move frame ${index + 1} down`}
                                                        >
                                                            <ArrowDown className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                setPhotos((current) =>
                                                                    current.filter((item) => item.id !== photo.id),
                                                                )
                                                            }
                                                            aria-label={`Remove frame ${index + 1}`}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </summary>
                                                <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
                                                    <div className="space-y-2 sm:col-span-2">
                                                        <Label htmlFor={`photo-alt-${photo.id}`}>
                                                            Alternative text
                                                        </Label>
                                                        <Input
                                                            id={`photo-alt-${photo.id}`}
                                                            value={photo.alt ?? ''}
                                                            maxLength={300}
                                                            onChange={(event) =>
                                                                setPhoto(photo.id, { alt: event.target.value || null })
                                                            }
                                                            placeholder="Describe what is visible for someone who cannot see it"
                                                        />
                                                    </div>
                                                    <div className="space-y-2 sm:col-span-2">
                                                        <Label htmlFor={`photo-caption-${photo.id}`}>Caption</Label>
                                                        <Textarea
                                                            id={`photo-caption-${photo.id}`}
                                                            value={photo.caption ?? ''}
                                                            maxLength={600}
                                                            rows={2}
                                                            onChange={(event) =>
                                                                setPhoto(photo.id, {
                                                                    caption: event.target.value || null,
                                                                })
                                                            }
                                                            placeholder="A line of context, a memory, or leave it quiet"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label
                                                            htmlFor={`photo-location-${photo.id}`}
                                                            className="flex items-center gap-1.5"
                                                        >
                                                            <MapPin className="h-3.5 w-3.5" /> Place
                                                        </Label>
                                                        <Input
                                                            id={`photo-location-${photo.id}`}
                                                            value={photo.location ?? ''}
                                                            maxLength={180}
                                                            onChange={(event) =>
                                                                setPhoto(photo.id, {
                                                                    location: event.target.value || null,
                                                                })
                                                            }
                                                            placeholder="Kyoto, Japan"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`photo-date-${photo.id}`}>
                                                            Photographed on
                                                        </Label>
                                                        <Input
                                                            id={`photo-date-${photo.id}`}
                                                            type="date"
                                                            value={dateInputValue(photo.takenAt)}
                                                            onChange={(event) =>
                                                                setPhoto(photo.id, {
                                                                    takenAt: event.target.value
                                                                        ? Date.parse(
                                                                              `${event.target.value}T12:00:00.000Z`,
                                                                          )
                                                                        : null,
                                                                })
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            </details>
                                        );
                                    })}
                                    <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                                        <span>
                                            {photos.length} of {PHOTO_JOURNAL_MAX_ITEMS} frames
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setLibraryOpen(true)}
                                            disabled={photos.length >= PHOTO_JOURNAL_MAX_ITEMS}
                                        >
                                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add more
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">Journal story</CardTitle>
                            <CardDescription>
                                Optional. Write the story that runs under the album, adding image and gallery blocks
                                wherever the words need one.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div
                                ref={bodyEditor.editorRef}
                                className="prose prose-slate dark:prose-invert min-h-[240px] max-w-none rounded-lg border bg-background p-4"
                            />
                        </CardContent>
                    </Card>

                    <CrosspostsField value={crossposts} onChange={setCrossposts} noun="journal" />

                    {photos.length > 0 && (
                        <section aria-labelledby="photo-preview-title">
                            <h2
                                id="photo-preview-title"
                                className="mb-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground"
                            >
                                Timeline preview
                            </h2>
                            <PhotoJournalRenderer
                                variant="timeline"
                                disableHooks
                                post={{
                                    id: initialData?.id ?? 'preview',
                                    title: previewTitle,
                                    slug: initialData?.slug ?? 'preview',
                                    photoNote: note.trim() || null,
                                    photoAlbum: photos,
                                    crossposts: cleanCrossposts(crossposts),
                                    contentType: 'photo',
                                    status,
                                    authorId: initialData?.authorId ?? user?.id ?? null,
                                    author:
                                        initialData?.author ??
                                        (user
                                            ? { id: user.id, name: user.name ?? null, image: user.image ?? null }
                                            : null),
                                    publishedAt: initialData?.publishedAt ?? Date.now(),
                                }}
                            />
                        </section>
                    )}
                </div>

                <div className="space-y-6">
                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">Publishing</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="photoJournalStatus">Status</Label>
                                <NativeSelect
                                    id="photoJournalStatus"
                                    value={status}
                                    onChange={(event) => setStatus(event.target.value as PostStatus)}
                                    wrapperClassName="w-full"
                                >
                                    {Object.entries(POST_STATUSES).map(([value, option]) => (
                                        <NativeSelectOption key={value} value={value}>
                                            {option.label}
                                        </NativeSelectOption>
                                    ))}
                                </NativeSelect>
                            </div>
                            {status === 'scheduled' && (
                                <div className="space-y-2">
                                    <Label htmlFor="photoJournalPublishAt">Publish at</Label>
                                    <Input
                                        id="photoJournalPublishAt"
                                        type="datetime-local"
                                        value={publishAt}
                                        onChange={(event) => setPublishAt(event.target.value)}
                                    />
                                </div>
                            )}
                            <label className="flex items-center gap-2 text-sm font-medium">
                                <input
                                    type="checkbox"
                                    checked={allowComments}
                                    onChange={(event) => setAllowComments(event.target.checked)}
                                    className="rounded"
                                />
                                Allow comments
                            </label>
                            <label className="flex items-center gap-2 text-sm font-medium">
                                <input
                                    type="checkbox"
                                    checked={isFeatured}
                                    onChange={(event) => setIsFeatured(event.target.checked)}
                                    className="rounded"
                                />
                                <Star className="h-4 w-4 text-muted-foreground" /> Highlight on the blog
                            </label>
                        </CardContent>
                    </Card>

                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                                <Tag className="h-4 w-4 text-muted-foreground" /> Tags
                            </CardTitle>
                            <CardDescription>Places, trips, themes, and other paths into this journal.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <OttaSelect
                                mode="multiple"
                                items={allTags}
                                value={selectedTagItems}
                                onChange={(value) =>
                                    setSelectedTagIds(((value as OttaSelectItem[]) ?? []).map((item) => item.id))
                                }
                                searchable
                                clearable
                                showChips
                                placeholder="Select tags..."
                                emptyMessage="No tags found"
                            />
                        </CardContent>
                    </Card>

                    {initialData && (
                        <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                            <CardHeader>
                                <CardTitle className="text-[0.9375rem] font-semibold text-destructive">
                                    Danger zone
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Button variant="destructive" className="w-full" onClick={() => setDeleteOpen(true)}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete photo journal
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
                <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>Choose photographs</DialogTitle>
                        <DialogDescription>
                            Select several images in the order you want them added. You can rearrange them afterwards.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <MediaLibraryBrowser
                            title="Photographs"
                            description="Select from your image library or upload new photographs."
                            emptyTitle="No photographs yet"
                            emptyDescription="Upload the first images for this journal."
                            acceptKinds={['image']}
                            mode="picker"
                            allowMultiselect
                            allowDelete={false}
                            confirmLabel="Add selected photographs"
                            onSelectItem={(item) => addPhotos([item])}
                            onSelectItems={addPhotos}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={deleteOpen}
                title="Delete this photo journal?"
                description="This cannot be undone."
                primaryActionText="Delete"
                secondaryActionText="Cancel"
                onConfirm={() => void handleDelete()}
                onCancel={() => setDeleteOpen(false)}
            />
            <UnsavedChangesDialog blocker={blocker} />
            <AlertDialog open={alert.open} onOpenChange={(open) => setAlert((current) => ({ ...current, open }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alert.title}</AlertDialogTitle>
                        <AlertDialogDescription>{alert.message}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction>OK</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
