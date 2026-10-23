import { formatMediaFileSize, toMediaViewerItem, type MediaLibraryItemLike } from '@ottabase/medialibrary';
import { MediaLightboxProvider, MediaPreview, useMediaLightboxRegistration } from '@ottabase/medialibrary/react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui';
import { IconPhoto, IconPlayerPlay, IconZoomIn } from '@tabler/icons-react';
import { DemoPageHeader } from '../DemoPageHeader';

/**
 * "Quiet forms": five architecture photographs and one clip on light and shadow, all free to use
 * (Unsplash and Pexels licenses), credited in each caption. `url` is the 1600px JPEG the lightbox
 * opens; `width`, `height` and `fileSize` describe that file exactly, as an upload record would.
 */
function unsplashPhoto(
    photoId: string,
    item: Pick<
        MediaLibraryItemLike,
        'id' | 'originalName' | 'title' | 'altText' | 'caption' | 'fileSize' | 'height'
    > & {
        publishedAt: string;
    },
): MediaLibraryItemLike {
    const src = (width: number) => `https://images.unsplash.com/${photoId}?w=${width}&q=80&fm=jpg`;
    const { publishedAt, ...rest } = item;
    return {
        ...rest,
        provider: 'cloudflare-images',
        storageKey: `demo/quiet-forms/${item.originalName}`,
        url: src(1600),
        previewUrl: src(1200),
        thumbnailUrl: src(400),
        mimeType: 'image/jpeg',
        mediaKind: 'image',
        status: 'active',
        width: 1600,
        createdAt: publishedAt,
    };
}

const DEMO_MEDIA_ITEMS: MediaLibraryItemLike[] = [
    unsplashPhoto('photo-1496865534669-25ec2a3a0fd3', {
        id: 'still-water-puebla',
        originalName: 'still-water-puebla.jpg',
        title: 'Still water, Puebla',
        altText: 'A woman in black crossing a shallow pool in front of a tall cream wall',
        caption: 'Museo Internacional Barroco, Puebla, Mexico. Photo by Leo Manjarrez on Unsplash.',
        fileSize: 309_408,
        height: 2400,
        publishedAt: '2017-06-07T20:01:32Z',
    }),
    unsplashPhoto('photo-1763046289892-857b83dc070f', {
        id: 'casa-branca-stair',
        originalName: 'casa-branca-stair.jpg',
        title: 'Casa Branca stair',
        altText: 'A white concrete stair beside an arched doorway, half in hard afternoon shadow',
        caption: 'Casa Branca, São José do Rio Preto, Brazil. Photo by Eduardo Gorghetto on Unsplash.',
        fileSize: 128_280,
        height: 2400,
        publishedAt: '2025-11-13T15:06:02Z',
    }),
    unsplashPhoto('photo-1765776035390-e9f3d5080cb3', {
        id: 'zayed-museum-curve',
        originalName: 'zayed-museum-curve.jpg',
        title: 'The curve, Zayed National Museum',
        altText: 'Sweeping sand-coloured walls curving up towards an opening of sky',
        caption: 'Zayed National Museum, Abu Dhabi. Photo by Miguel Joya on Unsplash.',
        fileSize: 282_207,
        height: 2400,
        publishedAt: '2025-12-15T05:24:16Z',
    }),
    unsplashPhoto('photo-1602128110234-2d11c0aaadfe', {
        id: 'courtyard-lisbon',
        originalName: 'courtyard-lisbon.jpg',
        title: 'Courtyard, Lisbon',
        altText: 'Two round trees against a curved white wall with a single wooden door',
        caption: 'Lisbon, Portugal. Photo by niklas schoenberger on Unsplash.',
        fileSize: 332_829,
        height: 2133,
        publishedAt: '2020-10-08T03:41:41Z',
    }),
    unsplashPhoto('photo-1785997258233-8feb3adf7340', {
        id: 'afternoon-passage',
        originalName: 'afternoon-passage.jpg',
        title: 'Afternoon passage',
        altText: 'Low sun throwing a sharp diagonal shadow through a passage of pale stone panels',
        caption: 'Park Galitskogo, Krasnodar. Photo by Igor Savelev on Unsplash.',
        fileSize: 753_149,
        height: 2400,
        publishedAt: '2026-08-06T06:50:09Z',
    }),
    {
        id: 'light-across-a-wall',
        provider: 'r2',
        storageKey: 'demo/quiet-forms/light-across-a-wall.mp4',
        url: 'https://videos.pexels.com/video-files/6963729/6963729-hd_1280_720_50fps.mp4',
        previewUrl: 'https://videos.pexels.com/video-files/6963729/6963729-hd_1280_720_50fps.mp4',
        thumbnailUrl:
            'https://images.pexels.com/videos/6963729/ceramic-cup-ceramic-vase-interior-decor-interior-decoration-6963729.jpeg?auto=compress&cs=tinysrgb&w=600',
        mimeType: 'video/mp4',
        mediaKind: 'video',
        status: 'active',
        originalName: 'light-across-a-wall.mp4',
        title: 'Light across a wall',
        altText: 'Window light sliding across a white wall above a vase and a stack of books',
        caption: 'Video by Cup of Couple on Pexels.',
        fileSize: 3_435_140,
        width: 1280,
        height: 720,
    },
];

function MediaTile({ item }: { item: MediaLibraryItemLike }) {
    const viewerItem = toMediaViewerItem(item);
    const { open } = useMediaLightboxRegistration(item.id, viewerItem);

    return (
        <Card className="overflow-hidden rounded-xl border-border/60 shadow-none transition-colors duration-normal hover:border-border">
            <button
                type="button"
                onClick={open}
                aria-label={`Open ${item.title || item.originalName} in lightbox`}
                className="block aspect-[4/5] w-full cursor-zoom-in overflow-hidden bg-muted/40 [&_video]:object-[12%_50%]"
            >
                <MediaPreview item={viewerItem} mode="tile" />
            </button>
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
        <div className="space-y-8">
            <DemoPageHeader
                title="Media Library"
                description={
                    <>
                        Viewer and lightbox primitives from <code>@ottabase/medialibrary</code>, running without
                        authenticated APIs.
                    </>
                }
            />

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
                    <CardTitle className="text-[0.9375rem] font-semibold">Interactive Gallery</CardTitle>
                    <CardDescription>
                        Quiet forms: five photographs and a short clip on light and architecture. Open any piece in the
                        lightbox, then move through the set with the arrow keys; zoom works on the photographs.
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
