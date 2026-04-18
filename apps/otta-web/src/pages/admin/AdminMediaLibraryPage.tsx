import { MediaLibraryBrowser } from '@/components/media-library/MediaLibraryBrowser';

export function AdminMediaLibraryPage() {
    return (
        <MediaLibraryBrowser
            title="Media Library"
            description="Browse, upload, and manage the media assets available across this app."
            emptyTitle="No media uploaded yet"
            emptyDescription="Upload files to start building the shared media library for your editors and content pages."
        />
    );
}
