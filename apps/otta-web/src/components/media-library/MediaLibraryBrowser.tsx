import { mediaLibraryHooks } from '@/hooks/mediaLibraryHooks';
import { api, isApiError } from '@/lib/api';
import { uploadMedia } from '@/lib/upload';
import type { MediaKind, MediaLibraryItemLike } from '@ottabase/medialibrary';
import {
    formatMediaFileSize,
    getMediaDisplayTitle,
    getMediaKindFromMimeType,
    toMediaSelectionPayload,
} from '@ottabase/medialibrary';
import { MediaPreview } from '@ottabase/medialibrary/react';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Textarea,
} from '@ottabase/ui-shadcn';
import {
    IconCheck,
    IconCopy,
    IconDeviceFloppy,
    IconExternalLink,
    IconPhotoPlus,
    IconSearch,
    IconTrash,
    IconUpload,
    IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

type MediaListItem = MediaLibraryItemLike & {
    id: string;
    url: string;
    storageKey: string;
    originalName: string;
    mimeType: string;
    mediaKind: MediaKind;
    status: 'active' | 'archived';
    fileSize: number;
    provider: 'r2' | 'cloudflare-images';
};

interface MediaLibraryBrowserProps {
    title: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
    defaultWhere?: Record<string, unknown>;
    acceptKinds?: MediaKind[];
    showUpload?: boolean;
    allowDelete?: boolean;
    mode?: 'page' | 'picker';
    confirmLabel?: string;
    /** Allow selecting multiple items at once. Only applies when mode='picker'. Default: false */
    allowMultiselect?: boolean;
    onSelectItem?: (item: ReturnType<typeof toMediaSelectionPayload>, rawItem: MediaListItem) => void;
    /** Called when the user confirms a multi-selection; receives payloads in selection order. */
    onSelectItems?: (items: ReturnType<typeof toMediaSelectionPayload>[]) => void;
}

const MEDIA_KIND_FILTERS: MediaKind[] = ['image', 'video', 'audio', 'document', 'archive', 'other'];

/** File-input `accept` for a picker's kinds; undefined (anything) when a kind has no MIME family */
function acceptAttribute(kinds?: MediaKind[]): string | undefined {
    const families: Partial<Record<MediaKind, string>> = { image: 'image/*', video: 'video/*', audio: 'audio/*' };
    if (!kinds?.length || kinds.some((kind) => !families[kind])) return undefined;
    return kinds.map((kind) => families[kind]).join(',');
}

function formatCreatedAt(value?: string | number | Date | null): string {
    if (!value) {
        return 'Unknown';
    }

    return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export function MediaLibraryBrowser({
    title,
    description,
    emptyTitle,
    emptyDescription,
    defaultWhere,
    acceptKinds,
    showUpload = true,
    allowDelete = true,
    mode = 'page',
    confirmLabel = 'Use this media',
    allowMultiselect = false,
    onSelectItem,
    onSelectItems,
}: MediaLibraryBrowserProps) {
    const isPicker = mode === 'picker';
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const dragDepth = useRef(0);
    const [searchValue, setSearchValue] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activeKind, setActiveKind] = useState<MediaKind | 'all'>('all');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    // Picker mode: what the user tapped, in tap order (kept as items so a new search doesn't drop them)
    const [picked, setPicked] = useState<MediaListItem[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    // Serial upload state for the inline progress strip
    const [upload, setUpload] = useState<{ name: string; index: number; total: number; fraction: number } | null>(null);
    const isUploading = upload !== null;
    const [deleteTarget, setDeleteTarget] = useState<MediaListItem | null>(null);
    const [formValues, setFormValues] = useState({
        title: '',
        altText: '',
        caption: '',
    });

    const pickedOrder = useMemo(() => new Map(picked.map((item, index) => [item.id, index + 1])), [picked]);

    /** Tap to pick, tap again to drop; single mode keeps at most one */
    const togglePick = useCallback(
        (item: MediaListItem) => {
            setPicked((prev) => {
                if (prev.some((p) => p.id === item.id)) return prev.filter((p) => p.id !== item.id);
                return allowMultiselect ? [...prev, item] : [item];
            });
        },
        [allowMultiselect],
    );

    const confirmPicked = useCallback(
        (items: MediaListItem[] = picked) => {
            if (items.length === 0) return;
            if (allowMultiselect && onSelectItems) onSelectItems(items.map(toMediaSelectionPayload));
            else onSelectItem?.(toMediaSelectionPayload(items[0]), items[0]);
        },
        [allowMultiselect, onSelectItem, onSelectItems, picked],
    );

    // Debounce search input so we don't fire a request on every keystroke
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchValue.trim()), 300);
        return () => clearTimeout(timer);
    }, [searchValue]);

    const whereClause = useMemo(() => {
        const clause: Record<string, unknown> = {
            status: 'active',
            ...(defaultWhere || {}),
        };
        // Kind filters run on the server, so paging never hides matching items
        if (activeKind !== 'all') {
            clause.mediaKind = activeKind;
        } else if (acceptKinds?.length) {
            clause.mediaKind = { $in: acceptKinds };
        }
        return clause;
    }, [activeKind, acceptKinds, defaultWhere]);

    const mediaListQuery = mediaLibraryHooks.useInfiniteList(
        {
            where: whereClause,
            search: debouncedSearch || undefined,
            orderBy: 'createdAt',
            orderDirection: 'desc',
        },
        36,
    );
    const updateMedia = mediaLibraryHooks.useUpdate();

    const items = useMemo(
        () => (mediaListQuery.data?.pages?.flatMap((page) => page.data) ?? []) as MediaListItem[],
        [mediaListQuery.data],
    );

    const allowedKinds = useMemo(() => acceptKinds ?? MEDIA_KIND_FILTERS, [acceptKinds]);

    // Server total for the current filters (falls back to loaded rows before the first page lands)
    const totalCount = mediaListQuery.data?.pages?.[0]?.total ?? items.length;

    // Picker mode: only offer files the picker can accept
    const uploadAccept = useMemo(() => acceptAttribute(acceptKinds), [acceptKinds]);

    const selectedItem = useMemo(
        () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
        [items, selectedId],
    );

    useEffect(() => {
        if (selectedItem && selectedId !== selectedItem.id) {
            setSelectedId(selectedItem.id);
        }
    }, [selectedId, selectedItem]);

    useEffect(() => {
        setFormValues({
            title: selectedItem?.title || '',
            altText: selectedItem?.altText || '',
            caption: selectedItem?.caption || '',
        });
    }, [selectedItem?.altText, selectedItem?.caption, selectedItem?.id, selectedItem?.title]);

    const refetchList = mediaListQuery.refetch;
    const refetchItems = useCallback(async () => {
        await refetchList();
    }, [refetchList]);

    const handleUploadFiles = useCallback(
        async (files: FileList | File[]) => {
            // The file input filters by type; dropped files need the same check
            const all = Array.from(files);
            const list = acceptKinds?.length
                ? all.filter((file) => acceptKinds.includes(getMediaKindFromMimeType(file.type, file.name)))
                : all;
            if (list.length < all.length) {
                toast.info(
                    `Skipped ${all.length - list.length} file${all.length - list.length === 1 ? '' : 's'} of a kind this can't use`,
                );
            }
            if (list.length === 0) return;

            const uploadedIds: string[] = [];
            const failures: string[] = [];
            for (const [index, file] of list.entries()) {
                setUpload({ name: file.name, index: index + 1, total: list.length, fraction: 0 });
                try {
                    const result = await uploadMedia(file, {
                        onProgress: (fraction) => setUpload((prev) => (prev ? { ...prev, fraction } : prev)),
                    });
                    if (result.media?.id) uploadedIds.push(result.media.id);
                } catch (error) {
                    failures.push(`${file.name}: ${error instanceof Error ? error.message : 'upload failed'}`);
                }
            }
            setUpload(null);

            const refreshed = await refetchList();
            if (uploadedIds.length > 0) {
                const fresh = (refreshed.data?.pages?.flatMap((page) => page.data) ?? []) as MediaListItem[];
                const uploaded = uploadedIds
                    .map((id) => fresh.find((item) => item.id === id))
                    .filter((item): item is MediaListItem => !!item);
                // Picker: what you just uploaded is what you meant to pick
                if (isPicker) setPicked((prev) => (allowMultiselect ? [...prev, ...uploaded] : uploaded.slice(-1)));
                else setSelectedId(uploadedIds[uploadedIds.length - 1]);
                toast.success(uploadedIds.length === 1 ? 'Upload complete' : `${uploadedIds.length} files uploaded`);
            }
            if (failures.length > 0) {
                toast.error(failures.length === 1 ? 'Upload failed' : `${failures.length} uploads failed`, {
                    description: failures.join('\n'),
                });
            }
        },
        [acceptKinds, allowMultiselect, isPicker, refetchList],
    );

    /** Drag files anywhere over the browser to upload them */
    const dropHandlers = showUpload
        ? {
              onDragEnter: (event: React.DragEvent) => {
                  if (!event.dataTransfer.types.includes('Files')) return;
                  event.preventDefault();
                  dragDepth.current += 1;
                  setIsDragging(true);
              },
              onDragOver: (event: React.DragEvent) => {
                  if (event.dataTransfer.types.includes('Files')) event.preventDefault();
              },
              onDragLeave: (event: React.DragEvent) => {
                  if (!event.dataTransfer.types.includes('Files')) return;
                  dragDepth.current = Math.max(0, dragDepth.current - 1);
                  if (dragDepth.current === 0) setIsDragging(false);
              },
              onDrop: (event: React.DragEvent) => {
                  if (!event.dataTransfer.types.includes('Files')) return;
                  event.preventDefault();
                  dragDepth.current = 0;
                  setIsDragging(false);
                  if (!isUploading) void handleUploadFiles(event.dataTransfer.files);
              },
          }
        : {};

    const handleMetadataSave = useCallback(async () => {
        if (!selectedItem) {
            return;
        }

        try {
            await updateMedia.mutateAsync({
                id: selectedItem.id,
                data: {
                    title: formValues.title || null,
                    altText: formValues.altText || null,
                    caption: formValues.caption || null,
                },
            });
            await refetchItems();
            toast.success('Metadata updated');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update media');
        }
    }, [formValues.altText, formValues.caption, formValues.title, refetchItems, selectedItem, updateMedia]);

    const handleCopyUrl = useCallback(async (url: string) => {
        await navigator.clipboard.writeText(url);
        toast.success('Media URL copied');
    }, []);

    const handleDelete = useCallback(async () => {
        if (!deleteTarget) {
            return;
        }

        try {
            await api(`/api/medialibrary/${encodeURIComponent(deleteTarget.id)}/purge`, {
                method: 'DELETE',
            });
            await refetchItems();
            setDeleteTarget(null);
            if (selectedId === deleteTarget.id) {
                setSelectedId(null);
            }
            toast.success('Media deleted');
        } catch (error) {
            const message = isApiError(error)
                ? error.message
                : error instanceof Error
                  ? error.message
                  : 'Delete failed';
            toast.error(message);
        }
    }, [deleteTarget, refetchItems, selectedId]);

    return (
        <div {...dropHandlers} className={`relative space-y-6 ${isPicker ? 'px-4 pt-4 sm:px-6' : ''}`}>
            {isDragging && (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/85">
                    <p className="flex items-center gap-2 text-base font-medium">
                        <IconUpload className="h-5 w-5 text-primary" aria-hidden="true" />
                        Drop to upload
                    </p>
                </div>
            )}
            <div
                className={`flex flex-col gap-4 lg:flex-row lg:justify-between ${isPicker ? 'lg:items-center' : 'lg:items-end'}`}
            >
                {/* In a picker the dialog already carries the title */}
                {isPicker ? (
                    showUpload && (
                        <p className="hidden text-sm text-muted-foreground sm:block">
                            Tap to select. Drop files anywhere here to upload them.
                        </p>
                    )
                ) : (
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
                    </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {showUpload && (
                        <>
                            <input
                                ref={uploadInputRef}
                                type="file"
                                multiple
                                accept={uploadAccept}
                                className="hidden"
                                aria-label="Upload media files"
                                onChange={(event) => {
                                    if (event.target.files) {
                                        handleUploadFiles(event.target.files);
                                        event.target.value = '';
                                    }
                                }}
                            />
                            <Button
                                type="button"
                                onClick={() => uploadInputRef.current?.click()}
                                disabled={isUploading}
                            >
                                <IconPhotoPlus className="mr-2 h-4 w-4" />
                                {isUploading ? 'Uploading…' : 'Upload files'}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant={activeKind === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveKind('all')}
                    className="rounded-full"
                >
                    All
                </Button>
                {allowedKinds.map((kind) => (
                    <Button
                        key={kind}
                        type="button"
                        variant={activeKind === kind ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveKind(kind)}
                        className="rounded-full capitalize"
                    >
                        {kind}
                    </Button>
                ))}
            </div>

            {upload && (
                <div role="status" className="space-y-1.5 rounded-lg bg-muted/40 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate">
                            Uploading <span className="font-medium">{upload.name}</span>
                            {upload.total > 1 ? ` (${upload.index} of ${upload.total})` : ''}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                            {Math.round(upload.fraction * 100)}%
                        </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-background">
                        <div
                            className="h-full rounded-full bg-primary transition-[width] duration-200"
                            style={{ width: `${Math.round(upload.fraction * 100)}%` }}
                        />
                    </div>
                </div>
            )}

            <div className={`grid gap-6 ${isPicker ? '' : 'xl:grid-cols-[minmax(0,1fr)_20rem]'}`}>
                {/* Inside a picker dialog the card would only add padding */}
                <Card
                    className={
                        isPicker
                            ? 'border-0 bg-transparent shadow-none'
                            : 'min-h-[32rem] rounded-xl border-transparent bg-muted/40'
                    }
                >
                    <CardHeader className={isPicker ? 'px-0 pt-0' : undefined}>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-[0.9375rem] font-semibold">Library</CardTitle>
                                <CardDescription className="text-sm text-muted-foreground">
                                    {totalCount} item{totalCount === 1 ? '' : 's'} available
                                </CardDescription>
                            </div>
                            <div className="flex w-full items-center gap-3 sm:w-auto">
                                {/* Search moved here, next to the Library title */}
                                <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                                    <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={searchValue}
                                        onChange={(event) => setSearchValue(event.target.value)}
                                        placeholder="Search files, titles, or captions..."
                                        className={`h-9 bg-background pl-9 ${searchValue ? 'pr-8' : ''}`}
                                    />
                                    {searchValue && (
                                        <button
                                            type="button"
                                            aria-label="Clear search"
                                            onClick={() => setSearchValue('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-muted-foreground transition-colors duration-normal hover:text-foreground focus:outline-none"
                                        >
                                            <IconX className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                {mediaListQuery.isLoading && (
                                    <span className="inline-flex items-center rounded-full bg-background px-2.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                                        Refreshing
                                    </span>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className={isPicker ? 'px-0' : undefined}>
                        {mediaListQuery.isLoading && items.length === 0 ? (
                            // Skeleton grid — card is muted, so pulse tiles use bg-background/60 to stay visible
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-busy="true">
                                <span className="sr-only">Loading media library…</span>
                                {Array.from({ length: 8 }, (_, index) => (
                                    <div
                                        key={index}
                                        className="aspect-[4/3] animate-pulse rounded-xl bg-background/60"
                                    />
                                ))}
                            </div>
                        ) : items.length === 0 ? (
                            <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3 rounded-xl bg-muted/40 text-center">
                                <div className="rounded-full bg-background p-4 ring-1 ring-border">
                                    <IconPhotoPlus className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-base font-medium text-foreground">{emptyTitle}</p>
                                    <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                                        {emptyDescription}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div
                                    className={`grid gap-4 ${isPicker ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'}`}
                                >
                                    {items.map((item) => {
                                        const itemTitle = getMediaDisplayTitle(item);
                                        const order = pickedOrder.get(item.id);
                                        const isSelected = isPicker
                                            ? order !== undefined
                                            : selectedItem?.id === item.id;

                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                aria-pressed={isPicker ? isSelected : undefined}
                                                onClick={() => (isPicker ? togglePick(item) : setSelectedId(item.id))}
                                                // Double-click is a shortcut for "pick this one" in a single picker
                                                onDoubleClick={() => {
                                                    if (isPicker && !allowMultiselect) confirmPicked([item]);
                                                }}
                                                className={`relative overflow-hidden rounded-xl bg-background text-left transition-colors duration-normal ${
                                                    isSelected
                                                        ? 'ring-2 ring-primary'
                                                        : 'ring-1 ring-border hover:bg-muted/40'
                                                }`}
                                            >
                                                {/* Always-visible pick circle: empty, a tick, or the pick order */}
                                                {isPicker && (
                                                    <span
                                                        aria-hidden="true"
                                                        className={`absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold shadow ${
                                                            isSelected
                                                                ? 'bg-primary text-primary-foreground'
                                                                : 'bg-background/80 ring-1 ring-border'
                                                        }`}
                                                    >
                                                        {isSelected &&
                                                            (allowMultiselect ? (
                                                                order
                                                            ) : (
                                                                <IconCheck className="h-3.5 w-3.5" />
                                                            ))}
                                                    </span>
                                                )}
                                                <div className="aspect-[4/3] overflow-hidden bg-muted/30">
                                                    <MediaPreview
                                                        item={item}
                                                        className="h-full w-full rounded-none border-0"
                                                    />
                                                </div>
                                                <div className="space-y-3 p-4">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="inline-flex items-center rounded-full bg-muted/40 px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                            {item.mediaKind}
                                                        </span>
                                                        <span className="inline-flex items-center rounded-full bg-muted/40 px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                            {formatMediaFileSize(item.fileSize)}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="truncate text-sm font-medium text-foreground">
                                                            {itemTitle}
                                                        </p>
                                                        {/* The title falls back to the file name; don't say it twice */}
                                                        {item.originalName !== itemTitle && (
                                                            <p className="truncate text-xs text-muted-foreground">
                                                                {item.originalName}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {!isPicker && (
                                                        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                            {formatCreatedAt(item.createdAt)}
                                                        </p>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                {mediaListQuery.hasNextPage && (
                                    <div className="mt-6 flex justify-center">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => mediaListQuery.fetchNextPage()}
                                            disabled={mediaListQuery.isFetchingNextPage}
                                        >
                                            {mediaListQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* File details: the library page only; a picker shows its pick in the bottom bar */}
                {!isPicker && (
                    <Card className="h-fit rounded-xl border-transparent bg-muted/40 xl:sticky xl:top-6">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">File details</CardTitle>
                            <CardDescription>
                                {selectedItem
                                    ? 'Inspect and manage the selected file.'
                                    : 'Select a file to inspect it.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {selectedItem ? (
                                <>
                                    <div className="overflow-hidden rounded-xl bg-background ring-1 ring-border">
                                        <div className="aspect-[4/3]">
                                            <MediaPreview item={selectedItem} mode="detail" fit="contain" />
                                        </div>
                                    </div>

                                    <div className="grid gap-3 text-sm">
                                        <div>
                                            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                File name
                                            </p>
                                            <p className="mt-1 break-all text-foreground">
                                                {selectedItem.originalName}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                Storage
                                            </p>
                                            <p className="mt-1 break-all text-foreground">{selectedItem.storageKey}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                    Type
                                                </p>
                                                <p className="mt-1 text-foreground">{selectedItem.mimeType}</p>
                                            </div>
                                            <div>
                                                <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                    Provider
                                                </p>
                                                <p className="mt-1 text-foreground">{selectedItem.provider}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                    Size
                                                </p>
                                                <p className="mt-1 text-foreground">
                                                    {formatMediaFileSize(selectedItem.fileSize)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                    Uploaded
                                                </p>
                                                <p className="mt-1 text-foreground">
                                                    {formatCreatedAt(selectedItem.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {mode === 'page' && (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-foreground">Title</label>
                                                <Input
                                                    value={formValues.title}
                                                    onChange={(event) =>
                                                        setFormValues((currentValues) => ({
                                                            ...currentValues,
                                                            title: event.target.value,
                                                        }))
                                                    }
                                                    placeholder="Homepage hero image"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-foreground">Alt text</label>
                                                <Textarea
                                                    value={formValues.altText}
                                                    onChange={(event) =>
                                                        setFormValues((currentValues) => ({
                                                            ...currentValues,
                                                            altText: event.target.value,
                                                        }))
                                                    }
                                                    placeholder="Describe this media for accessibility"
                                                    rows={3}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-foreground">Caption</label>
                                                <Textarea
                                                    value={formValues.caption}
                                                    onChange={(event) =>
                                                        setFormValues((currentValues) => ({
                                                            ...currentValues,
                                                            caption: event.target.value,
                                                        }))
                                                    }
                                                    placeholder="Optional caption shown below the media"
                                                    rows={3}
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                className="w-full"
                                                onClick={handleMetadataSave}
                                                disabled={updateMedia.isPending}
                                            >
                                                <IconDeviceFloppy className="mr-2 h-4 w-4" />
                                                {updateMedia.isPending ? 'Saving...' : 'Save metadata'}
                                            </Button>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full"
                                            onClick={() =>
                                                window.open(selectedItem.url, '_blank', 'noopener,noreferrer')
                                            }
                                        >
                                            <IconExternalLink className="mr-2 h-4 w-4" />
                                            Open file
                                        </Button>

                                        {mode === 'page' && (
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => handleCopyUrl(selectedItem.url)}
                                                >
                                                    <IconCopy className="mr-2 h-4 w-4" />
                                                    Copy URL
                                                </Button>

                                                {allowDelete && (
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        className="w-full"
                                                        onClick={() => setDeleteTarget(selectedItem)}
                                                    >
                                                        <IconTrash className="mr-2 h-4 w-4" />
                                                        Delete permanently
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-lg border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
                                    Select a file from the library to view its preview and metadata.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {isPicker && (
                <div className="sticky bottom-0 z-20 -mx-4 flex items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
                    {picked.length > 0 && (
                        <div className="flex shrink-0 -space-x-2" aria-hidden="true">
                            {picked.slice(-4).map((item) => (
                                <div
                                    key={item.id}
                                    className="h-9 w-9 overflow-hidden rounded-md bg-muted ring-2 ring-background"
                                >
                                    <MediaPreview
                                        item={item}
                                        className="h-full w-full rounded-none border-0"
                                        fit="cover"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                    <p className="min-w-0 flex-1 truncate text-sm" aria-live="polite">
                        {picked.length === 0
                            ? allowMultiselect
                                ? 'Nothing selected yet. Items go in the order you tap them.'
                                : 'Nothing selected yet'
                            : allowMultiselect
                              ? `${picked.length} selected`
                              : getMediaDisplayTitle(picked[0])}
                    </p>
                    {picked.length > 0 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setPicked([])}>
                            Clear
                        </Button>
                    )}
                    <Button type="button" size="sm" disabled={picked.length === 0} onClick={() => confirmPicked()}>
                        {confirmLabel}
                        {allowMultiselect && picked.length > 0 ? ` (${picked.length})` : ''}
                    </Button>
                </div>
            )}

            <ConfirmDialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                a11yTitle="Delete this media item"
                hideTitle
                description="This permanently removes the file from storage and the media library. This action cannot be undone."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={handleDelete}
            />
        </div>
    );
}
