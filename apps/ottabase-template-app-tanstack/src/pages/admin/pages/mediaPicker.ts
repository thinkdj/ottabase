type MediaSelectionDetail = {
    media?: {
        url?: string;
        alt?: string;
        title?: string;
        [key: string]: unknown;
    };
};

export type PickedMedia = {
    url: string;
    alt?: string;
    title?: string;
};

export function openMediaLibraryPicker(): Promise<PickedMedia | null> {
    return new Promise((resolve) => {
        const handleSelected = (event: Event) => {
            const detail = (event as CustomEvent<MediaSelectionDetail>).detail;
            const media = detail?.media;
            window.removeEventListener('media-library-selected-item', handleSelected as EventListener);

            if (!media?.url) {
                resolve(null);
                return;
            }

            resolve({
                url: String(media.url),
                alt: media.alt ? String(media.alt) : undefined,
                title: media.title ? String(media.title) : undefined,
            });
        };

        window.addEventListener('media-library-selected-item', handleSelected as EventListener, { once: true });
        window.dispatchEvent(
            new CustomEvent('media-library-open', {
                detail: {
                    source: 'marketing-page-builder',
                    acceptKinds: ['image'],
                },
            }),
        );
    });
}
