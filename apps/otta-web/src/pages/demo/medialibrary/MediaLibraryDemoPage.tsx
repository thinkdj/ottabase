import {
    formatMediaFileSize,
    MediaLightboxProvider,
    MediaPreview,
    toMediaViewerItem,
    useMediaLightboxRegistration,
    type MediaLibraryItemLike,
} from '@ottabase/medialibrary';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { IconPhoto, IconPlayerPlay, IconZoomIn } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';

const DEMO_MEDIA_ITEMS: MediaLibraryItemLike[] = [
    {
        id: 'img-1',
        provider: 'cloudflare-images',
        storageKey: 'demo/liquid-art.jpg',
        url: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1400',
        thumbnailUrl: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=400',
        previewUrl: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=900',
        mimeType: 'image/jpeg',
        mediaKind: 'image',
        status: 'active',
        originalName: 'liquid-art.jpg',
        title: 'Abstract Liquid Art',
        caption: 'Creative abstract visuals',
        fileSize: 2_450_000,
        width: 1400,
        height: 933,
    },
    {
        id: 'img-2',
        provider: 'cloudflare-images',
        storageKey: 'demo/neon-geometric.jpg',
        url: 'https://images.unsplash.com/photo-1550684376-efcbd6e3f031?w=1400',
        thumbnailUrl: 'https://images.unsplash.com/photo-1550684376-efcbd6e3f031?w=400',
        previewUrl: 'https://images.unsplash.com/photo-1550684376-efcbd6e3f031?w=900',
        mimeType: 'image/jpeg',
        mediaKind: 'image',
        status: 'active',
        originalName: 'neon-geometric.jpg',
        title: 'Neon Smoke Art',
        caption: 'Colorful creative visuals',
        fileSize: 1_880_000,
        width: 1400,
        height: 930,
    },
    {
        id: 'video-1',
        provider: 'r2',
        storageKey: 'demo/sample-video.mp4',
        url: 'https://www.w3schools.com/html/movie.mp4',
        thumbnailUrl: null,
        previewUrl: 'https://www.w3schools.com/html/movie.mp4',
        mimeType: 'video/mp4',
        mediaKind: 'video',
        status: 'active',
        originalName: 'sample-video.mp4',
        title: 'Sample Video',
        caption: 'Demo video clip',
        fileSize: 4_380_000,
    },
];

function MediaTile({ item }: { item: MediaLibraryItemLike }) {
    const viewerItem = toMediaViewerItem(item);
    const { open } = useMediaLightboxRegistration(item.id, viewerItem);

    return (
        <Card className="overflow-hidden">
            <div className="h-48 w-full bg-muted/20">
                <MediaPreview item={viewerItem} mode="tile" />
            </div>
            <CardContent className="space-y-3 p-4">
                <div className="space-y-1">
                    <p className="truncate text-sm font-medium">{item.title || item.originalName}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                        {item.mediaKind} · {formatMediaFileSize(item.fileSize)}
                    </p>
                </div>
                <Button onClick={open} variant="outline" size="sm" className="w-full">
                    <IconZoomIn className="mr-2 h-4 w-4" />
                    Open in lightbox
                </Button>
            </CardContent>
        </Card>
    );
}

export function MediaLibraryDemoPage() {
    return (
        <div className="space-y-6">
            <Button asChild variant="ghost" className="w-fit">
                <Link to="/demo">← Back to Demos</Link>
            </Button>

            <div className="space-y-2">
                <h1 className="text-3xl font-semibold">Media Library Demo</h1>
                <p className="text-muted-foreground">
                    Viewer and lightbox primitives from <code>@ottabase/medialibrary</code>, running without
                    authenticated APIs.
                </p>
            </div>

            <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                    <IconPhoto className="mr-1 h-3.5 w-3.5" />
                    Image preview
                </Badge>
                <Badge variant="outline">
                    <IconPlayerPlay className="mr-1 h-3.5 w-3.5" />
                    Video preview
                </Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Interactive Gallery</CardTitle>
                    <CardDescription>
                        Click any card to open the package lightbox provider and navigate media items.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <MediaLightboxProvider variant="immersive" showMetadata>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {DEMO_MEDIA_ITEMS.map((item) => (
                                <MediaTile key={item.id} item={item} />
                            ))}
                        </div>
                    </MediaLightboxProvider>
                </CardContent>
            </Card>
        </div>
    );
}
